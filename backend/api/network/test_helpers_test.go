//go:build integration

package network

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"backend/api/server"
	"backend/testinfra"

	"github.com/leporo/sqlf"
)

// --------------------------------------------------------------------------
// TestMain — one-time setup: spin up containers, run migrations, wire server
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

	server.InitForTest(&server.ServerConfig{
		SiteOrigin: "https://test.measure.sh",
	}, pgPool, chConn, vk)

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

func seedHttpEvent(ctx context.Context, t *testing.T, teamID, appID, url, method string, statusCode, count int, ts time.Time) {
	th.SeedHttpEvent(ctx, t, teamID, appID, url, method, statusCode, count, ts)
}

func seedUrlPattern(ctx context.Context, t *testing.T, teamID, appID, domain, path string) {
	th.SeedUrlPattern(ctx, t, teamID, appID, domain, path)
}

// --------------------------------------------------------------------------
// Custom seed helpers
// --------------------------------------------------------------------------

// seedHttpMetrics inserts a single row into http_metrics with
// aggregate state columns built via ClickHouse constructors.
func seedHttpMetrics(
	ctx context.Context,
	t *testing.T,
	teamID, appID, domain, path string,
	requestCount, count2xx, count4xx, count5xx uint64,
	ts time.Time,
) {
	t.Helper()
	tsStr := ts.UTC().Format("2006-01-02 15:04:05")
	query := fmt.Sprintf(
		`INSERT INTO http_metrics
		SELECT
			'%s' AS team_id,
			'%s' AS app_id,
			'%s' AS timestamp,
			'%s' AS domain,
			'%s' AS path,
			['https'] AS protocols,
			[toUInt16(443)] AS ports,
			['GET'] AS methods,
			[toUInt16(200)] AS status_codes,
			[('1.0','1')] AS app_versions,
			[('android','14')] AS os_versions,
			['samsung'] AS device_manufacturers,
			['galaxy'] AS device_names,
			['provider'] AS network_providers,
			['wifi'] AS network_types,
			['4g'] AS network_generations,
			['en_US'] AS device_locales,
			['US'] AS ` + "`inet.country_code`" + `,
			%d AS request_count,
			%d AS count_2xx,
			0 AS count_3xx,
			%d AS count_4xx,
			%d AS count_5xx,
			(SELECT quantilesState(0.5, 0.75, 0.90, 0.95, 0.99)(toInt64(100)) FROM numbers(%d)),
			([toUInt32(5),toUInt32(10)],[toUInt64(%d),toUInt64(%d)]) AS session_elapsed_counts,
			(SELECT uniqCombined64State(generateUUIDv4()) FROM numbers(%d))`,
		teamID, appID, tsStr,
		domain, path,
		requestCount,
		count2xx,
		count4xx,
		count5xx,
		requestCount,
		requestCount/2, requestCount-requestCount/2,
		requestCount,
	)
	if err := th.ChConn.Exec(ctx, query); err != nil {
		t.Fatalf("seed http_metrics: %v", err)
	}
}
