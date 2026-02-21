package processor

import (
	"context"
	"fmt"
	"sort"
	"time"

	"backend/url-processor/server"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

// RawPathRow represents a single row from the http_events
// query, pre-aggregated by ClickHouse.
type RawPathRow struct {
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

// groupKey identifies a unique (team, app, domain) combination.
type groupKey struct {
	TeamID uuid.UUID
	AppID  uuid.UUID
	Domain string
}

// insertKey deduplicates inserts by (team, app, domain, path).
type insertKey struct {
	TeamID uuid.UUID
	AppID  uuid.UUID
	Domain string
	Path   string
}

// Process is the main entry point called by the cron job.
// It discovers URL patterns from raw HTTP traffic,
// normalizes dynamic path segments, consolidates similar
// paths via a trie, and stores the top patterns.
func Process(ctx context.Context) {
	start := time.Now()
	now := start.UTC()
	from := now.AddDate(0, -1, 0)

	fmt.Printf("URL pattern processing started at %s, lookback window: %s to %s\n",
		start.Format(time.RFC3339), from.Format(time.RFC3339), now.Format(time.RFC3339))

	rows, err := fetchRawPaths(ctx, from, now)
	if err != nil {
		fmt.Printf("Failed to fetch raw paths: %v\n", err)
		return
	}

	if len(rows) == 0 {
		fmt.Printf("No HTTP events found between %s and %s, skipping\n",
			from.Format(time.RFC3339), now.Format(time.RFC3339))
		return
	}

	fmt.Printf("Fetched %d raw path rows from http_events\n", len(rows))

	// Step 2 & 3: Normalize paths and aggregate by (team, app, domain).
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

	fmt.Printf("Normalized paths into %d groups\n", len(groups))

	// Step 4 & 5: Build trie per group, extract and.
	// Deduplicate across groups by (team, app, domain, path).
	seen := make(map[insertKey]struct{})
	var totalPatterns int

	insertStmt := sqlf.InsertInto("url_patterns")
	defer insertStmt.Close()

	for key, paths := range groups {
		trie := NewTrie()
		for path, count := range paths {
			trie.Insert(path, count)
		}

		patterns := trie.ExtractPatterns()

		// Take top 10 by count.
		sort.Slice(patterns, func(i, j int) bool {
			return patterns[i].Count > patterns[j].Count
		})
		if len(patterns) > 10 {
			patterns = patterns[:10]
		}

		fmt.Printf("Group team=%s app=%s domain=%s: %d unique paths -> %d patterns\n",
			key.TeamID, key.AppID, key.Domain, len(paths), len(patterns))

		for _, p := range patterns {
			ik := insertKey{
				TeamID: key.TeamID,
				AppID:  key.AppID,
				Domain: key.Domain,
				Path:   p.Path,
			}
			if _, exists := seen[ik]; exists {
				continue
			}
			seen[ik] = struct{}{}

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
		fmt.Println("No patterns to insert, skipping")
		return
	}

	if err := server.Server.ChPool.AsyncInsert(ctx, insertStmt.String(), true, insertStmt.Args()...); err != nil {
		fmt.Printf("Failed to insert patterns: %v\n", err)
		return
	}

	fmt.Printf("URL pattern processing completed in %v: %d patterns inserted\n",
		time.Since(start), totalPatterns)
}

// fetchRawPaths queries http_events for the given time
// range, pre-aggregated by (team_id, app_id, domain, path).
func fetchRawPaths(ctx context.Context, from, now time.Time) ([]RawPathRow, error) {
	stmt := sqlf.
		Select("team_id, app_id, domain, path, count() as cnt").
		From("http_events").
		Where("timestamp >= ?", from).
		Where("timestamp < ?", now).
		Where("domain != ''").
		Where("path != ''").
		GroupBy("team_id, app_id, domain, path")

	defer stmt.Close()

	rows, err := server.Server.RchPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, fmt.Errorf("query http_events: %w", err)
	}

	var result []RawPathRow
	for rows.Next() {
		var row RawPathRow
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