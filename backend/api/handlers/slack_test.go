//go:build integration

package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// withSlackConfig sets the Slack-related config for the duration of a test.
func withSlackConfig(t *testing.T, clientID, stateSecret, siteOrigin string) {
	t.Helper()
	cfg := deps.Config
	origClient, origSecret, origOrigin := cfg.SlackClientID, cfg.SlackOAuthStateSecret, cfg.SiteOrigin
	cfg.SlackClientID = clientID
	cfg.SlackOAuthStateSecret = stateSecret
	cfg.SiteOrigin = siteOrigin
	t.Cleanup(func() {
		cfg.SlackClientID = origClient
		cfg.SlackOAuthStateSecret = origSecret
		cfg.SiteOrigin = origOrigin
	})
}

func TestCreateTeamSlackConnectURL(t *testing.T) {
	ctx := context.Background()

	t.Run("owner gets an authorize url carrying a valid state", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		withSlackConfig(t, "client-123", "state-secret", "https://app.example.com")

		ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/slack/connect-url", nil)
		c.Set("userId", ownerID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		h.CreateTeamSlackConnectURL(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		var body struct {
			URL string `json:"url"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		u, err := url.Parse(body.URL)
		if err != nil {
			t.Fatalf("parse url %q: %v", body.URL, err)
		}
		if u.Host != "slack.com" || u.Path != "/oauth/v2/authorize" {
			t.Errorf("authorize url = %s, want slack.com/oauth/v2/authorize", body.URL)
		}
		q := u.Query()
		if q.Get("client_id") != "client-123" {
			t.Errorf("client_id = %q", q.Get("client_id"))
		}
		if q.Get("redirect_uri") != "https://app.example.com/auth/callback/slack" {
			t.Errorf("redirect_uri = %q", q.Get("redirect_uri"))
		}
		if q.Get("scope") == "" {
			t.Error("scope is empty")
		}
		// the embedded state must verify and bind this team
		gotTeam, err := verifySlackState("state-secret", q.Get("state"), time.Now())
		if err != nil {
			t.Fatalf("verify embedded state: %v", err)
		}
		if gotTeam != teamID.String() {
			t.Errorf("state team = %q, want %q", gotTeam, teamID)
		}
	})

	// connecting Slack needs ScopeTeamAll, which only owner holds
	for _, role := range []string{"admin", "developer", "viewer"} {
		t.Run(role+" is forbidden", func(t *testing.T) {
			defer cleanupAll(ctx, t)
			withSlackConfig(t, "client-123", "state-secret", "https://app.example.com")

			userID, teamID := seedTeamAndMemberWithRole(t, ctx, role)

			c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/slack/connect-url", nil)
			c.Set("userId", userID)
			c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
			h.CreateTeamSlackConnectURL(c)

			if w.Code != http.StatusForbidden {
				t.Fatalf("role %s: status = %d, want 403, body: %s", role, w.Code, w.Body.String())
			}
		})
	}

	t.Run("a non-member cannot get a url", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		withSlackConfig(t, "client-123", "state-secret", "https://app.example.com")

		// a team the caller has no membership in
		_, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		outsiderID := uuid.New().String()

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/slack/connect-url", nil)
		c.Set("userId", outsiderID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		h.CreateTeamSlackConnectURL(c)

		// PerformAuthz denies an unknown role, so a non-member gets 403
		if w.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403 for non-member, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("unconfigured slack gives 503", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		withSlackConfig(t, "", "", "https://app.example.com")

		ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/slack/connect-url", nil)
		c.Set("userId", ownerID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		h.CreateTeamSlackConnectURL(c)

		if w.Code != http.StatusServiceUnavailable {
			t.Fatalf("status = %d, want 503, body: %s", w.Code, w.Body.String())
		}
	})
}

func newConnectContext(body string) (*gin.Context, *httptest.ResponseRecorder) {
	c, w := newTestGinContext("POST", "/slack/connect", bytes.NewBufferString(body))
	return c, w
}

func TestConnectTeamSlackRejectsBadState(t *testing.T) {
	ctx := context.Background()

	t.Run("forged state is rejected with 401", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		withSlackConfig(t, "client-123", "state-secret", "https://app.example.com")

		// a state signed with a different secret must not be accepted
		forged, err := signSlackState("attacker-secret", uuid.New().String(), time.Now())
		if err != nil {
			t.Fatalf("sign: %v", err)
		}
		c, w := newConnectContext(fmt.Sprintf(`{"code":"abc","state":%q}`, forged))
		h.ConnectTeamSlack(c)

		if w.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, want 401, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("missing state is rejected with 400", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		withSlackConfig(t, "client-123", "state-secret", "https://app.example.com")

		c, w := newConnectContext(`{"code":"abc"}`)
		h.ConnectTeamSlack(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("unconfigured slack gives 503", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		withSlackConfig(t, "client-123", "", "https://app.example.com")

		valid, err := signSlackState("state-secret", uuid.New().String(), time.Now())
		if err != nil {
			t.Fatalf("sign: %v", err)
		}
		c, w := newConnectContext(fmt.Sprintf(`{"code":"abc","state":%q}`, valid))
		h.ConnectTeamSlack(c)

		if w.Code != http.StatusServiceUnavailable {
			t.Fatalf("status = %d, want 503, body: %s", w.Code, w.Body.String())
		}
	})
}

// --------------------------------------------------------------------------
// OAuth state helpers
// --------------------------------------------------------------------------

func TestSlackStateRoundTrip(t *testing.T) {
	secret := "test-secret"
	teamID := "11111111-1111-1111-1111-111111111111"
	now := time.Unix(1_700_000_000, 0)

	token, err := signSlackState(secret, teamID, now)
	if err != nil {
		t.Fatalf("signSlackState: %v", err)
	}

	got, err := verifySlackState(secret, token, now)
	if err != nil {
		t.Fatalf("verifySlackState: %v", err)
	}
	if got != teamID {
		t.Errorf("teamID = %q, want %q", got, teamID)
	}
}

func TestSlackStateRejections(t *testing.T) {
	secret := "test-secret"
	teamID := "11111111-1111-1111-1111-111111111111"
	now := time.Unix(1_700_000_000, 0)

	token, err := signSlackState(secret, teamID, now)
	if err != nil {
		t.Fatalf("signSlackState: %v", err)
	}

	t.Run("wrong secret", func(t *testing.T) {
		if _, err := verifySlackState("other-secret", token, now); !errors.Is(err, errSlackStateBadSig) {
			t.Errorf("err = %v, want errSlackStateBadSig", err)
		}
	})

	t.Run("tampered payload", func(t *testing.T) {
		body, mac, _ := strings.Cut(token, ".")
		// flip a character in the payload; the mac no longer matches
		forged := body[:len(body)-1] + flipChar(body[len(body)-1]) + "." + mac
		if _, err := verifySlackState(secret, forged, now); !errors.Is(err, errSlackStateBadSig) {
			t.Errorf("err = %v, want errSlackStateBadSig", err)
		}
	})

	t.Run("tampered signature", func(t *testing.T) {
		body, mac, _ := strings.Cut(token, ".")
		forged := body + "." + mac[:len(mac)-1] + flipChar(mac[len(mac)-1])
		if _, err := verifySlackState(secret, forged, now); !errors.Is(err, errSlackStateBadSig) {
			t.Errorf("err = %v, want errSlackStateBadSig", err)
		}
	})

	t.Run("expired", func(t *testing.T) {
		later := now.Add(slackStateTTL + time.Second)
		if _, err := verifySlackState(secret, token, later); !errors.Is(err, errSlackStateExpired) {
			t.Errorf("err = %v, want errSlackStateExpired", err)
		}
	})

	t.Run("malformed", func(t *testing.T) {
		for _, s := range []string{"", "nodot", "not-base64.sig", "."} {
			if _, err := verifySlackState(secret, s, now); err == nil {
				t.Errorf("verifySlackState(%q) = nil, want error", s)
			}
		}
	})
}

func TestSlackConnectionNeedsReauth(t *testing.T) {
	full := strings.Join(slackRequiredScopes, ",")

	cases := []struct {
		name    string
		granted string
		want    bool
	}{
		{"empty is unknown, no prompt", "", false},
		{"all scopes present", full, false},
		{"all present with spaces", strings.ReplaceAll(full, ",", ", "), false},
		{"missing one scope", strings.Join(slackRequiredScopes[1:], ","), true},
		{"unrelated scope only", "channels:read", true},
		{"extra scopes do not prompt, slack grants cannot shrink", full + ",team:read", false},
		{"duplicate and trailing comma are not extras", full + "," + slackRequiredScopes[0] + ",", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := slackConnectionNeedsReauth(c.granted); got != c.want {
				t.Errorf("slackConnectionNeedsReauth(%q) = %v, want %v", c.granted, got, c.want)
			}
		})
	}
}

func flipChar(b byte) string {
	if b == 'A' {
		return "B"
	}
	return "A"
}

// --------------------------------------------------------------------------
// ConnectTeamSlack happy path
// --------------------------------------------------------------------------

// withSlackAccessURL points the Slack token exchange at a stub for a test.
func withSlackAccessURL(t *testing.T, u string) {
	t.Helper()
	orig := slackAccessURL
	slackAccessURL = u
	t.Cleanup(func() { slackAccessURL = orig })
}

func TestConnectTeamSlackHappyPath(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	withSlackConfig(t, "client-123", "state-secret", "https://app.example.com")

	// stub Slack's oauth.v2.access, capturing the redirect_uri it receives
	var gotRedirectURI, gotCode string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		gotRedirectURI = r.FormValue("redirect_uri")
		gotCode = r.FormValue("code")
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":           true,
			"access_token": "xoxb-test",
			"scope":        "chat:write",
			"bot_user_id":  "U1",
			"app_id":       "A1",
			"team":         map[string]string{"id": "T-slack", "name": "Acme Workspace"},
		})
	}))
	defer srv.Close()
	withSlackAccessURL(t, srv.URL)

	teamID := uuid.New()
	seedTeam(ctx, t, teamID, testTeamName)

	// a state bound to teamID is the only thing identifying the team
	state, err := signSlackState("state-secret", teamID.String(), time.Now())
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	c, w := newConnectContext(fmt.Sprintf(`{"code":"the-code","state":%q}`, state))
	h.ConnectTeamSlack(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
	}

	var body struct {
		TeamID        string `json:"team_id"`
		SlackTeamName string `json:"slack_team_name"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body.TeamID != teamID.String() {
		t.Errorf("team_id = %q, want %q (from the state)", body.TeamID, teamID)
	}
	if body.SlackTeamName != "Acme Workspace" {
		t.Errorf("slack_team_name = %q, want Acme Workspace", body.SlackTeamName)
	}

	// the exchange must send code and the same redirect_uri as the authorize step
	if gotCode != "the-code" {
		t.Errorf("exchanged code = %q, want the-code", gotCode)
	}
	if gotRedirectURI != "https://app.example.com/auth/callback/slack" {
		t.Errorf("exchange redirect_uri = %q, want the authorize value", gotRedirectURI)
	}

	// the integration is persisted against the team named in the state
	var savedName string
	if err := th.PgPool.QueryRow(ctx,
		`SELECT slack_team_name FROM team_slack WHERE team_id = $1`, teamID).Scan(&savedName); err != nil {
		t.Fatalf("read saved team_slack: %v", err)
	}
	if savedName != "Acme Workspace" {
		t.Errorf("saved slack_team_name = %q, want Acme Workspace", savedName)
	}

	// a first connect gets the channel_ids column default: an empty array
	var emptyNotNull bool
	if err := th.PgPool.QueryRow(ctx,
		`SELECT channel_ids IS NOT NULL AND channel_ids = '{}' FROM team_slack WHERE team_id = $1`, teamID).Scan(&emptyNotNull); err != nil {
		t.Fatalf("read channel_ids: %v", err)
	}
	if !emptyNotNull {
		t.Error("channel_ids should be an empty array, not NULL")
	}
}

func TestConnectTeamSlackReconnectPreservesChannels(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	withSlackConfig(t, "client-123", "state-secret", "https://app.example.com")

	// stub Slack's oauth.v2.access returning a fresh token and scopes
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":           true,
			"access_token": "xoxb-new",
			"scope":        "chat:write,channels:read",
			"bot_user_id":  "U1",
			"app_id":       "A1",
			"team":         map[string]string{"id": "T-slack", "name": "Acme Workspace"},
		})
	}))
	defer srv.Close()
	withSlackAccessURL(t, srv.URL)

	teamID := uuid.New()
	seedTeam(ctx, t, teamID, testTeamName)

	// an existing paused integration for the same workspace with subscribed channels
	if _, err := th.PgPool.Exec(ctx,
		`INSERT INTO team_slack
		 (team_id, slack_team_id, slack_team_name, bot_token, bot_user_id, channel_ids, scopes, is_active, created_at, updated_at)
		 VALUES ($1, 'T-slack', 'Acme Workspace', 'xoxb-old', 'U1', $2, 'chat:write', false, now(), now())`,
		teamID, []string{"C1", "C2"}); err != nil {
		t.Fatalf("seed team_slack: %v", err)
	}

	state, err := signSlackState("state-secret", teamID.String(), time.Now())
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	c, w := newConnectContext(fmt.Sprintf(`{"code":"the-code","state":%q}`, state))
	h.ConnectTeamSlack(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
	}

	var botToken, scopes string
	var channels []string
	var isActive bool
	if err := th.PgPool.QueryRow(ctx,
		`SELECT bot_token, scopes, channel_ids, is_active FROM team_slack WHERE team_id = $1`, teamID).
		Scan(&botToken, &scopes, &channels, &isActive); err != nil {
		t.Fatalf("read team_slack after reconnect: %v", err)
	}
	if botToken != "xoxb-new" {
		t.Errorf("bot_token = %q, want xoxb-new", botToken)
	}
	if scopes != "chat:write,channels:read" {
		t.Errorf("scopes = %q, want the refreshed grant", scopes)
	}
	if !isActive {
		t.Error("is_active = false, want reconnect to re-enable the integration")
	}
	if len(channels) != 2 || channels[0] != "C1" || channels[1] != "C2" {
		t.Errorf("channel_ids = %v, want [C1 C2] preserved across reconnect", channels)
	}
}

func TestConnectTeamSlackWorkspaceTakenConflict(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)
	withSlackConfig(t, "client-123", "state-secret", "https://app.example.com")

	// stub Slack's oauth.v2.access for the workspace team A already holds
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":           true,
			"access_token": "xoxb-new",
			"scope":        "chat:write",
			"bot_user_id":  "U1",
			"app_id":       "A1",
			"team":         map[string]string{"id": "T-slack", "name": "Acme Workspace"},
		})
	}))
	defer srv.Close()
	withSlackAccessURL(t, srv.URL)

	teamA := uuid.New()
	seedTeam(ctx, t, teamA, "team a")
	if _, err := th.PgPool.Exec(ctx,
		`INSERT INTO team_slack
		 (team_id, slack_team_id, slack_team_name, bot_token, bot_user_id, channel_ids, scopes, is_active, created_at, updated_at)
		 VALUES ($1, 'T-slack', 'Acme Workspace', 'xoxb-a', 'U1', $2, 'chat:write', true, now(), now())`,
		teamA, []string{"C1"}); err != nil {
		t.Fatalf("seed team_slack for team a: %v", err)
	}

	// team B completes the OAuth flow for the same workspace
	teamB := uuid.New()
	seedTeam(ctx, t, teamB, "team b")
	state, err := signSlackState("state-secret", teamB.String(), time.Now())
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	c, w := newConnectContext(fmt.Sprintf(`{"code":"the-code","state":%q}`, state))
	h.ConnectTeamSlack(c)

	if w.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409, body: %s", w.Code, w.Body.String())
	}
	var body struct {
		Error string `json:"error"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !strings.Contains(body.Error, "already connected to a different Measure team") {
		t.Errorf("error = %q, want the workspace-taken message", body.Error)
	}

	// team A's integration is untouched and team B gained no row
	var botToken string
	if err := th.PgPool.QueryRow(ctx,
		`SELECT bot_token FROM team_slack WHERE team_id = $1`, teamA).Scan(&botToken); err != nil {
		t.Fatalf("read team a row: %v", err)
	}
	if botToken != "xoxb-a" {
		t.Errorf("team a bot_token = %q, want xoxb-a untouched", botToken)
	}
	var count int
	if err := th.PgPool.QueryRow(ctx,
		`SELECT count(*) FROM team_slack WHERE team_id = $1`, teamB).Scan(&count); err != nil {
		t.Fatalf("count team b rows: %v", err)
	}
	if count != 0 {
		t.Errorf("team b has %d team_slack rows, want 0", count)
	}
}

// --------------------------------------------------------------------------
// GetTeamSlack needs_reauth
// --------------------------------------------------------------------------

func seedTeamSlackWithScopes(ctx context.Context, t *testing.T, teamID uuid.UUID, scopes string) {
	t.Helper()
	_, err := th.PgPool.Exec(ctx,
		`INSERT INTO team_slack
		 (team_id, slack_team_id, slack_team_name, bot_token, bot_user_id, channel_ids, scopes, is_active, created_at, updated_at)
		 VALUES ($1, 'T1', 'Test Workspace', 'xoxb', 'U1', $2, $3, true, now(), now())`,
		teamID, []string{}, scopes)
	if err != nil {
		t.Fatalf("seed team_slack with scopes: %v", err)
	}
}

func TestGetTeamSlackNeedsReauth(t *testing.T) {
	ctx := context.Background()

	cases := []struct {
		name   string
		scopes string
		want   bool
	}{
		{"full scopes: no reauth", strings.Join(slackRequiredScopes, ","), false},
		{"missing a scope: reauth", strings.Join(slackRequiredScopes[1:], ","), true},
		{"extra scope: no reauth", strings.Join(slackRequiredScopes, ",") + ",team:read", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			defer cleanupAll(ctx, t)

			ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
			seedTeamSlackWithScopes(ctx, t, teamID, tc.scopes)

			c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/slack", nil)
			c.Set("userId", ownerID)
			c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
			h.GetTeamSlack(c)

			if w.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
			}
			var body struct {
				NeedsReauth bool `json:"needs_reauth"`
			}
			if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			if body.NeedsReauth != tc.want {
				t.Errorf("needs_reauth = %v, want %v", body.NeedsReauth, tc.want)
			}
		})
	}
}
