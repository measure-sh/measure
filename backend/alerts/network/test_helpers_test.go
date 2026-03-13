//go:build integration

package network

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"

	"backend/alerts/server"
	"backend/testinfra"

	"github.com/leporo/sqlf"
)

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

func setupTest(ctx context.Context, t *testing.T) {
	t.Helper()
	th.CleanupAll(ctx, t)

	server.InitForTest(&server.ServerConfig{
		SiteOrigin: "https://test.measure.sh",
	}, th.PgPool, th.ChConn)
}

func countUrlPatterns(ctx context.Context, t *testing.T, teamID, appID string) int {
	t.Helper()
	var count uint64
	row := th.ChConn.QueryRow(ctx, "SELECT count() FROM url_patterns FINAL WHERE team_id = $1 AND app_id = $2", teamID, appID)
	if err := row.Scan(&count); err != nil {
		t.Fatalf("count url_patterns: %v", err)
	}
	return int(count)
}

func getUrlPatterns(ctx context.Context, t *testing.T, teamID, appID string) []UrlPattern {
	t.Helper()
	rows, err := th.ChConn.Query(ctx,
		"SELECT domain, path FROM url_patterns FINAL WHERE team_id = $1 AND app_id = $2", teamID, appID)
	if err != nil {
		t.Fatalf("get url_patterns: %v", err)
	}
	defer rows.Close()

	var patterns []UrlPattern
	for rows.Next() {
		var domain string
		var path string

		if err := rows.Scan(&domain, &path); err != nil {
			t.Fatalf("scan url_patterns: %v", err)
		}

		segments := strings.Split(strings.TrimPrefix(path, "/"), "/")

		parts := make([]string, 0, len(segments)+1)
		parts = append(parts, domain)
		if len(segments) > 0 && segments[0] != "" {
			parts = append(parts, segments...)
		}

		patterns = append(patterns, UrlPattern{
			Parts:     parts,
			Frequency: 1,
		})
	}
	return patterns
}

func getMetricsReportedAt(ctx context.Context, t *testing.T, teamID, appID string) *time.Time {
	t.Helper()
	var ts *time.Time
	err := th.PgPool.QueryRow(ctx,
		"SELECT metrics_reported_at FROM network_metrics_reporting WHERE team_id = $1 AND app_id = $2",
		teamID, appID).Scan(&ts)
	if err != nil {
		return nil
	}
	return ts
}

func countHttpMetrics(ctx context.Context, t *testing.T, teamID, appID string) int {
	t.Helper()
	var count uint64
	row := th.ChConn.QueryRow(ctx, "SELECT count() FROM http_metrics WHERE team_id = $1 AND app_id = $2", teamID, appID)
	if err := row.Scan(&count); err != nil {
		t.Fatalf("count http_metrics: %v", err)
	}
	return int(count)
}
