//go:build integration

package email

import (
	"backend/testinfra"
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

var (
	th *testinfra.TestHelper
)

func TestMain(m *testing.M) {
	ctx := context.Background()

	pgPool, pgCleanup := testinfra.SetupPostgres(ctx)
	chConn, chCleanup := testinfra.SetupClickHouse(ctx)

	th = testinfra.NewTestHelper(pgPool, chConn, nil)

	sqlf.SetDialect(sqlf.PostgreSQL)

	code := m.Run()

	pgCleanup()
	chCleanup()
	os.Exit(code)
}

func cleanupAll(ctx context.Context, t *testing.T) {
	t.Helper()
	th.CleanupAll(ctx, t)
}

func seedTeam(ctx context.Context, t *testing.T, teamID uuid.UUID, name string, allowIngest bool) {
	t.Helper()
	th.SeedTeam(ctx, t, teamID.String(), name, allowIngest)
}

func seedApp(ctx context.Context, t *testing.T, appID, teamID uuid.UUID, retention int) {
	t.Helper()
	th.SeedApp(ctx, t, appID.String(), teamID.String(), appID.String()[:8], retention)
}

func seedUser(ctx context.Context, t *testing.T, userID uuid.UUID, emailAddr string) {
	t.Helper()
	th.SeedUser(ctx, t, userID.String(), emailAddr)
}

func seedTeamMembership(ctx context.Context, t *testing.T, teamID, userID uuid.UUID, role string) {
	t.Helper()
	th.SeedTeamMembership(ctx, t, teamID.String(), userID.String(), role)
}
