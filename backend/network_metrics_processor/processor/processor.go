package processor

import (
	"context"
	"errors"
	"fmt"
	"time"

	"backend/network_metrics_processor/server"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
)

const (
	// patternsDefaultLookback is how far back to query
	// http_events when no prior pattern generation timestamp exists.
	patternsDefaultLookback = 1 * 24 * time.Hour

	// minPatternCount is the minimum request count a pattern
	// must have to be kept.
	minPatternCount = 100

	// metricsDefaultLookback is how far back to query
	// http_events when no prior reporting timestamp exists.
	metricsDefaultLookback = 1 * 24 * time.Hour
)

// team represents a team row from PG.
type team struct {
	ID uuid.UUID
}

// app represents an app row from PG.
type app struct {
	ID     uuid.UUID
	TeamID uuid.UUID
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
	Domain string
	Path   string
	Count  uint64
}

// GeneratePatterns discovers URL patterns from raw HTTP
// traffic, normalizes dynamic path segments, consolidates
// similar paths via a trie, and stores the results.
func GeneratePatterns(ctx context.Context) {
	start := time.Now()
	now := start.UTC()

	teams, err := getTeams(ctx)
	if err != nil {
		fmt.Printf("failed to fetch teams: %v\n", err)
		return
	}

	var processed, skipped, failed int

	for _, t := range teams {
		apps, err := getAppsForTeam(ctx, t.ID)
		if err != nil {
			fmt.Printf("failed to fetch apps for team=%s: %v\n", t.ID, err)
			continue
		}

		for _, app := range apps {
			from, err := getLastPatternGeneratedAt(ctx, app.TeamID, app.ID)
			if err != nil {
				fmt.Printf("failed to get last pattern_generated_at for team=%s app=%s: %v\n",
					app.TeamID, app.ID, err)
				failed++
				continue
			}

			if from == nil {
				defaultFrom := now.Add(-patternsDefaultLookback)
				from = &defaultFrom
			}

			events, err := fetchHttpEvents(ctx, app.TeamID, app.ID, *from, now)
			if err != nil {
				fmt.Printf("failed to fetch http events for team=%s app=%s: %v\n",
					app.TeamID, app.ID, err)
				failed++
				continue
			}

			if len(events) == 0 {
				skipped++
				continue
			}

			trie := NewTrie()
			for _, event := range events {
				normalized := NormalizePath(event.Path)
				trie.InsertWithDomain(event.Domain, normalized, event.Count)
			}

			patterns := trie.ExtractPatterns()

			seen := make(map[string]struct{})
			insertStmt := sqlf.InsertInto("url_patterns")

			var totalPatterns int

			for _, p := range patterns {
				if p.Count < minPatternCount {
					continue
				}

				key := p.Domain + "\x00" + p.Path
				if _, exists := seen[key]; exists {
					continue
				}
				seen[key] = struct{}{}

				insertStmt.NewRow().
					Set("team_id", app.TeamID).
					Set("app_id", app.ID).
					Set("domain", p.Domain).
					Set("path", p.Path).
					Set("last_updated_at", now)
				totalPatterns++
			}

			if totalPatterns == 0 {
				insertStmt.Close()
				skipped++
				continue
			}

			if err := server.Server.ChPool.AsyncInsert(ctx, insertStmt.String(), true, insertStmt.Args()...); err != nil {
				fmt.Printf("failed to insert for team=%s app=%s: %v\n",
					app.TeamID, app.ID, err)
				insertStmt.Close()
				failed++
				continue
			}

			insertStmt.Close()

			if err := upsertPatternGeneratedAt(ctx, app.TeamID, app.ID, now); err != nil {
				fmt.Printf("failed to upsert pattern_generated_at for team=%s app=%s: %v\n",
					app.TeamID, app.ID, err)
				failed++
				continue
			}

			processed++
		}
	}

	fmt.Printf("GeneratePatterns took=%v processed=%d skipped=%d failed=%d\n",
		time.Since(start), processed, skipped, failed)
}

// GenerateMetrics pre-aggregates HTTP event data into
// the http_metrics table for each known app.
func GenerateMetrics(ctx context.Context) {
	start := time.Now()
	now := start.UTC()

	teams, err := getTeams(ctx)
	if err != nil {
		fmt.Printf("failed to fetch teams: %v\n", err)
		return
	}

	var processed, skipped, failed int

	for _, t := range teams {
		apps, err := getAppsForTeam(ctx, t.ID)
		if err != nil {
			fmt.Printf("failed to fetch apps for team=%s: %v\n", t.ID, err)
			continue
		}

		for _, app := range apps {
			from, err := getLastReportedAt(ctx, app.TeamID, app.ID)
			if err != nil {
				fmt.Printf("failed to get last metrics_reported_at for team=%s app=%s: %v\n",
					app.TeamID, app.ID, err)
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

			if err := insertAggregatedMetrics(ctx, app.TeamID, app.ID, *from, now); err != nil {
				fmt.Printf("failed to insert metrics for team=%s app=%s: %v\n",
					app.TeamID, app.ID, err)
				failed++
				continue
			}

			if err := upsertMetricsReportedAt(ctx, app.TeamID, app.ID, now); err != nil {
				fmt.Printf("failed to upsert metrics_reported_at for team=%s app=%s: %v\n",
					app.TeamID, app.ID, err)
				failed++
				continue
			}

			processed++
		}
	}

	fmt.Printf("GenerateMetrics took=%v processed=%d skipped=%d failed=%d\n",
		time.Since(start), processed, skipped, failed)
}

func getTeams(ctx context.Context) ([]team, error) {
	stmt := sqlf.PostgreSQL.
		Select("id").
		From("teams")
	defer stmt.Close()

	rows, err := server.Server.PgPool.Query(ctx, stmt.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var teams []team
	for rows.Next() {
		var t team
		if err := rows.Scan(&t.ID); err != nil {
			return nil, err
		}
		teams = append(teams, t)
	}

	return teams, nil
}

func getAppsForTeam(ctx context.Context, teamID uuid.UUID) ([]app, error) {
	stmt := sqlf.PostgreSQL.
		Select("id").
		Select("team_id").
		From("apps").
		Where("team_id = ?", teamID)
	defer stmt.Close()

	rows, err := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var apps []app
	for rows.Next() {
		var a app
		if err := rows.Scan(&a.ID, &a.TeamID); err != nil {
			return nil, err
		}
		apps = append(apps, a)
	}

	return apps, nil
}

// getLastReportedAt queries PG for the most recent metrics_reported_at
// timestamp for the given team and app. Returns nil if no row exists.
func getLastReportedAt(ctx context.Context, teamID, appID uuid.UUID) (*time.Time, error) {
	stmt := sqlf.Select("metrics_reported_at").
		From("network_metrics_reporting").
		Where("team_id = ?", teamID).
		Where("app_id = ?", appID)
	defer stmt.Close()

	var reportedAt *time.Time
	err := server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&reportedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("query network_metrics_reporting: %w", err)
	}

	return reportedAt, nil
}

// getLastPatternGeneratedAt queries PG for the most recent pattern_generated_at
// timestamp for the given team and app. Returns nil if no row exists.
func getLastPatternGeneratedAt(ctx context.Context, teamID, appID uuid.UUID) (*time.Time, error) {
	stmt := sqlf.Select("pattern_generated_at").
		From("network_metrics_reporting").
		Where("team_id = ?", teamID).
		Where("app_id = ?", appID)
	defer stmt.Close()

	var generatedAt *time.Time
	err := server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&generatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("query network_metrics_reporting: %w", err)
	}

	return generatedAt, nil
}

func insertAggregatedMetrics(ctx context.Context, teamID, appID uuid.UUID, from, to time.Time) error {
	// Delete existing metrics for this
	// exact window to avoid duplicates
	// on re-runs.
	deleteStmt := sqlf.
		DeleteFrom("http_metrics").
		Where("team_id = ?", teamID).
		Where("app_id = ?", appID).
		Where("timestamp >= ?", from).
		Where("timestamp < ?", to)
	defer deleteStmt.Close()

	if err := server.Server.ChPool.Exec(ctx, deleteStmt.String(), deleteStmt.Args()...); err != nil {
		return fmt.Errorf("failed to delete existing metrics: %w", err)
	}

	// Build the Aggregate + Insert Statement
	stmt := sqlf.
		Select(`
			e.team_id, e.app_id, toStartOfFifteenMinutes(e.timestamp) AS ts,
			e.protocol, e.port, e.domain, p.path AS path, e.method, e.status_code,
			e.app_version, e.os_version, e.device_manufacturer, e.device_name,
			groupUniqArray(e.network_provider), groupUniqArray(e.network_type),
			groupUniqArray(e.network_generation), groupUniqArray(e.device_locale),
			toUInt64(count()),
			toUInt64(countIf(status_code >= 200 AND status_code < 300)),
			toUInt64(countIf(status_code >= 300 AND status_code < 400)),
			toUInt64(countIf(status_code >= 400 AND status_code < 500)),
			toUInt64(countIf(status_code >= 500 AND status_code < 600)),
			quantilesState(0.5, 0.75, 0.90, 0.95, 0.99, 1.0)(e.latency_ms)
		`).
		From(`http_events e
			JOIN (
				SELECT DISTINCT domain, path FROM url_patterns FINAL
				WHERE team_id = ? AND app_id = ?
			) p ON e.domain = p.domain AND multiIf(
				endsWith(p.path, '**') AND position(substring(p.path, 1, length(p.path) - 2), '*') = 0,
					startsWith(e.path, substring(p.path, 1, length(p.path) - 2)),
				position(p.path, '*') > 0,
					e.path LIKE replaceAll(p.path, '*', '%'),
				e.path = p.path
			)`, teamID, appID).
		Where("e.team_id = ?", teamID).
		Where("e.app_id = ?", appID).
		Where("e.timestamp >= ?", from).
		Where("e.timestamp < ?", to).
		Where("e.latency_ms <= 60000").
		Where("e.status_code != 0").
		Where("e.domain != ''").
		Where("e.path != ''").
		GroupBy(`
			e.team_id, e.app_id, ts, e.protocol, e.port, e.domain, p.path,
			e.method, e.status_code, e.app_version, e.os_version,
			e.device_manufacturer, e.device_name
		`)
	defer stmt.Close()

	query := "INSERT INTO http_metrics\n" + stmt.String()

	if err := server.Server.ChPool.Exec(ctx, query, stmt.Args()...); err != nil {
		return fmt.Errorf("insert aggregated metrics: %w", err)
	}

	return nil
}

// upsertMetricsReportedAt upserts the metrics reporting timestamp into
// the PG network_metrics_reporting table.
func upsertMetricsReportedAt(ctx context.Context, teamID, appID uuid.UUID, reportedAt time.Time) error {
	stmt := sqlf.InsertInto("network_metrics_reporting").
		Set("team_id", teamID).
		Set("app_id", appID).
		Set("metrics_reported_at", reportedAt).
		Clause("ON CONFLICT (team_id, app_id) DO UPDATE SET metrics_reported_at = EXCLUDED.metrics_reported_at")
	defer stmt.Close()

	if _, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
		return fmt.Errorf("upsert network_metrics_reporting: %w", err)
	}

	return nil
}

// upsertPatternGeneratedAt upserts the pattern generation timestamp into
// the PG network_metrics_reporting table.
func upsertPatternGeneratedAt(ctx context.Context, teamID, appID uuid.UUID, generatedAt time.Time) error {
	stmt := sqlf.InsertInto("network_metrics_reporting").
		Set("team_id", teamID).
		Set("app_id", appID).
		Set("pattern_generated_at", generatedAt).
		Clause("ON CONFLICT (team_id, app_id) DO UPDATE SET pattern_generated_at = EXCLUDED.pattern_generated_at")
	defer stmt.Close()

	if _, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
		return fmt.Errorf("upsert network_metrics_reporting: %w", err)
	}

	return nil
}

// fetchHttpEvents queries http_events for the given team, app and time
// range, pre-aggregated by (domain, path).
func fetchHttpEvents(ctx context.Context, teamID, appID uuid.UUID, from, to time.Time) ([]HttpEvent, error) {
	stmt := sqlf.
		Select("team_id, app_id, domain, path, count() as cnt").
		From("http_events").
		Where("team_id = ?", teamID).
		Where("app_id = ?", appID).
		Where("timestamp >= ?", from).
		Where("timestamp < ?", to).
		Where("domain != ''").
		Where("path != ''").
		GroupBy("team_id, app_id, domain, path")

	defer stmt.Close()

	rows, err := server.Server.RchPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, fmt.Errorf("failed to query http_events: %w", err)
	}

	var result []HttpEvent
	for rows.Next() {
		var row HttpEvent
		if err := rows.Scan(&row.TeamID, &row.AppID, &row.Domain, &row.Path, &row.Count); err != nil {
			return nil, fmt.Errorf("failed to scan http_events row: %w", err)
		}
		result = append(result, row)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating http_events rows: %w", err)
	}

	return result, nil
}
