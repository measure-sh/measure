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
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

const (
	// patternsDefaultLookback is how far back to query
	// http_events when no prior pattern generation timestamp exists.
	patternsDefaultLookback = 1 * 24 * time.Hour

	// minPatternCount is the minimum request count a pattern
	// must have to be kept.
	minPatternCount = 100

	// collapseThreshold is the maximum number of distinct
	// children a trie node may have before it collapses
	// into a wildcard pattern.
	collapseThreshold = 10

	// metricsDefaultLookback is how far back to query
	// http_events when no prior reporting timestamp exists.
	metricsDefaultLookback = 1 * 24 * time.Hour
)

var tracer = otel.Tracer("network-metrics-processor")

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

// GeneratePatterns converts raw URLs data
// from http_events into generalized URL
// patterns with wildcards and stores them
// in the url_patterns table.
func GeneratePatterns(ctx context.Context) {
	ctx, rootSpan := tracer.Start(ctx, "generate-patterns")
	defer rootSpan.End()

	start := time.Now()
	now := start.UTC()

	teams, err := getTeams(ctx)
	if err != nil {
		rootSpan.RecordError(err)
		rootSpan.SetStatus(codes.Error, "failed to fetch teams")
		fmt.Printf("failed to fetch teams: %v\n", err)
		return
	}

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
				continue
			}

			if len(events) == 0 {
				continue
			}

			trie := NewTrie(collapseThreshold)
			for _, event := range events {
				normalizedPath := NormalizePath(event.Path)
				trie.Insert(event.Domain, normalizedPath, event.Count)
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
				continue
			}

			if err := insertURLPatterns(ctx, insertStmt, totalPatterns); err != nil {
				fmt.Printf("failed to insert for team=%s app=%s: %v\n",
					app.TeamID, app.ID, err)
				insertStmt.Close()
				continue
			}

			insertStmt.Close()

			if err := upsertPatternGeneratedAt(ctx, app.TeamID, app.ID, now); err != nil {
				fmt.Printf("failed to upsert pattern_generated_at for team=%s app=%s: %v\n",
					app.TeamID, app.ID, err)
				continue
			}
		}
	}
}

// GenerateMetrics pre-aggregates HTTP event data into
// the http_metrics table for each known app.
func GenerateMetrics(ctx context.Context) {
	ctx, span := tracer.Start(ctx, "generate-metrics")
	defer span.End()

	start := time.Now()
	now := start.UTC()

	teams, err := getTeams(ctx)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to fetch teams")
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
	ctx, span := tracer.Start(ctx, "pg.get-teams")
	defer span.End()

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
	ctx, span := tracer.Start(ctx, "pg.get-apps")
	defer span.End()

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
	ctx, span := tracer.Start(ctx, "pg.get-last-reported-at")
	defer span.End()

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
	ctx, span := tracer.Start(ctx, "pg.get-last-pattern-generated-at")
	defer span.End()

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
		return nil, fmt.Errorf("failed to query network_metrics_reporting: %w", err)
	}

	return generatedAt, nil
}

func insertURLPatterns(ctx context.Context, insertStmt *sqlf.Stmt, totalPatterns int) error {
	ctx, span := tracer.Start(ctx, "ch.insert-url-patterns")
	defer span.End()
	span.SetAttributes(attribute.Int("pattern_count", totalPatterns))

	if err := server.Server.ChPool.AsyncInsert(ctx, insertStmt.String(), true, insertStmt.Args()...); err != nil {
		return fmt.Errorf("failed to insert url patterns: %w", err)
	}
	return nil
}

func insertAggregatedMetrics(ctx context.Context, teamID, appID uuid.UUID, from, to time.Time) error {
	ctx, span := tracer.Start(ctx, "ch.insert-aggregated-metrics")
	defer span.End()
	span.SetAttributes(attribute.String("app_id", appID.String()))

	// Build the Aggregate + Insert Statement
	stmt := sqlf.
		Select("e.team_id").
		Select("e.app_id").
		Select("toStartOfFifteenMinutes(e.timestamp) AS ts").
		Select("e.protocol").
		Select("e.port").
		Select("e.domain").
		Select("p.path AS path").
		Select("e.method").
		Select("e.status_code").
		Select("e.app_version").
		Select("e.os_version").
		Select("e.device_manufacturer").
		Select("e.device_name").
		Select("groupUniqArray(e.network_provider)").
		Select("groupUniqArray(e.network_type)").
		Select("groupUniqArray(e.network_generation)").
		Select("groupUniqArray(e.device_locale)").
		Select("toUInt64(count())").
		Select("toUInt64(countIf(status_code >= 200 AND status_code < 300))").
		Select("toUInt64(countIf(status_code >= 300 AND status_code < 400))").
		Select("toUInt64(countIf(status_code >= 400 AND status_code < 500))").
		Select("toUInt64(countIf(status_code >= 500 AND status_code < 600))").
		Select("quantilesState(0.5, 0.75, 0.90, 0.95, 0.99, 1.0)(e.latency_ms)").
		From(`http_events e
			JOIN (
				SELECT DISTINCT domain, path FROM url_patterns FINAL
				WHERE team_id = ? AND app_id = ?
			) p ON e.domain = p.domain AND multiIf(
				endsWith(p.path, '**') AND position(substring(p.path, 1, length(p.path) - 2), '*') = 0, startsWith(e.path, substring(p.path, 1, length(p.path) - 2)),
				position(p.path, '*') > 0, e.path LIKE replaceAll(p.path, '*', '%'),
				e.path = p.path
			)`, teamID, appID).
		Where("e.team_id = ?", teamID).
		Where("e.app_id = ?", appID).
		Where("e.inserted_at >= ?", from).
		Where("e.inserted_at < ?", to).
		Where("e.latency_ms <= 60000").
		Where("e.status_code != 0").
		Where("e.domain != ''").
		Where("e.path != ''").
		GroupBy("e.team_id").
		GroupBy("e.app_id").
		GroupBy("ts").
		GroupBy("e.protocol").
		GroupBy("e.port").
		GroupBy("e.domain").
		GroupBy("p.path").
		GroupBy("e.method").
		GroupBy("e.status_code").
		GroupBy("e.app_version").
		GroupBy("e.os_version").
		GroupBy("e.device_manufacturer").
		GroupBy("e.device_name")
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
	ctx, span := tracer.Start(ctx, "pg.upsert-metrics-reported-at")
	defer span.End()

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
	ctx, span := tracer.Start(ctx, "pg.upsert-pattern-generated-at")
	defer span.End()

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
	ctx, span := tracer.Start(ctx, "ch.fetch-http-events")
	defer span.End()
	span.SetAttributes(attribute.String("app_id", appID.String()))

	stmt := sqlf.
		Select("team_id, app_id, domain, path, count() as cnt").
		From("http_events").
		Where("team_id = ?", teamID).
		Where("app_id = ?", appID).
		Where("inserted_at >= ?", from).
		Where("inserted_at < ?", to).
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
