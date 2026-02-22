package processor

import (
	"context"
	"fmt"
	"time"

	"backend/url-processor/server"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

const (
	// patternLookback is how far back to query http_events
	// for pattern discovery.
	patternLookback = -1 // months

	// minPatternCount is the minimum request count a pattern
	// must have to be kept.
	minPatternCount = 100

	// metricsDefaultLookback is how far back to query
	// http_events when no prior reporting timestamp exists.
	metricsDefaultLookback = 3 * time.Hour
)

// appKey identifies a unique (team, app) combination.
type appKey struct {
	TeamID uuid.UUID
	AppID  uuid.UUID
}

// groupKey identifies a unique (team, app, domain) combination
// for pattern grouping.
type groupKey struct {
	TeamID uuid.UUID
	AppID  uuid.UUID
	Domain string
}

// patternKey deduplicates inserts by (team, app, domain, path).
type patternKey struct {
	TeamID uuid.UUID
	AppID  uuid.UUID
	Domain string
	Path   string
}

// HttpEvent represents a single row from the http_events
// query, pre-aggregated by ClickHouse.
type HttpEvent struct {
	TeamID uuid.UUID
	AppID  uuid.UUID
	Domain string
	Path   string
	Count  uint64
}

// PatternResult represents a discovered URL pattern with
// its accumulated request count.
type PatternResult struct {
	Path  string
	Count uint64
}

// GeneratePatterns discovers URL patterns from raw HTTP
// traffic, normalizes dynamic path segments, consolidates
// similar paths via a trie, and stores the results.
func GeneratePatterns(ctx context.Context) {
	start := time.Now()
	now := start.UTC()
	from := now.AddDate(0, patternLookback, 0)

	fmt.Printf("GeneratePatterns: start from=%s to=%s\n",
		from.Format(time.RFC3339), now.Format(time.RFC3339))

	rows, err := fetchRawPaths(ctx, from, now)
	if err != nil {
		fmt.Printf("GeneratePatterns: failed to fetch raw paths: %v\n", err)
		return
	}

	if len(rows) == 0 {
		fmt.Printf("GeneratePatterns: end took=%v (no events found)\n", time.Since(start))
		return
	}

	// Normalize paths and aggregate by (team, app, domain).
	groups := make(map[groupKey]map[string]uint64)
	for _, row := range rows {
		key := groupKey{
			TeamID: row.TeamID,
			AppID:  row.AppID,
			Domain: row.Domain,
		}

		normalized := NormalizePath(row.Path)

		if groups[key] == nil {
			groups[key] = make(map[string]uint64)
		}
		groups[key][normalized] += row.Count
	}

	// Build trie per group, extract patterns, deduplicate.
	seen := make(map[patternKey]struct{})
	var totalPatterns int

	insertStmt := sqlf.InsertInto("url_patterns")
	defer insertStmt.Close()

	for key, paths := range groups {
		trie := NewTrie()
		for path, count := range paths {
			trie.Insert(path, count)
		}

		patterns := trie.ExtractPatterns()

		filtered := patterns[:0]
		for _, p := range patterns {
			if p.Count >= minPatternCount {
				filtered = append(filtered, p)
			}
		}
		patterns = filtered

		for _, p := range patterns {
			pk := patternKey{
				TeamID: key.TeamID,
				AppID:  key.AppID,
				Domain: key.Domain,
				Path:   p.Path,
			}
			if _, exists := seen[pk]; exists {
				continue
			}
			seen[pk] = struct{}{}

			insertStmt.NewRow().
				Set("team_id", key.TeamID).
				Set("app_id", key.AppID).
				Set("domain", key.Domain).
				Set("path", p.Path).
				Set("last_accessed_at", now)
			totalPatterns++
		}
	}

	if totalPatterns == 0 {
		fmt.Printf("GeneratePatterns: end took=%v (no patterns above threshold)\n", time.Since(start))
		return
	}

	if err := server.Server.ChPool.AsyncInsert(ctx, insertStmt.String(), true, insertStmt.Args()...); err != nil {
		fmt.Printf("GeneratePatterns: failed to insert: %v\n", err)
		return
	}

	fmt.Printf("GeneratePatterns: end took=%v patterns=%d\n",
		time.Since(start), totalPatterns)
}

// GenerateMetrics pre-aggregates HTTP event data into
// the http_metrics table for each known app.
func GenerateMetrics(ctx context.Context) {
	start := time.Now()
	now := start.UTC()

	fmt.Printf("GenerateMetrics: start\n")

	apps, err := fetchApps(ctx)
	if err != nil {
		fmt.Printf("GenerateMetrics: failed to fetch apps: %v\n", err)
		return
	}

	if len(apps) == 0 {
		fmt.Printf("GenerateMetrics: end took=%v (no apps)\n", time.Since(start))
		return
	}

	var processed, skipped, failed int

	for _, app := range apps {
		from, err := getLastReportedAt(ctx, app.TeamID, app.AppID)
		if err != nil {
			fmt.Printf("GenerateMetrics: failed to get last reported_at for team=%s app=%s: %v\n",
				app.TeamID, app.AppID, err)
			failed++
			continue
		}

		if from == nil {
			defaultFrom := now.Add(-metricsDefaultLookback)
			from = &defaultFrom
		}

		if !from.Before(now) {
			skipped++
			continue
		}

		if err := insertAggregatedMetrics(ctx, app.TeamID, app.AppID, *from, now); err != nil {
			fmt.Printf("GenerateMetrics: failed to insert for team=%s app=%s: %v\n",
				app.TeamID, app.AppID, err)
			failed++
			continue
		}

		if err := upsertReportedAt(ctx, app.TeamID, app.AppID, now); err != nil {
			fmt.Printf("GenerateMetrics: failed to upsert reported_at for team=%s app=%s: %v\n",
				app.TeamID, app.AppID, err)
			failed++
			continue
		}

		processed++
	}

	fmt.Printf("GenerateMetrics: end took=%v processed=%d skipped=%d failed=%d\n",
		time.Since(start), processed, skipped, failed)
}

// fetchApps queries the PG apps table for all (team_id, id) pairs.
func fetchApps(ctx context.Context) ([]appKey, error) {
	rows, err := server.Server.PgPool.Query(ctx, "SELECT team_id, id FROM apps")
	if err != nil {
		return nil, fmt.Errorf("query apps: %w", err)
	}
	defer rows.Close()

	var apps []appKey
	for rows.Next() {
		var app appKey
		if err := rows.Scan(&app.TeamID, &app.AppID); err != nil {
			return nil, fmt.Errorf("scan app: %w", err)
		}
		apps = append(apps, app)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration: %w", err)
	}

	return apps, nil
}

// getLastReportedAt queries PG for the most recent reported_at
// timestamp for the given team and app. Returns nil if no row exists.
func getLastReportedAt(ctx context.Context, teamID, appID uuid.UUID) (*time.Time, error) {
	var reportedAt *time.Time
	err := server.Server.PgPool.QueryRow(ctx,
		"SELECT MAX(reported_at) FROM network_metrics_reporting WHERE team_id = $1 AND app_id = $2",
		teamID, appID,
	).Scan(&reportedAt)
	if err != nil {
		return nil, fmt.Errorf("query network_metrics_reporting: %w", err)
	}

	return reportedAt, nil
}

// insertAggregatedMetrics executes an INSERT...SELECT on ClickHouse
// that aggregates http_events into http_metrics for the given
// team, app and time range.
func insertAggregatedMetrics(ctx context.Context, teamID, appID uuid.UUID, from, to time.Time) error {
	query := `INSERT INTO http_metrics
SELECT
    e.team_id, e.app_id,
    toStartOfFifteenMinutes(e.timestamp) AS ts,
    e.protocol, e.port, e.domain,
    p.path AS path,
    e.method, e.status_code,
    e.app_version, e.os_version,
    e.device_manufacturer, e.device_name,
    groupUniqArray(e.network_provider),
    groupUniqArray(e.network_type),
    groupUniqArray(e.network_generation),
    groupUniqArray(e.device_locale),
    toUInt64(count()),
    toUInt64(countIf(status_code >= 200 AND status_code < 300)),
    toUInt64(countIf(status_code >= 300 AND status_code < 400)),
    toUInt64(countIf(status_code >= 400 AND status_code < 500)),
    toUInt64(countIf(status_code >= 500 AND status_code < 600)),
    quantilesState(0.5, 0.75, 0.90, 0.95, 0.99, 1.0)(e.latency_ms)
FROM http_events e
INNER JOIN (
    SELECT DISTINCT domain, path FROM url_patterns FINAL
    WHERE team_id = $1 AND app_id = $2
) p ON e.domain = p.domain AND multiIf(
    endsWith(p.path, '**') AND position(substring(p.path, 1, length(p.path) - 2), '*') = 0,
        startsWith(e.path, substring(p.path, 1, length(p.path) - 2)),
    position(p.path, '*') > 0,
        e.path LIKE replaceAll(p.path, '*', '%'),
    e.path = p.path
)
WHERE e.team_id = $3 AND e.app_id = $4
    AND e.timestamp >= $5 AND e.timestamp < $6
    AND e.latency_ms <= 60000
    AND e.status_code != 0
    AND e.domain != '' AND e.path != ''
GROUP BY e.team_id, e.app_id, ts, e.protocol, e.port, e.domain, p.path,
         e.method, e.status_code, e.app_version, e.os_version,
         e.device_manufacturer, e.device_name`

	if err := server.Server.ChPool.Exec(ctx, query, teamID, appID, teamID, appID, from, to); err != nil {
		return fmt.Errorf("insert aggregated metrics: %w", err)
	}

	return nil
}

// upsertReportedAt inserts a new reporting timestamp into
// the PG network_metrics_reporting table.
func upsertReportedAt(ctx context.Context, teamID, appID uuid.UUID, reportedAt time.Time) error {
	_, err := server.Server.PgPool.Exec(ctx,
		"INSERT INTO network_metrics_reporting (team_id, app_id, reported_at) VALUES ($1, $2, $3)",
		teamID, appID, reportedAt,
	)
	if err != nil {
		return fmt.Errorf("upsert network_metrics_reporting: %w", err)
	}

	return nil
}

// fetchRawPaths queries http_events for the given time
// range, pre-aggregated by (team_id, app_id, domain, path).
func fetchRawPaths(ctx context.Context, from, to time.Time) ([]HttpEvent, error) {
	stmt := sqlf.
		Select("team_id, app_id, domain, path, count() as cnt").
		From("http_events").
		Where("timestamp >= ?", from).
		Where("timestamp < ?", to).
		Where("domain != ''").
		Where("path != ''").
		GroupBy("team_id, app_id, domain, path")

	defer stmt.Close()

	rows, err := server.Server.RchPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, fmt.Errorf("query http_events: %w", err)
	}

	var result []HttpEvent
	for rows.Next() {
		var row HttpEvent
		if err := rows.Scan(&row.TeamID, &row.AppID, &row.Domain, &row.Path, &row.Count); err != nil {
			return nil, fmt.Errorf("scan row: %w", err)
		}
		result = append(result, row)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration: %w", err)
	}

	return result, nil
}
