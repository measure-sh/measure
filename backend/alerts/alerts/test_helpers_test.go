//go:build integration

package alerts

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	"backend/alerts/server"
	"backend/libs/email"
	"backend/testinfra"

	"github.com/leporo/sqlf"
)

// --------------------------------------------------------------------------
// TestMain — one-time setup: spin up containers, run migrations
// --------------------------------------------------------------------------

var (
	th *testinfra.TestHelper
)

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

// --------------------------------------------------------------------------
// Per-test setup
// --------------------------------------------------------------------------

func setupAlertsTest(ctx context.Context, t *testing.T) {
	t.Helper()
	cleanupAll(ctx, t)

	server.InitForTest(&server.ServerConfig{
		SiteOrigin: "https://test.measure.sh",
	}, th.PgPool, th.ChConn, th.VK)
}

func cleanupAll(ctx context.Context, t *testing.T) {
	th.CleanupAll(ctx, t)
}

// --------------------------------------------------------------------------
// Assertion helpers
// --------------------------------------------------------------------------

func countAlerts(ctx context.Context, t *testing.T) int {
	t.Helper()
	var count int
	if err := th.PgPool.QueryRow(ctx, "SELECT COUNT(*) FROM alerts").Scan(&count); err != nil {
		t.Fatalf("count alerts: %v", err)
	}
	return count
}

func countAlertsOfType(ctx context.Context, t *testing.T, alertType string) int {
	t.Helper()
	var count int
	if err := th.PgPool.QueryRow(ctx, "SELECT COUNT(*) FROM alerts WHERE type = $1", alertType).Scan(&count); err != nil {
		t.Fatalf("count alerts of type %q: %v", alertType, err)
	}
	return count
}

func countPending(ctx context.Context, t *testing.T) int {
	t.Helper()
	var count int
	if err := th.PgPool.QueryRow(ctx, "SELECT COUNT(*) FROM pending_alert_messages").Scan(&count); err != nil {
		t.Fatalf("count pending messages: %v", err)
	}
	return count
}

// pendingEmailSubject returns the subject of the one queued email.
func pendingEmailSubject(ctx context.Context, t *testing.T) string {
	t.Helper()
	var data []byte
	if err := th.PgPool.QueryRow(ctx, "SELECT data FROM pending_alert_messages WHERE channel = 'email'").Scan(&data); err != nil {
		t.Fatalf("read pending email: %v", err)
	}
	var info email.EmailInfo
	if err := json.Unmarshal(data, &info); err != nil {
		t.Fatalf("unmarshal pending email: %v", err)
	}
	return info.Subject
}

// pendingSlackHeader returns the header block text of the one queued Slack
// message.
func pendingSlackHeader(ctx context.Context, t *testing.T) string {
	t.Helper()
	var data []byte
	if err := th.PgPool.QueryRow(ctx, "SELECT data FROM pending_alert_messages WHERE channel = 'slack'").Scan(&data); err != nil {
		t.Fatalf("read pending slack message: %v", err)
	}
	var msg struct {
		Blocks []struct {
			Type string `json:"type"`
			Text struct {
				Text string `json:"text"`
			} `json:"text"`
		} `json:"blocks"`
	}
	if err := json.Unmarshal(data, &msg); err != nil {
		t.Fatalf("unmarshal pending slack message: %v", err)
	}
	if len(msg.Blocks) == 0 || msg.Blocks[0].Type != "header" {
		t.Fatalf("pending slack message has no header block: %s", data)
	}
	return msg.Blocks[0].Text.Text
}

func countPendingByChannel(ctx context.Context, t *testing.T, channel string) int {
	t.Helper()
	var count int
	if err := th.PgPool.QueryRow(ctx, "SELECT COUNT(*) FROM pending_alert_messages WHERE channel = $1", channel).Scan(&count); err != nil {
		t.Fatalf("count pending by channel %q: %v", channel, err)
	}
	return count
}
