//go:build integration

package measure

import (
	"backend/autumn"
	"backend/ingest-worker/server"
	"backend/testinfra"
	"context"
	"fmt"
	"os"
	"testing"

	"github.com/google/uuid"
)

// --------------------------------------------------------------------------
// TestMain — one-time setup: spin up containers, run migrations, wire server
// --------------------------------------------------------------------------

var th *testinfra.TestHelper

func TestMain(m *testing.M) {
	ctx := context.Background()

	pgPool, pgCleanup := testinfra.SetupPostgres(ctx)
	chConn, chCleanup := testinfra.SetupClickHouse(ctx)
	vk, vkCleanup := testinfra.SetupValkey(ctx)

	th = testinfra.NewTestHelper(pgPool, chConn, vk)

	server.InitForTest(&server.ServerConfig{
		BillingEnabled: true,
	}, pgPool, chConn, vk)

	// Default no-op Autumn mocks so tests that don't care about Autumn
	// behavior aren't surprised by uninitialized client errors. Tests that
	// care override via autumntest.MockTrack / MockCheck etc.
	autumn.Track = func(_ context.Context, _, _ string, _ float64) error { return nil }

	code := m.Run()

	vkCleanup()
	pgCleanup()
	chCleanup()
	os.Exit(code)
}

// --------------------------------------------------------------------------
// Thin wrappers delegating to testinfra.TestHelper
// --------------------------------------------------------------------------

func cleanupAll(ctx context.Context, t *testing.T) {
	th.CleanupAll(ctx, t)
}

func seedTeam(ctx context.Context, t *testing.T, teamID uuid.UUID, name string) {
	th.SeedTeam(ctx, t, teamID.String(), name)
}

func seedApp(ctx context.Context, t *testing.T, appID, teamID uuid.UUID, retention int) {
	th.SeedApp(ctx, t, appID.String(), teamID.String(), fmt.Sprintf("app-%s", appID.String()[:8]), retention)
}

func seedTeamAutumnCustomer(ctx context.Context, t *testing.T, teamID uuid.UUID, autumnCustomerID string) {
	th.SeedTeamAutumnCustomer(ctx, t, teamID.String(), autumnCustomerID)
}

