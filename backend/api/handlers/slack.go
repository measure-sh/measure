package handlers

import (
	"bytes"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"

	"backend/libs/measure"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/leporo/sqlf"
)

// slackAccessURL is Slack's OAuth token exchange endpoint. A package var so
// tests can point it at a stub server.
var slackAccessURL = "https://slack.com/api/oauth.v2.access"

type TeamSlack struct {
	SlackTeamName string `json:"slack_team_name"`
	IsActive      bool   `json:"is_active"`
	Scopes        string `json:"scopes"`
	// NeedsReauth is true when the connection's granted scopes are missing a
	// currently required scope, so the team must reconnect. Computed server-side
	// from Scopes against slackRequiredScopes.
	NeedsReauth bool `json:"needs_reauth"`
}

// slackRequiredScopes are the bot scopes the Measure Slack app requests. Single
// source of truth: the authorize URL requests exactly these, and a connection's
// granted scopes are compared against them to detect when a team connected
// before newer scopes were added and needs to reconnect.
var slackRequiredScopes = []string{
	"app_mentions:read",
	"assistant:write",
	"chat:write",
	"chat:write.public",
	"channels:read",
	"groups:read",
	"channels:history",
	"groups:history",
	"im:history",
	"im:write",
	"commands",
	"files:write",
	"links:read",
	"links:write",
	"reactions:read",
	"reactions:write",
	"users:read",
	"users:read.email",
}

// slackConnectionNeedsReauth reports whether granted scopes are missing any
// currently required scope. An empty granted string (unknown) returns false.
//
// Granted scopes beyond the required set deliberately do not trigger reauth:
// Slack scope grants are additive per installation and cannot be downgraded
// by re-running the OAuth flow ("It is not possible to downgrade an access
// token's scopes"), so a reconnect prompt for extra scopes could never clear
// itself. Only uninstalling the app from the workspace contracts a grant.
func slackConnectionNeedsReauth(granted string) bool {
	if granted == "" {
		return false
	}
	have := make(map[string]bool)
	for s := range strings.SplitSeq(granted, ",") {
		have[strings.TrimSpace(s)] = true
	}
	return slices.ContainsFunc(slackRequiredScopes, func(s string) bool {
		return !have[s]
	})
}

// slackRedirectURI is the OAuth redirect the dashboard callback serves. It is
// server-controlled and must be identical in the authorize step and the token
// exchange, which Slack enforces.
func slackRedirectURI(siteOrigin string) string {
	return siteOrigin + "/auth/callback/slack"
}

// CreateTeamSlackConnectURL creates a Slack OAuth authorize URL for a team the
// caller owns. The signed state embedded in it is the only authorization
// /slack/connect trusts, so this authenticated endpoint is the one point in
// the flow that checks who is asking.
func (h Handlers) CreateTeamSlackConnectURL(c *gin.Context) {
	deps := h.Deps
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if ok, err := measure.PerformAuthz(deps.PgPool, userId, teamId.String(), *measure.ScopeTeamAll); err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	} else if !ok {
		msg := fmt.Sprintf(`you don't have permissions for team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	if deps.Config.SlackClientID == "" || deps.Config.SlackOAuthStateSecret == "" {
		fmt.Println("slack connect url: Slack integration is not configured")
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Slack integration is not configured"})
		return
	}

	state, err := signSlackState(deps.Config.SlackOAuthStateSecret, teamId.String(), time.Now())
	if err != nil {
		msg := "failed to build Slack connect url"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	authorizeURL := url.URL{Scheme: "https", Host: "slack.com", Path: "/oauth/v2/authorize"}
	q := authorizeURL.Query()
	q.Set("client_id", deps.Config.SlackClientID)
	q.Set("scope", strings.Join(slackRequiredScopes, ","))
	q.Set("redirect_uri", slackRedirectURI(deps.Config.SiteOrigin))
	q.Set("state", state)
	authorizeURL.RawQuery = q.Encode()

	c.JSON(http.StatusOK, gin.H{"url": authorizeURL.String()})
}

func (h Handlers) ConnectTeamSlack(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()

	type slackOAuthRequest struct {
		Code  string `json:"code" binding:"required"`
		State string `json:"state" binding:"required"`
	}

	var req slackOAuthRequest
	msg := "failed to connect Slack app"

	if err := c.ShouldBindJSON(&req); err != nil {
		fmt.Println(msg, err)
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"error": "missing or invalid request body",
		})
		return
	}

	if deps.Config.SlackOAuthStateSecret == "" {
		fmt.Println(msg, "SLACK_OAUTH_STATE_SECRET is not configured")
		c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "Slack integration is not configured"})
		return
	}

	// The signed state is the authorization: it was created only for an
	// authenticated owner of this team and the team to connect comes from it.
	teamID, err := verifySlackState(deps.Config.SlackOAuthStateSecret, req.State, time.Now())
	if err != nil {
		fmt.Println(msg, "invalid state:", err)
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired state"})
		return
	}

	// Exchange code with Slack
	client := &http.Client{Timeout: 30 * time.Second}
	data := url.Values{}
	data.Set("client_id", deps.Config.SlackClientID)
	data.Set("client_secret", deps.Config.SlackClientSecret)
	data.Set("code", req.Code)
	// Slack requires redirect_uri here to match the authorize step exactly
	data.Set("redirect_uri", slackRedirectURI(deps.Config.SiteOrigin))

	slackReq, err := http.NewRequestWithContext(ctx, "POST", slackAccessURL, strings.NewReader(data.Encode()))
	if err != nil {
		fmt.Println(msg, "failed to create request:", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	slackReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := client.Do(slackReq)
	if err != nil {
		fmt.Println(msg, "failed to exchange code:", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		fmt.Println(msg, "Slack API returned status:", resp.StatusCode)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	// Parse Slack response
	type slackResponse struct {
		OK          bool   `json:"ok"`
		Error       string `json:"error,omitempty"`
		AccessToken string `json:"access_token"`
		Scope       string `json:"scope"`
		BotUserID   string `json:"bot_user_id"`
		AppID       string `json:"app_id"`
		Team        struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"team"`
		Enterprise struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"enterprise"`
	}

	var slackResp slackResponse
	if err := json.NewDecoder(resp.Body).Decode(&slackResp); err != nil {
		fmt.Println(msg, "failed to decode Slack response:", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !slackResp.OK {
		errMsg := "Slack OAuth failed"
		if slackResp.Error != "" {
			errMsg = fmt.Sprintf("Slack OAuth failed: %s", slackResp.Error)
		}
		fmt.Println(msg, errMsg)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	// Save Slack integration details to the database. channel_ids is not
	// written here: a first connect gets the column default (empty array) and
	// a reconnect keeps the channels the team already subscribed.
	stmt := sqlf.PostgreSQL.
		InsertInto("measure.team_slack").
		Set("team_id", teamID).
		Set("slack_team_id", slackResp.Team.ID).
		Set("slack_team_name", slackResp.Team.Name).
		Set("enterprise_id", slackResp.Enterprise.ID).
		Set("enterprise_name", slackResp.Enterprise.Name).
		Set("bot_token", slackResp.AccessToken).
		Set("bot_user_id", slackResp.BotUserID).
		Set("slack_app_id", slackResp.AppID).
		Set("scopes", slackResp.Scope).
		Set("is_active", true).
		Set("created_at", time.Now()).
		Set("updated_at", time.Now())

	query := stmt.String() + ` ON CONFLICT (team_id) DO UPDATE SET
		slack_team_id = EXCLUDED.slack_team_id,
		slack_team_name = EXCLUDED.slack_team_name,
		enterprise_id = EXCLUDED.enterprise_id,
		enterprise_name = EXCLUDED.enterprise_name,
		bot_token = EXCLUDED.bot_token,
		bot_user_id = EXCLUDED.bot_user_id,
		slack_app_id = EXCLUDED.slack_app_id,
		scopes = EXCLUDED.scopes,
		is_active = EXCLUDED.is_active,
		updated_at = NOW()`

	if _, err := deps.PgPool.Exec(ctx, query, stmt.Args()...); err != nil {
		// The upsert arbitrates only on team_id; a unique violation on
		// slack_team_id means the workspace is connected to a different team.
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == "team_slack_slack_team_id_key" {
			fmt.Println(msg, "workspace already connected to another team:", slackResp.Team.ID)
			c.AbortWithStatusJSON(http.StatusConflict, gin.H{
				"error": "This Slack workspace is already connected to a different Measure team. Remove the connection there first, then try again.",
			})
			return
		}
		fmt.Println(msg, "failed to save Slack integration:", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	response := gin.H{
		"team_id":         teamID,
		"slack_team_name": slackResp.Team.Name,
	}

	c.JSON(http.StatusOK, response)
}

func (h Handlers) GetTeamSlack(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if ok, err := measure.PerformAuthz(deps.PgPool, userId, teamId.String(), *measure.ScopeTeamRead); err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	} else if !ok {
		msg := fmt.Sprintf(`you don't have permissions for team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	var team = new(measure.Team)
	team.ID = &teamId

	stmt := sqlf.PostgreSQL.
		From(`team_slack`).
		Select("slack_team_name").
		Select("is_active").
		Select("scopes").
		Where("team_id = ?", team.ID)

	defer stmt.Close()

	var result = new(TeamSlack)
	err = deps.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&result.SlackTeamName, &result.IsActive, &result.Scopes)
	if err != nil {
		if err == pgx.ErrNoRows {
			c.JSON(http.StatusOK, nil)
			return
		}
		msg := fmt.Sprintf("error occurred while querying team slack: %s", teamId)
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	result.NeedsReauth = slackConnectionNeedsReauth(result.Scopes)

	c.JSON(http.StatusOK, result)
}

func (h Handlers) UpdateTeamSlackStatus(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if ok, err := measure.PerformAuthz(deps.PgPool, userId, teamId.String(), *measure.ScopeTeamAll); err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	} else if !ok {
		msg := fmt.Sprintf(`you don't have permissions for team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	var payload struct {
		IsActive bool `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		msg := `invalid request payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	stmt := sqlf.PostgreSQL.
		Update("team_slack").
		Set("is_active", payload.IsActive).
		Where("team_id = ?", teamId)

	defer stmt.Close()

	commandTag, err := deps.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		msg := fmt.Sprintf("error occurred while updating team slack: %s", teamId)
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if commandTag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "no slack integration found for the team"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": "done"})
}

// DeleteTeamSlack removes a team's Slack integration. It only deletes our
// record, including the stored bot token and subscribed channels; the Measure
// app stays installed in the Slack workspace until someone removes it there.
func (h Handlers) DeleteTeamSlack(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if ok, err := measure.PerformAuthz(deps.PgPool, userId, teamId.String(), *measure.ScopeTeamAll); err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	} else if !ok {
		msg := fmt.Sprintf(`you don't have permissions for team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	stmt := sqlf.PostgreSQL.
		DeleteFrom("team_slack").
		Where("team_id = ?", teamId)

	defer stmt.Close()

	commandTag, err := deps.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		msg := fmt.Sprintf("error occurred while deleting team slack: %s", teamId)
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if commandTag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "no slack integration found for the team"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": "done"})
}

func (h Handlers) SendTestSlackAlert(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if ok, err := measure.PerformAuthz(deps.PgPool, userId, teamId.String(), *measure.ScopeTeamAll); err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	} else if !ok {
		msg := fmt.Sprintf(`you don't have permissions for team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	var slackTeamName string
	var botToken string
	var channelIds []string
	stmt := sqlf.PostgreSQL.
		From("team_slack").
		Select("slack_team_name").
		Select("bot_token").
		Select("channel_ids").
		Where("team_id = ?", teamId)

	defer stmt.Close()

	err = deps.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&slackTeamName, &botToken, &channelIds)
	if err != nil {
		msg := fmt.Sprintf("error occurred while querying team slack: %s", teamId)
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if len(channelIds) == 0 {
		msg := fmt.Sprintf("No registered alert channels found for Workspace %s. Please add Measure app to a channel and use /subscribe-alerts", slackTeamName)
		fmt.Println(msg)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	err = sendTestSlackMessages(botToken, channelIds)

	if err != nil {
		msg := fmt.Sprintf("Failed to send test Slack alert messages for workspace %s: %s", slackTeamName, err)
		fmt.Println(msg)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("%s", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": "done"})
}

func sendTestSlackMessages(botToken string, channelIds []string) error {
	// We'll try to fetch channel names via conversations.info and include them
	// in the success/failure message. If fetching the name fails, we fall back
	// to using the channel ID.
	url := "https://slack.com/api/chat.postMessage"

	var failed []struct {
		ChannelID   string
		ChannelName string
		Reason      string
	}
	var succeeded []string // formatted as "channel_name - channel_id"

	for _, channelID := range channelIds {
		channelName := getSlackChannelName(botToken, channelID)

		payload := map[string]any{
			"channel": channelID,
			"text":    "This is a test alert message from Measure. If you are receiving this message, your Slack alert integration is working correctly on this channel!",
		}

		payloadBytes, err := json.Marshal(payload)
		if err != nil {
			msg := fmt.Sprintf("failed to marshal Slack message payload: %s", err)
			fmt.Println(channelID + ": " + msg)
			failed = append(failed, struct{ ChannelID, ChannelName, Reason string }{ChannelID: channelID, ChannelName: channelName, Reason: msg})
			continue
		}

		req, err := http.NewRequest("POST", url, bytes.NewReader(payloadBytes))
		if err != nil {
			msg := fmt.Sprintf("failed to create HTTP request: %s", err)
			fmt.Println(channelID + ": " + msg)
			failed = append(failed, struct{ ChannelID, ChannelName, Reason string }{ChannelID: channelID, ChannelName: channelName, Reason: msg})
			continue
		}
		req.Header.Set("Content-Type", "application/json; charset=utf-8")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", botToken))

		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			msg := fmt.Sprintf("failed to send Slack message: %s", err)
			fmt.Println(channelID + ": " + msg)
			failed = append(failed, struct{ ChannelID, ChannelName, Reason string }{ChannelID: channelID, ChannelName: channelName, Reason: msg})
			continue
		}

		// ensure body is closed for this response
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			msg := fmt.Sprintf("failed to send slack message, slack response status: %d", resp.StatusCode)
			// include response body for more context where available
			if len(body) > 0 {
				msg = fmt.Sprintf("%s; body: %s", msg, string(body))
			}
			fmt.Println(channelID + ": " + msg)
			failed = append(failed, struct{ ChannelID, ChannelName, Reason string }{ChannelID: channelID, ChannelName: channelName, Reason: msg})
			continue
		}

		// Slack API call succeeded, but check if Slack returned an error in the response body
		var slackResponse struct {
			OK    bool   `json:"ok"`
			Error string `json:"error"`
		}
		if err := json.Unmarshal(body, &slackResponse); err != nil {
			msg := fmt.Sprintf("failed to decode Slack API response: %s", err)
			fmt.Println(channelID + ": " + msg)
			failed = append(failed, struct{ ChannelID, ChannelName, Reason string }{ChannelID: channelID, ChannelName: channelName, Reason: msg})
			continue
		}

		if !slackResponse.OK {
			msg := fmt.Sprintf("slack API error: %s", slackResponse.Error)
			fmt.Println(channelID + ": " + msg)
			failed = append(failed, struct{ ChannelID, ChannelName, Reason string }{ChannelID: channelID, ChannelName: channelName, Reason: msg})
			continue
		}

		succeeded = append(succeeded, fmt.Sprintf("%s - %s", channelName, channelID))
	}

	if len(failed) > 0 {
		var b strings.Builder
		if len(succeeded) > 0 {
			b.WriteString("Successes: {")
			b.WriteString(strings.Join(succeeded, ", "))
			b.WriteString("}")
		}

		if len(succeeded) > 0 {
			b.WriteString(" | ")
		}
		b.WriteString("Failures: {")
		var parts []string
		for _, f := range failed {
			// format as: [channel_name - channel_id: reason]
			parts = append(parts, fmt.Sprintf("[%s - %s: %s]", f.ChannelName, f.ChannelID, f.Reason))
		}
		b.WriteString(strings.Join(parts, ", "))
		b.WriteString("}")
		result := b.String()
		return fmt.Errorf("%s", result)
	}

	return nil
}

// getSlackChannelName tries to fetch the channel name via conversations.info using
// the provided bot token. If anything goes wrong we fall back to returning the
// channel ID so callers can still show a usable identifier.
func getSlackChannelName(botToken, channelID string) string {
	// build URL with query param
	infoURL := fmt.Sprintf("https://slack.com/api/conversations.info?channel=%s", url.QueryEscape(channelID))
	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("GET", infoURL, nil)
	if err != nil {
		return channelID
	}
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", botToken))

	resp, err := client.Do(req)
	if err != nil {
		return channelID
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return channelID
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return channelID
	}

	var res struct {
		OK      bool `json:"ok"`
		Channel struct {
			Name string `json:"name"`
		} `json:"channel"`
		Error string `json:"error"`
	}
	if err := json.Unmarshal(body, &res); err != nil {
		return channelID
	}
	if !res.OK || res.Channel.Name == "" {
		return channelID
	}
	return res.Channel.Name
}

// ----------------------------------------------------------------------------
// OAuth state
//
// The Slack OAuth state is HMAC-signed with the server's secret so
// /slack/connect can trust the teamId without any body-supplied identity: only
// an authenticated owner of the team can obtain a signed state (via
// CreateTeamSlackConnectURL), and it can't be forged without the secret.
// ----------------------------------------------------------------------------

// slackStateTTL is how long a created Slack OAuth state stays valid. It bounds
// the window between a user clicking "Connect" and Slack redirecting back.
const slackStateTTL = 10 * time.Minute

// slackState is the payload carried in the Slack OAuth state parameter.
type slackState struct {
	TeamID string `json:"team_id"`
	Nonce  string `json:"nonce"`
	Exp    int64  `json:"exp"`
}

var (
	errSlackStateMalformed = errors.New("malformed slack oauth state")
	errSlackStateBadSig    = errors.New("slack oauth state signature mismatch")
	errSlackStateExpired   = errors.New("slack oauth state expired")
)

// signSlackState returns a signed, URL-safe state binding teamID, expiring at
// now+slackStateTTL. secret must be non-empty.
func signSlackState(secret, teamID string, now time.Time) (string, error) {
	nonce := make([]byte, 16)
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}

	payload, err := json.Marshal(slackState{
		TeamID: teamID,
		Nonce:  hex.EncodeToString(nonce),
		Exp:    now.Add(slackStateTTL).Unix(),
	})
	if err != nil {
		return "", err
	}

	body := base64.RawURLEncoding.EncodeToString(payload)
	return body + "." + slackStateMAC(secret, body), nil
}

// verifySlackState checks the signature and freshness of a state and returns
// the teamID it binds. secret must match the one used to sign.
func verifySlackState(secret, token string, now time.Time) (string, error) {
	body, mac, ok := strings.Cut(token, ".")
	if !ok {
		return "", errSlackStateMalformed
	}

	if !hmac.Equal([]byte(mac), []byte(slackStateMAC(secret, body))) {
		return "", errSlackStateBadSig
	}

	payload, err := base64.RawURLEncoding.DecodeString(body)
	if err != nil {
		return "", errSlackStateMalformed
	}

	var s slackState
	if err := json.Unmarshal(payload, &s); err != nil {
		return "", errSlackStateMalformed
	}
	if s.TeamID == "" {
		return "", errSlackStateMalformed
	}
	if now.Unix() > s.Exp {
		return "", errSlackStateExpired
	}

	return s.TeamID, nil
}

// slackStateMAC computes the base64url HMAC-SHA256 of body under secret.
func slackStateMAC(secret, body string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(body))
	return base64.RawURLEncoding.EncodeToString(h.Sum(nil))
}
