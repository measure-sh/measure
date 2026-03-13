package network

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"backend/alerts/server"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

const (
	// patternsDefaultLookbackPeriod is how far back to query
	// http_events to generate patterns
	patternsDefaultLookbackPeriod = 1 * time.Hour

	// metricsFallbackLookbackPeriod is how far back to query
	// http_events when no prior reporting timestamp
	// exists.
	metricsFallbackLookbackPeriod = 1 * time.Hour

	// patternMinRequestCountThreshold is the
	// minimum request count a pattern must have
	// to be kept.
	//
	// Higher values will result in fewer, more
	// general patterns, while lower values will
	// keep more specific patterns that may be
	// based on very few requests.
	//
	// This also depends on the job frequency - more
	// frequent runs can use a lower threshold since
	// they will have less new data each time.
	patternMinRequestCountThreshold = 100

	// segmentCollapseThreshold is the maximum
	// number of distinct children a trie node may have
	// before it collapses into a wildcard pattern.
	segmentCollapseThreshold = 10
)

var tracer = otel.Tracer("network-metrics-job")

// Regular expressions for normalizing incoming paths
// from raw events
var (
	uuidRe = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
	sha1Re = regexp.MustCompile(`(?i)^[0-9a-f]{40}$`)
	md5Re  = regexp.MustCompile(`(?i)^[0-9a-f]{32}$`)
	dateRe = regexp.MustCompile(`\d{4}-[01]\d-[0-3]\dT`)
	hexRe  = regexp.MustCompile(`(?i)^0x[0-9a-f]+$`)
	intRe  = regexp.MustCompile(`\d{2,}`)
)

// A team row in Postgres
type team struct {
	ID uuid.UUID
}

// An app row in Postgres
type app struct {
	ID     uuid.UUID
	TeamID uuid.UUID
}

// HttpEvent represents a single row
// from the http_events table
type HttpEvent struct {
	TeamID    uuid.UUID
	AppID     uuid.UUID
	Domain    string
	Path      string
	Frequency uint64
}

func partsToUrl(parts []string) string {
	return strings.Join(parts, "/")
}

func urlPatternIndex(patterns []UrlPattern) map[string]UrlPattern {
	m := make(map[string]UrlPattern, len(patterns))
	for _, p := range patterns {
		m[partsToUrl(p.Parts)] = p
	}
	return m
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

// getLastReportedMetricsAt gives last timestamp
// when metrics were reported for the given
// team and app.
func getLastReportedMetricsAt(ctx context.Context, teamID, appID uuid.UUID) (*time.Time, error) {
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
		return nil, fmt.Errorf("failed to query network_metrics_reporting: %w", err)
	}

	return reportedAt, nil
}

// fetchExistingPatterns queries existing URL patterns from ClickHouse
// for the given team and app.
func fetchExistingPatterns(ctx context.Context, teamID, appID uuid.UUID) ([]UrlPattern, error) {
	stmt := sqlf.
		Select("domain, path").
		From("url_patterns FINAL").
		Where("team_id = ?", teamID).
		Where("app_id = ?", appID)
	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, fmt.Errorf("failed to query url_patterns: %w", err)
	}
	defer rows.Close()

	var result []UrlPattern

	for rows.Next() {
		var domain string
		var path string

		if err := rows.Scan(&domain, &path); err != nil {
			return nil, fmt.Errorf("failed to scan url_patterns row: %w", err)
		}

		segments := strings.Split(strings.TrimPrefix(path, "/"), "/")

		parts := make([]string, 0, len(segments)+1)
		parts = append(parts, domain)
		if len(segments) > 0 && segments[0] != "" {
			parts = append(parts, segments...)
		}

		result = append(result, UrlPattern{
			Parts: parts,
			// existing patterns set frequency to 1
			// to avoid getting removed when read
			// back from trie
			Frequency: 1,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating url_patterns rows: %w", err)
	}

	return result, nil
}

// insertPatterns inserts or updates URL patterns.
func insertPatterns(ctx context.Context, patterns []UrlPattern, teamID, appID uuid.UUID) error {
	if len(patterns) == 0 {
		return nil
	}

	now := time.Now().UTC()
	stmt := sqlf.InsertInto("url_patterns")

	for _, p := range patterns {
		domain := p.Parts[0]
		path := "/" + strings.Join(p.Parts[1:], "/")

		stmt.NewRow().
			Set("team_id", teamID).
			Set("app_id", appID).
			Set("domain", domain).
			Set("path", path).
			Set("updated_at", now).
			Set("updated_by", uuid.Nil).
			Set("deleted", false)
	}

	if err := server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
		return fmt.Errorf("failed to insert patterns: %w", err)
	}

	return nil
}

// deletePatterns performs a soft-delete by inserting a tombstone record.
// This is preferred over ALTER TABLE DELETE for performance reasons.
func deletePatterns(ctx context.Context, patterns []UrlPattern, teamID, appID uuid.UUID) error {
	if len(patterns) == 0 {
		return nil
	}

	now := time.Now().UTC()
	stmt := sqlf.InsertInto("url_patterns")

	for _, p := range patterns {
		domain := p.Parts[0]
		path := "/" + strings.Join(p.Parts[1:], "/")

		stmt.NewRow().
			Set("team_id", teamID).
			Set("app_id", appID).
			Set("domain", domain).
			Set("path", path).
			Set("updated_at", now).
			Set("updated_by", uuid.Nil).
			Set("deleted", true)
	}

	if err := server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
		return fmt.Errorf("failed to delete patterns: %w", err)
	}

	return nil
}

func insertAggregatedMetrics(ctx context.Context, teamID, appID uuid.UUID, from, to time.Time) error {
	stmt := sqlf.
		Select("e.team_id").
		Select("e.app_id").
		Select("toDateTime64(toStartOfFifteenMinutes(e.timestamp), 3) AS time_bucket").
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
		Select("quantilesState(0.5, 0.75, 0.9, 0.95, 0.99)(toInt64(e.latency_ms))").
		// Build a histogram of event counts bucketed by
		// time-in-session. Each event's session_elapsed_ms
		// is rounded down to the nearest 5-second interval
		// and the counts are summed per bucket across rows.
		Select("sumMapIf([toUInt32(intDiv(e.session_elapsed_ms, 5000) * 5)], [toUInt64(1)], e.session_elapsed_ms > 0)").
		Select("uniqCombined64State(e.session_id)").
		// The multiIf uses different matching strategies
		// based on the pattern type:
		// - patterns ending with "**" and no other "*" are matched with startsWith
		// - patterns with "*" in the middle are matched with LIKE
		// - exact matches are matched with equality
		From(`http_events e
			JOIN (
				SELECT domain, path FROM url_patterns FINAL
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
		// Cap latency at 60s to exclude long-lived HTTP connections where
		// latency_ms reflects total connection duration rather than TTFB.
		Where("e.latency_ms <= 60000").
		// Exclude requests that failed on the client side.
		Where("e.status_code != 0").
		GroupBy("e.team_id").
		GroupBy("e.app_id").
		GroupBy("time_bucket").
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

// fetchHttpEvents queries http_events for inserted events
// for the given team, app and time range, pre-aggregated
// by (domain, path).
func fetchHttpEvents(ctx context.Context, teamID, appID uuid.UUID, from, to time.Time) ([]HttpEvent, error) {
	stmt := sqlf.
		Select("team_id, app_id, domain, path, count() as cnt").
		From("http_events").
		Where("team_id = ?", teamID).
		Where("app_id = ?", appID).
		Where("inserted_at >= ?", from).
		Where("inserted_at < ?", to).
		GroupBy("team_id, app_id, domain, path")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, fmt.Errorf("failed to query http_events: %w", err)
	}

	var result []HttpEvent
	for rows.Next() {
		var row HttpEvent
		if err := rows.Scan(&row.TeamID, &row.AppID, &row.Domain, &row.Path, &row.Frequency); err != nil {
			return nil, fmt.Errorf("failed to scan http_events row: %w", err)
		}
		result = append(result, row)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating http_events rows: %w", err)
	}

	return result, nil
}

// normalizePath splits a URL path by "/" and normalizes each
// segment, replacing dynamic values (UUIDs, hashes, dates,
// hex numbers, integers) with "*".
func normalizePath(path string) string {
	segments := strings.Split(path, "/")
	for i, seg := range segments {
		if seg != "" {
			segments[i] = normalizeSegment(seg)
		}
	}
	return strings.Join(segments, "/")
}

// normalizeSegment checks a single path segment against
// known dynamic patterns and returns "*" if any match.
func normalizeSegment(seg string) string {
	if uuidRe.MatchString(seg) {
		return "*"
	}
	if sha1Re.MatchString(seg) {
		return "*"
	}
	if md5Re.MatchString(seg) {
		return "*"
	}
	if dateRe.MatchString(seg) {
		return "*"
	}
	if hexRe.MatchString(seg) {
		return "*"
	}
	if intRe.MatchString(seg) {
		return "*"
	}
	return seg
}

// GeneratePatterns converts raw URLs from
// http_events into generalized URL patterns
// with wildcards and stores them in
// the url_patterns table.
func GeneratePatterns(ctx context.Context) {
	fmt.Println("Starting network url pattern generation job...")
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
			appCtx, appSpan := tracer.Start(ctx, "generate-patterns-app",
				trace.WithAttributes(
					attribute.String("team_id", app.TeamID.String()),
					attribute.String("app_id", app.ID.String()),
				))

			// look back for new events inserted
			from := now.Add(-patternsDefaultLookbackPeriod)
			events, err := fetchHttpEvents(appCtx, app.TeamID, app.ID, from, now)
			if err != nil {
				fmt.Printf("failed to fetch http events for team=%s app=%s: %v\n",
					app.TeamID, app.ID, err)
				appSpan.RecordError(err)
				appSpan.SetStatus(codes.Error, "failed to fetch http events")
				appSpan.End()
				continue
			}

			// no new events, skip to next app
			if len(events) == 0 {
				appSpan.End()
				continue
			}

			trie := NewUrlTrie(segmentCollapseThreshold)

			// Seed trie with existing patterns
			existing, err := fetchExistingPatterns(appCtx, app.TeamID, app.ID)
			if err != nil {
				fmt.Printf("failed to fetch existing patterns for team=%s app=%s: %v\n",
					app.TeamID, app.ID, err)
				appSpan.RecordError(err)
				appSpan.SetStatus(codes.Error, "failed to fetch existing patterns")
				appSpan.End()
				continue
			}
			for _, p := range existing {
				trie.Insert(UrlPattern{Parts: p.Parts, Frequency: p.Frequency})
			}

			// Insert new URLs into trie
			for _, event := range events {
				normalizedPath := normalizePath(event.Path)
				parts := append([]string{event.Domain}, strings.Split(strings.TrimPrefix(normalizedPath, "/"), "/")...)
				trie.Insert(UrlPattern{Parts: parts, Frequency: event.Frequency})
			}

			// get patterns from trie
			generated := trie.GetPatterns()
			existingMap := urlPatternIndex(existing)
			generatedMap := urlPatternIndex(generated)

			// identify new or reoccurring patterns for insertion
			insert := make([]UrlPattern, 0)
			for url, p := range generatedMap {
				_, exists := existingMap[url]
				if !exists {
					// new pattern discovered
					if p.Frequency >= patternMinRequestCountThreshold {
						insert = append(insert, p)
					}
				} else if p.Frequency > 1 {
					// found existing pattern with traffic
					insert = append(insert, p)
				}
			}

			// insert patterns
			if err := insertPatterns(appCtx, insert, app.TeamID, app.ID); err != nil {
				fmt.Printf("failed to insert for team=%s app=%s: %v\n",
					app.TeamID, app.ID, err)
				appSpan.RecordError(err)
				appSpan.SetStatus(codes.Error, "failed to insert url patterns")
				appSpan.End()
				continue
			}

			// delete stale patterns
			delete := make([]UrlPattern, 0)
			for url, p := range existingMap {
				if _, exists := generatedMap[url]; !exists {
					delete = append(delete, p)
				}
			}
			if err := deletePatterns(appCtx, delete, app.TeamID, app.ID); err != nil {
				fmt.Printf("failed to delete for team=%s app=%s: %v\n",
					app.TeamID, app.ID, err)
				appSpan.RecordError(err)
				appSpan.SetStatus(codes.Error, "failed to delete stale url patterns")
				appSpan.End()
				continue
			}
			appSpan.End()
		}
	}
}

// GenerateMetrics pre-aggregates HTTP event data into
// the http_metrics table for each known app.
func GenerateMetrics(ctx context.Context) {
	fmt.Println("Starting network metrics job...")
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

	for _, t := range teams {
		apps, err := getAppsForTeam(ctx, t.ID)
		if err != nil {
			fmt.Printf("failed to fetch apps for team=%s: %v\n", t.ID, err)
			continue
		}

		for _, app := range apps {
			appCtx, appSpan := tracer.Start(ctx, "generate-metrics-app",
				trace.WithAttributes(
					attribute.String("team_id", app.TeamID.String()),
					attribute.String("app_id", app.ID.String()),
				))

			from, err := getLastReportedMetricsAt(appCtx, app.TeamID, app.ID)
			if err != nil {
				fmt.Printf("failed to get last metrics_reported_at for team=%s app=%s: %v\n",
					app.TeamID, app.ID, err)
				appSpan.RecordError(err)
				appSpan.SetStatus(codes.Error, "failed to get last metrics_reported_at")
				appSpan.End()
				continue
			}

			if from == nil {
				// If no prior reporting timestamp exists,
				// backfill metrics for the default lookback
				// period
				defaultFrom := now.Add(-metricsFallbackLookbackPeriod)
				from = &defaultFrom
			}

			if err := insertAggregatedMetrics(appCtx, app.TeamID, app.ID, *from, now); err != nil {
				fmt.Printf("failed to insert metrics for team=%s app=%s: %v\n",
					app.TeamID, app.ID, err)
				appSpan.RecordError(err)
				appSpan.SetStatus(codes.Error, "failed to insert metrics")
				appSpan.End()
				continue
			}

			if err := upsertMetricsReportedAt(appCtx, app.TeamID, app.ID, now); err != nil {
				fmt.Printf("failed to upsert metrics_reported_at for team=%s app=%s: %v\n",
					app.TeamID, app.ID, err)
				appSpan.RecordError(err)
				appSpan.SetStatus(codes.Error, "failed to upsert metrics_reported_at")
				appSpan.End()
				continue
			}

			appSpan.End()
		}
	}
}
