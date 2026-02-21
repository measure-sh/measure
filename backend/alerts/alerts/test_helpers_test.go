//go:build integration

package alerts

import (
	"context"
	"os"
	"testing"

	"backend/alerts/server"
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

	config := server.NewConfig()
	config.SiteOrigin = "https://test.measure.sh"
	server.Init(config)

	// Override connection pools
	server.Server.PgPool = th.PgPool
	server.Server.ChPool = th.ChConn
	server.Server.RchPool = th.ChConn
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

func countPendingByChannel(ctx context.Context, t *testing.T, channel string) int {
	t.Helper()
	var count int
	if err := th.PgPool.QueryRow(ctx, "SELECT COUNT(*) FROM pending_alert_messages WHERE channel = $1", channel).Scan(&count); err != nil {
		t.Fatalf("count pending by channel %q: %v", channel, err)
	}
	return count
}
