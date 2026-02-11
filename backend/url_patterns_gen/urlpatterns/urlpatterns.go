package urlpatterns

import (
	"context"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"time"

	"backend/url_patterns_gen/server"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

// systemUUID is used for created_by/updated_by for system-generated records.
var systemUUID = uuid.UUID{}

// nanoTimeFormat is the timestamp format for ClickHouse DateTime64(9).
const nanoTimeFormat = "2006-01-02 15:04:05.000000000"

// minRequestCount is the minimum number of requests a pattern must
// have to be created as a new entry.
const minRequestCount = 1

type team struct {
	ID uuid.UUID
}

type app struct {
	ID     uuid.UUID
	TeamID uuid.UUID
}

type existingPattern struct {
	ID          uuid.UUID
	Origin      string
	PathPattern string
}

// patternKey is a composite key for origin + path_pattern.
type patternKey struct {
	Origin      string
	PathPattern string
}

// patternRule defines a regex and its replacement placeholder.
type patternRule struct {
	regex       *regexp.Regexp
	placeholder string
}

// rules defines the pattern matching rules in priority order.
// Earlier rules take precedence — once a segment matches, later
// rules are skipped for that segment.
var rules = []patternRule{
	{regexp.MustCompile(`[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}`), "{uuid}"},
	{regexp.MustCompile(`\b[0-9a-fA-F]{40}\b`), "{sha1}"},
	{regexp.MustCompile(`\b[0-9a-fA-F]{32}\b`), "{md5}"},
	// ISO 8601
	{regexp.MustCompile(`\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:[+-][0-2]\d:[0-5]\d|Z)`), "{date}"},
	// ANSI C date
	{regexp.MustCompile(`(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\d{4}`), "{date}"},
	// RFC 2822 date
	{regexp.MustCompile(`(?:(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat),\s+)?(?:0[1-9]|[12]\d|3[01])\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(?:19\d{2}|[2-9]\d{3})\s+(?:2[0-3]|[01]\d):[0-5]\d(?::(?:60|[0-5]\d))?\s+(?:[-+]\d{2}[0-5]\d|UT|GMT|(?:E|C|M|P)(?:ST|DT)|[A-IK-Z])`), "{date}"},
	// Hex number (0x prefix)
	{regexp.MustCompile(`\b0[xX][0-9a-fA-F]+\b`), "{hex}"},
	// Integer (segment containing 2+ consecutive digits)
	{regexp.MustCompile(`\d{2,}`), "{int}"},
}

func Generate(ctx context.Context) {
	fmt.Println("Starting URL patterns generation...")

	teams, err := getTeams(ctx)
	if err != nil {
		fmt.Printf("Failed to fetch teams: %v\n", err)
		return
	}

	for _, t := range teams {
		apps, err := getApps(ctx, t.ID)
		if err != nil {
			fmt.Printf("Failed to fetch apps for team %v: %v\n", t.ID, err)
			continue
		}

		for _, a := range apps {
			if err := processApp(ctx, t.ID, a.ID); err != nil {
				fmt.Printf("Failed to process app %v (team %v): %v\n", a.ID, t.ID, err)
			}
		}
	}

	fmt.Println("Finished URL patterns generation")
}

func processApp(ctx context.Context, teamID, appID uuid.UUID) error {
	now := time.Now().UTC()
	from := now.Add(-1 * time.Hour)

	// get HTTP URLs with counts from last hour
	urlCounts, err := getHTTPUrlCounts(ctx, appID, from, now)
	if err != nil {
		return fmt.Errorf("fetching HTTP URLs: %w", err)
	}
	if len(urlCounts) == 0 {
		return nil
	}

	// apply regex to each URL, sum counts per (origin, path_pattern) pair
	patternCounts := make(map[patternKey]uint64)
	for rawURL, count := range urlCounts {
		pattern := generatePattern(rawURL)
		u, err := url.Parse(pattern)
		if err != nil {
			continue
		}
		key := patternKey{
			Origin:      u.Scheme + "://" + u.Host,
			PathPattern: u.Path,
		}
		patternCounts[key] += count
	}

	// get existing patterns for this team+app
	existing, err := getExistingPatterns(ctx, teamID, appID)
	if err != nil {
		return fmt.Errorf("fetching existing patterns: %w", err)
	}
	existingMap := make(map[patternKey]uuid.UUID, len(existing))
	for _, ep := range existing {
		existingMap[patternKey{Origin: ep.Origin, PathPattern: ep.PathPattern}] = ep.ID
	}

	// partition into update vs insert
	var updateIDs []uuid.UUID
	var newPatterns []patternKey

	for key, count := range patternCounts {
		if id, exists := existingMap[key]; exists {
			updateIDs = append(updateIDs, id)
		} else if count >= minRequestCount {
			newPatterns = append(newPatterns, key)
		}
	}

	if len(updateIDs) > 0 {
		if err := updateLastSeen(ctx, updateIDs, now); err != nil {
			return fmt.Errorf("updating last_seen_at: %w", err)
		}
	}

	if len(newPatterns) > 0 {
		if err := insertPatterns(ctx, teamID, appID, newPatterns, now); err != nil {
			return fmt.Errorf("inserting new patterns: %w", err)
		}
	}

	return nil
}

// generatePattern applies regex rules to a URL to produce a
// normalized pattern. Query params and fragment are stripped.
func generatePattern(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}

	u.RawQuery = ""
	u.Fragment = ""

	segments := strings.Split(u.Path, "/")
	for i, seg := range segments {
		if seg == "" {
			continue
		}
		for _, rule := range rules {
			if rule.regex.MatchString(seg) {
				segments[i] = rule.placeholder
				break
			}
		}
	}
	u.Path = strings.Join(segments, "/")

	return u.String()
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

func getApps(ctx context.Context, teamID uuid.UUID) ([]app, error) {
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

func getHTTPUrlCounts(ctx context.Context, appID uuid.UUID, from, to time.Time) (map[string]uint64, error) {
	stmt := sqlf.
		From("events").
		Select("`http.url`").
		Select("count() as cnt").
		Where("app_id = toUUID(?)", appID).
		Where("type = 'http'").
		Where("`http.url` != ''").
		Where("timestamp >= ?", from).
		Where("timestamp < ?", to).
		GroupBy("`http.url`")
	defer stmt.Close()

	rows, err := server.Server.RchPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]uint64)
	for rows.Next() {
		var u string
		var cnt uint64
		if err := rows.Scan(&u, &cnt); err != nil {
			return nil, err
		}
		result[u] = cnt
	}

	return result, nil
}

func getExistingPatterns(ctx context.Context, teamID, appID uuid.UUID) ([]existingPattern, error) {
	stmt := sqlf.
		From("url_patterns").
		Select("id").
		Select("origin").
		Select("path_pattern").
		Where("team_id = toUUID(?)", teamID).
		Where("app_id = toUUID(?)", appID)
	defer stmt.Close()

	rows, err := server.Server.RchPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var patterns []existingPattern
	for rows.Next() {
		var ep existingPattern
		if err := rows.Scan(&ep.ID, &ep.Origin, &ep.PathPattern); err != nil {
			return nil, err
		}
		patterns = append(patterns, ep)
	}

	return patterns, nil
}

func updateLastSeen(ctx context.Context, ids []uuid.UUID, now time.Time) error {
	idStrs := make([]string, len(ids))
	for i, id := range ids {
		idStrs[i] = fmt.Sprintf("'%s'", id.String())
	}

	query := fmt.Sprintf(
		"ALTER TABLE url_patterns UPDATE last_seen_at = '%s' WHERE id IN (%s)",
		now.Format(nanoTimeFormat),
		strings.Join(idStrs, ", "),
	)

	return server.Server.ChPool.Exec(ctx, query)
}

func insertPatterns(ctx context.Context, teamID, appID uuid.UUID, patterns []patternKey, now time.Time) error {
	for _, p := range patterns {
		stmt := sqlf.
			InsertInto("url_patterns").
			Set("id", uuid.New()).
			Set("team_id", teamID).
			Set("app_id", appID).
			Set("origin", p.Origin).
			Set("path_pattern", p.PathPattern).
			Set("created_at", now.Format(nanoTimeFormat)).
			Set("created_by", systemUUID).
			Set("updated_by", systemUUID).
			Set("last_seen_at", now.Format(nanoTimeFormat)).
			Set("is_blocked", false)

		asyncCtx := clickhouse.Context(ctx, clickhouse.WithAsync(true))
		if err := server.Server.ChPool.Exec(asyncCtx, stmt.String(), stmt.Args()...); err != nil {
			stmt.Close()
			return err
		}

		stmt.Close()
	}

	return nil
}
