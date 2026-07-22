//go:build integration

package slack

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"testing"

	"backend/alerts/server"
	"backend/testinfra"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

var th *testinfra.TestHelper

func TestMain(m *testing.M) {
	ctx := context.Background()

	pgPool, pgCleanup := testinfra.SetupPostgres(ctx)
	chConn, chCleanup := testinfra.SetupClickHouse(ctx)
	vk, vkCleanup := testinfra.SetupValkey(ctx)

	th = testinfra.NewTestHelper(pgPool, chConn, vk)

	sqlf.SetDialect(sqlf.PostgreSQL)

	code := m.Run()

	vkCleanup()
	pgCleanup()
	chCleanup()
	os.Exit(code)
}

// withSlackPostMessageURL points chat.postMessage at a stub for a test.
func withSlackPostMessageURL(t *testing.T, u string) {
	t.Helper()
	orig := slackPostMessageURL
	slackPostMessageURL = u
	t.Cleanup(func() { slackPostMessageURL = orig })
}

// stubSlackError serves a Slack-shaped error response for every post.
func stubSlackError(t *testing.T, slackErr string) {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": false, "error": slackErr})
	}))
	t.Cleanup(srv.Close)
	withSlackPostMessageURL(t, srv.URL)
}

func seedPendingSlackMessage(ctx context.Context, t *testing.T, msgID, teamID uuid.UUID) {
	t.Helper()
	if _, err := th.PgPool.Exec(ctx,
		`INSERT INTO pending_alert_messages (id, team_id, channel, data)
		 VALUES ($1, $2, 'slack', '{"channel":"C1","bot_token":"xoxb"}')`,
		msgID, teamID); err != nil {
		t.Fatalf("seed pending alert message: %v", err)
	}
}

func TestSendSlackMessageErrorHandling(t *testing.T) {
	ctx := context.Background()

	cases := []struct {
		slackErr     string
		wantPending  int
		wantChannels []string
	}{
		// the channel is unusable for good: message and subscription both go
		{"is_archived", 0, []string{"C2"}},
		// the bot may be re-invited to a private channel: the message goes,
		// the subscription stays
		{"channel_not_found", 0, []string{"C1", "C2"}},
		// an unlisted error is treated as transient: the message stays queued
		{"ratelimited", 1, []string{"C1", "C2"}},
	}
	for _, tc := range cases {
		t.Run(tc.slackErr, func(t *testing.T) {
			defer th.CleanupAll(ctx, t)
			server.InitForTest(&server.ServerConfig{
				SiteOrigin: "https://test.measure.sh",
			}, th.PgPool, th.ChConn, th.VK)
			stubSlackError(t, tc.slackErr)

			teamID := uuid.New()
			th.SeedTeam(ctx, t, teamID.String(), "test team")
			th.SeedTeamSlack(ctx, t, teamID.String(), []string{"C1", "C2"})
			msgID := uuid.New()
			seedPendingSlackMessage(ctx, t, msgID, teamID)

			err := SendSlackMessage(ctx, msgID, teamID, SlackMessageData{
				Channel:  "C1",
				BotToken: "xoxb",
			})
			if err == nil {
				t.Fatal("SendSlackMessage returned nil, want the slack API error")
			}

			var pending int
			if err := th.PgPool.QueryRow(ctx,
				`SELECT count(*) FROM pending_alert_messages WHERE id = $1`, msgID).Scan(&pending); err != nil {
				t.Fatalf("count pending: %v", err)
			}
			if pending != tc.wantPending {
				t.Errorf("pending rows = %d, want %d", pending, tc.wantPending)
			}

			var channels []string
			if err := th.PgPool.QueryRow(ctx,
				`SELECT channel_ids FROM team_slack WHERE team_id = $1`, teamID).Scan(&channels); err != nil {
				t.Fatalf("read channel_ids: %v", err)
			}
			if !slices.Equal(channels, tc.wantChannels) {
				t.Errorf("channel_ids = %v, want %v", channels, tc.wantChannels)
			}
		})
	}
}
