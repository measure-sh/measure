package measure

import (
	"backend/api/server"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/leporo/sqlf"
)

type TeamSlack struct {
	SlackTeamName string `json:"slack_team_name"`
	IsActive      bool   `json:"is_active"`
}

func ConnectTeamSlack(c *gin.Context) {
	ctx := c.Request.Context()

	type slackOAuthRequest struct {
		Code   string `json:"code" binding:"required"`
		UserId string `json:"userId" binding:"required"`
		TeamId string `json:"teamId" binding:"required"`
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

	if ok, err := PerformAuthz(req.UserId, req.TeamId, *ScopeTeamAll); err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	} else if !ok {
		msg := fmt.Sprintf(`you don't have permissions for team [%s]`, req.TeamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	if req.Code == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"error": "missing authorization code",
		})
		return
	}

	// Exchange code with Slack
	client := &http.Client{Timeout: 30 * time.Second}
	data := url.Values{}
	data.Set("client_id", server.Server.Config.SlackClientID)
	data.Set("client_secret", server.Server.Config.SlackClientSecret)
	data.Set("code", req.Code)

	slackReq, err := http.NewRequestWithContext(ctx, "POST", "https://slack.com/api/oauth.v2.access", strings.NewReader(data.Encode()))
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
		} `json:"enterprise,omitempty"`
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

	// Save Slack integration details to the database
	stmt := sqlf.PostgreSQL.
		InsertInto("measure.team_slack").
		Set("team_id", req.TeamId).
		Set("slack_team_id", slackResp.Team.ID).
		Set("slack_team_name", slackResp.Team.Name).
		Set("enterprise_id", slackResp.Enterprise.ID).
		Set("enterprise_name", slackResp.Enterprise.Name).
		Set("bot_token", slackResp.AccessToken).
		Set("bot_user_id", slackResp.BotUserID).
		Set("slack_app_id", slackResp.AppID).
		Set("scopes", slackResp.Scope).
		Set("channel_ids", pgtype.Array[string]{}).
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
		channel_ids = EXCLUDED.channel_ids,
		is_active = EXCLUDED.is_active,
		updated_at = NOW()`

	if _, err := server.Server.PgPool.Exec(ctx, query, stmt.Args()...); err != nil {
		fmt.Println(msg, "failed to save Slack integration:", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	response := gin.H{
		"slack_team_name": slackResp.Team.Name,
	}

	c.JSON(http.StatusOK, response)
}

func GetTeamSlack(c *gin.Context) {
	ctx := c.Request.Context()
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if ok, err := PerformAuthz(userId, teamId.String(), *ScopeTeamRead); err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	} else if !ok {
		msg := fmt.Sprintf(`you don't have permissions for team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	var team = new(Team)
	team.ID = &teamId

	stmt := sqlf.PostgreSQL.
		From(`team_slack`).
		Select("slack_team_name").
		Select("is_active").
		Where("team_id = ?", team.ID)

	defer stmt.Close()

	var result = new(TeamSlack)
	err = server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&result.SlackTeamName, &result.IsActive)
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

	c.JSON(http.StatusOK, result)
}

func UpdateTeamSlackStatus(c *gin.Context) {
	ctx := c.Request.Context()
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if ok, err := PerformAuthz(userId, teamId.String(), *ScopeTeamAll); err != nil {
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

	commandTag, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
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

func SendTestSlackAlert(c *gin.Context) {
	ctx := c.Request.Context()
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if ok, err := PerformAuthz(userId, teamId.String(), *ScopeTeamAll); err != nil {
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

	err = server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&slackTeamName, &botToken, &channelIds)
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

func HandleSlackEvents(c *gin.Context) {

	var payload struct {
		Command     string `form:"command"`
		SlackTeamID string `form:"team_id"`
		ChannelID   string `form:"channel_id"`
		Text        string `form:"text"`
		UserID      string `form:"user_id"`
		SSLCheck    string `form:"ssl_check"`
	}

	if err := c.ShouldBind(&payload); err != nil {
		msg := `invalid request payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	// Handle SSL check requests from Slack
	if payload.SSLCheck == "1" {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
		return
	}

	// Log the received command
	fmt.Printf("Received Slack command [%s] for team [%s] in channel [%s] from user [%s]\n",
		payload.Command, payload.SlackTeamID, payload.ChannelID, payload.UserID)

	// Route to appropriate handler based on command
	switch payload.Command {
	case "/subscribe-alerts":
		handleSubscribeAlerts(c, payload.SlackTeamID, payload.ChannelID)
	case "/stop-alerts":
		handleStopAlerts(c, payload.SlackTeamID, payload.ChannelID)
	case "/list-alert-channels":
		handleGetActiveAlertChannels(c, payload.SlackTeamID)
	default:
		c.JSON(http.StatusOK, gin.H{
			"response_type": "in_channel",
			"text":          fmt.Sprintf("Unknown command: %s\nAvailable commands:\n• `/get-alerts` - List active alert channels\n• `/register-alerts` - Register this channel for alerts\n• `/stop-alerts` - Stop alerts for this channel", payload.Command),
		})
	}
}

func handleSubscribeAlerts(c *gin.Context, slackTeamID, channelID string) {
	ctx := c.Request.Context()

	// First check if channel already exists
	var exists int
	checkSQL := "SELECT 1 FROM team_slack WHERE slack_team_id = $1 AND $2 = ANY(channel_ids)"
	err := server.Server.PgPool.QueryRow(ctx, checkSQL, slackTeamID, channelID).Scan(&exists)
	if err == nil {
		c.JSON(http.StatusOK, gin.H{
			"response_type": "in_channel",
			"text":          "Channel is already registered for alert notifications!",
		})
		return
	}

	updateSQL := "UPDATE team_slack SET channel_ids = array_append(channel_ids, $1) WHERE slack_team_id = $2"
	commandTag, err := server.Server.PgPool.Exec(ctx, updateSQL, channelID, slackTeamID)
	if err != nil {
		msg := fmt.Sprintf("error occurred while updating Slack team channels: %s", slackTeamID)
		fmt.Println(msg, err)
		c.JSON(http.StatusOK, gin.H{
			"response_type": "in_channel",
			"text":          "Failed to register channel for alert notifications. Please check your slack integration in the Measure dashboard.",
		})
		return
	}

	if commandTag.RowsAffected() == 0 {
		c.JSON(http.StatusOK, gin.H{
			"response_type": "in_channel",
			"text":          "Failed to register channel for alert notifications. Please check your slack integration in the Measure dashboard.",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"response_type": "in_channel",
		"text":          "Channel successfully registered to receive alert notifications!",
	})
}

func handleStopAlerts(c *gin.Context, slackTeamID, channelID string) {
	ctx := c.Request.Context()

	updateSQL := "UPDATE team_slack SET channel_ids = array_remove(channel_ids, $1) WHERE slack_team_id = $2"
	commandTag, err := server.Server.PgPool.Exec(ctx, updateSQL, channelID, slackTeamID)
	if err != nil {
		msg := fmt.Sprintf("error occurred while updating Slack team channels: %s", slackTeamID)
		fmt.Println(msg, err)
		c.JSON(http.StatusOK, gin.H{
			"response_type": "in_channel",
			"text":          "Failed to unregister channel for alert notifications. Please check your slack integration in the Measure dashboard.",
		})
		return
	}

	if commandTag.RowsAffected() == 0 {
		c.JSON(http.StatusOK, gin.H{
			"response_type": "in_channel",
			"text":          "Failed to unregister channel for alert notifications. Please check your slack integration in the Measure dashboard.",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"response_type": "in_channel",
		"text":          "Channel successfully unregistered from alert notifications!",
	})
}

func handleGetActiveAlertChannels(c *gin.Context, slackTeamID string) {
	ctx := c.Request.Context()

	selectSQL := "SELECT channel_ids FROM team_slack WHERE slack_team_id = $1"
	var channelIDs []string
	err := server.Server.PgPool.QueryRow(ctx, selectSQL, slackTeamID).Scan(&channelIDs)
	if err != nil {
		msg := fmt.Sprintf("error occurred while fetching Slack team channels: %s", slackTeamID)
		fmt.Println(msg, err)
		c.JSON(http.StatusOK, gin.H{
			"response_type": "in_channel",
			"text":          "Failed to fetch channels. Please check your slack integration in the Measure dashboard.",
		})
		return
	}

	if len(channelIDs) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"response_type": "in_channel",
			"text":          "No channels are currently registered for alert notifications.",
		})
		return
	}

	formattedChannels := "<#" + strings.Join(channelIDs, ">, <#") + ">"

	c.JSON(http.StatusOK, gin.H{
		"response_type": "in_channel",
		"text":          fmt.Sprintf("Active alert channels: %s", formattedChannels),
	})
}
