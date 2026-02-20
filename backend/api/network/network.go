package network

import (
	"backend/api/filter"
	"backend/api/server"
	"context"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
	"golang.org/x/sync/errgroup"
)

// MetricsDataPoint represents a single data point
// in a time series.
type MetricsDataPoint map[string]any

// MetricsResponse contains all network metrics
// grouped by category.
type MetricsResponse struct {
	Latency     []MetricsDataPoint `json:"latency"`
	StatusCodes []MetricsDataPoint `json:"status_codes"`
}

// TrendsEndpoint represents metrics for
// a single endpoint.
type TrendsEndpoint struct {
	Domain      string   `json:"domain"`
	PathPattern string   `json:"path_pattern"`
	P95Latency  *float64 `json:"p95_latency"`
	ErrorRate   *float64 `json:"error_rate"`
	Frequency   uint64   `json:"frequency"`
}

// TrendsResponse contains high-level network
// performance summary metrics.
type TrendsResponse struct {
	TrendsLatency   []TrendsEndpoint `json:"trends_latency"`
	TrendsErrorRate []TrendsEndpoint `json:"trends_error_rate"`
	TrendsFrequency []TrendsEndpoint `json:"trends_frequency"`
}

// topN is the default number of endpoints to return
// in each overview category.
const topN = 100

// ParseURL splits a full URL into domain (hostname)
// and path components.
func ParseURL(rawURL string) (domain, path string, err error) {
	i := strings.Index(rawURL, "/")
	if i < 0 {
		err = fmt.Errorf("invalid url: missing path separator")
		return
	}
	domain = rawURL[:i]
	path = rawURL[i:]
	return
}

// FetchDomains returns list of
// unique domains for a given
// app and team.
func FetchDomains(ctx context.Context, appId, teamId uuid.UUID) (domains []string, err error) {
	stmt := sqlf.
		Select("domain").
		From("http_events").
		Where("team_id = ?", teamId).
		Where("app_id = ?", appId).
		Where("domain != ''").
		GroupBy("domain").
		OrderBy("count() DESC")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var domain string
		if err = rows.Scan(&domain); err != nil {
			return
		}
		if err = rows.Err(); err != nil {
			return
		}
		domains = append(domains, domain)
	}

	err = rows.Err()
	return
}

// FetchPaths returns list of unique paths
// for a given app, team and domain, ordered
// by request frequency.
func FetchPaths(ctx context.Context, appId, teamId uuid.UUID, domain, search string) (paths []string, err error) {
	stmt := sqlf.
		Select("path").
		From("http_rule_metrics").
		Where("team_id = ?", teamId).
		Where("app_id = ?", appId).
		Where("domain = ?", domain)

	if search != "" {
		stmt.Where("positionCaseInsensitive(path, ?) > 0", search)
	}

	stmt.GroupBy("path").
		OrderBy("sum(request_count) DESC").
		Limit(10)

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var path string
		if err = rows.Scan(&path); err != nil {
			return
		}
		if err = rows.Err(); err != nil {
			return
		}
		paths = append(paths, path)
	}

	err = rows.Err()
	if err != nil || len(paths) > 0 {
		return
	}

	fmt.Printf("No rule-based paths found for domain '%s', falling back to raw events\n", domain)
	// Fallback: query http_events when no rule-based paths found
	fallbackStmt := sqlf.
		Select("path").
		From("http_events").
		Where("team_id = ?", teamId).
		Where("app_id = ?", appId).
		Where("domain = ?", domain)

	if search != "" {
		fallbackStmt.Where("positionCaseInsensitive(path, ?) > 0", search)
	}

	fallbackStmt.GroupBy("path").
		OrderBy("count() DESC").
		Limit(10)

	defer fallbackStmt.Close()

	fallbackRows, err := server.Server.ChPool.Query(ctx, fallbackStmt.String(), fallbackStmt.Args()...)
	if err != nil {
		return
	}

	for fallbackRows.Next() {
		var path string
		if err = fallbackRows.Scan(&path); err != nil {
			return
		}
		if err = fallbackRows.Err(); err != nil {
			return
		}
		paths = append(paths, path)
	}

	err = fallbackRows.Err()
	return
}

// FetchTrends returns a high-level summary of
// network performance for a given app.
func FetchTrends(ctx context.Context, appId, teamId uuid.UUID, af *filter.AppFilter) (*TrendsResponse, error) {
	inner := sqlf.From("http_rule_metrics").
		Select("domain").
		Select("path").
		Select("quantilesMerge(0.5, 0.9, 0.95, 0.99)(latency_quantiles)[3] AS p95_latency").
		Select("sum(error_count) * 100.0 / sum(request_count) AS error_rate").
		Select("sum(request_count) AS frequency").
		Where("team_id = ? and app_id = ? and time_bucket >= ? and time_bucket <= ?", teamId, appId, af.From, af.To).
		GroupBy("domain, path")

	defer inner.Close()

	query := fmt.Sprintf(`WITH grouped AS (%s)
		SELECT 'latency' as category, domain, path, p95_latency, error_rate, frequency FROM grouped ORDER BY p95_latency DESC LIMIT %d
		UNION ALL
		SELECT 'error_rate' as category, domain, path, p95_latency, error_rate, frequency FROM grouped ORDER BY error_rate DESC LIMIT %d
		UNION ALL
		SELECT 'frequency' as category, domain, path, p95_latency, error_rate, frequency FROM grouped ORDER BY frequency DESC LIMIT %d`,
		inner.String(), topN, topN, topN)

	rows, err := server.Server.ChPool.Query(ctx, query, inner.Args()...)
	if err != nil {
		return nil, err
	}

	result := &TrendsResponse{
		TrendsLatency:   []TrendsEndpoint{},
		TrendsErrorRate: []TrendsEndpoint{},
		TrendsFrequency: []TrendsEndpoint{},
	}
	for rows.Next() {
		var category string
		var ep TrendsEndpoint
		var p95Latency, errorRate float64
		if err := rows.Scan(&category, &ep.Domain, &ep.PathPattern, &p95Latency, &errorRate, &ep.Frequency); err != nil {
			return nil, err
		}
		if err := rows.Err(); err != nil {
			return nil, err
		}
		ep.P95Latency = roundPtr(p95Latency)
		ep.ErrorRate = roundPtr(errorRate)
		switch category {
		case "latency":
			result.TrendsLatency = append(result.TrendsLatency, ep)
		case "error_rate":
			result.TrendsErrorRate = append(result.TrendsErrorRate, ep)
		case "frequency":
			result.TrendsFrequency = append(result.TrendsFrequency, ep)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return result, nil
}

// FetchMetrics queries http for latency
// percentiles, status code distribution and request
// frequency for the given domain and path pattern.
// It checks http_rules first; if an active rule exists,
// it uses a 2-hour buffer from now as the cutoff to combine
// pre-aggregated rule data with recent raw events. Otherwise
// falls back to raw http_events.
func FetchMetrics(ctx context.Context, appId, teamId uuid.UUID, domain, pathPattern string, af *filter.AppFilter) (*MetricsResponse, error) {
	active, err := isActiveRule(ctx, teamId, appId, domain, pathPattern)
	if err != nil {
		return nil, err
	}
	if !active {
		return fetchMetricsFromEvents(ctx, appId, teamId, domain, pathPattern, af, af.From, af.To)
	}

	cutoff := time.Now().UTC().Add(-2 * time.Hour)

	// If cutoff is at or past the end of the range,
	// rules table covers everything
	if !cutoff.Before(af.To) {
		return fetchMetricsFromRules(ctx, appId, teamId, domain, pathPattern, af, af.From, af.To)
	}

	// If cutoff is at or before the start,
	// events covers everything
	if !cutoff.After(af.From) {
		return fetchMetricsFromEvents(ctx, appId, teamId, domain, pathPattern, af, af.From, af.To)
	}

	// Split: query rules for [af.From, cutoff)
	// and events for [cutoff, af.To]
	var rulesResult, eventsResult *MetricsResponse
	g, gCtx := errgroup.WithContext(ctx)

	g.Go(func() error {
		var err error
		rulesResult, err = fetchMetricsFromRules(gCtx, appId, teamId, domain, pathPattern, af, af.From, cutoff.Add(-time.Second))
		return err
	})

	g.Go(func() error {
		var err error
		eventsResult, err = fetchMetricsFromEvents(gCtx, appId, teamId, domain, pathPattern, af, cutoff, af.To)
		return err
	})

	if err := g.Wait(); err != nil {
		return nil, err
	}

	return mergeMetricsResponses(rulesResult, eventsResult), nil
}

func GetRequestStatusOverview(ctx context.Context, appId, teamId uuid.UUID, af *filter.AppFilter) (result []MetricsDataPoint, err error) {
	format := datetimeFormat(af.From, af.To)
	stmt := sqlf.From("http_events").
		Select(fmt.Sprintf("formatDateTime(timestamp, '%s', ?) as datetime", format), af.Timezone).
		Select("countIf(status_code >= 200 and status_code < 600) as total_count").
		Select("countIf(status_code >= 200 and status_code < 300) as count_2xx").
		Select("countIf(status_code >= 300 and status_code < 400) as count_3xx").
		Select("countIf(status_code >= 400 and status_code < 500) as count_4xx").
		Select("countIf(status_code >= 500 and status_code < 600) as count_5xx").
		Where("team_id = ? and app_id = ? and timestamp >= ? and timestamp <= ?", teamId, appId, af.From, af.To)

	stmt.GroupBy("datetime")
	stmt.OrderBy("datetime")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	result = []MetricsDataPoint{}
	for rows.Next() {
		var datetime string
		var totalCount uint64
		var count2xx uint64
		var count3xx uint64
		var count4xx uint64
		var count5xx uint64
		if err = rows.Scan(&datetime, &totalCount, &count2xx, &count3xx, &count4xx, &count5xx); err != nil {
			return
		}
		if err = rows.Err(); err != nil {
			return
		}
		result = append(result, MetricsDataPoint{
			"datetime":    datetime,
			"total_count": totalCount,
			"count_2xx":   count2xx,
			"count_3xx":   count3xx,
			"count_4xx":   count4xx,
			"count_5xx":   count5xx,
		})
	}
	err = rows.Err()
	return
}

// applyPathFilter adds path matching
// to the query.
//
// Optimizes to use startsWith when
// possible, falls back to LIKE.
//
// * matches any characters
// ** at the end matches everything after prefix
func applyPathFilter(stmt *sqlf.Stmt, pathPattern string) {
	// Handle ** wildcards
	if prefix, ok := strings.CutSuffix(pathPattern, "**"); ok {
		if !strings.Contains(prefix, "*") {
			stmt.Where("startsWith(path, ?)", prefix)
		} else {
			likePattern := strings.ReplaceAll(prefix, "*", "%") + "%"
			stmt.Where("path LIKE ?", likePattern)
		}
		return
	}

	// Handle * wildcards
	if strings.Contains(pathPattern, "*") {
		likePattern := strings.ReplaceAll(pathPattern, "*", "%")
		stmt.Where("path LIKE ?", likePattern)
		return
	}

	// Exact match
	stmt.Where("path = ?", pathPattern)
}

// applyFilters applies common filters from AppFilter
// to the query statement.
func applyFilters(stmt *sqlf.Stmt, af *filter.AppFilter) {
	if af.HasVersions() {
		selectedVersions, err := af.VersionPairs()
		if err == nil {
			stmt.Where("app_version in (?)", selectedVersions.Parameterize())
		}
	}

	if af.HasNetworkTypes() {
		stmt.Where("network_type").In(af.NetworkTypes)
	}

	if af.HasNetworkGenerations() {
		stmt.Where("network_generation").In(af.NetworkGenerations)
	}

	if af.HasNetworkProviders() {
		stmt.Where("network_provider").In(af.NetworkProviders)
	}

	if af.HasOSVersions() {
		selectedOSVersions, err := af.OSVersionPairs()
		if err == nil {
			stmt.Where("os_version in (?)", selectedOSVersions.Parameterize())
		}
	}

	if af.HasDeviceManufacturers() {
		stmt.Where("device_manufacturer").In(af.DeviceManufacturers)
	}

	if af.HasDeviceLocales() {
		stmt.Where("device_locale").In(af.Locales)
	}
}

// datetimeFormat returns the ClickHouse format string
// for date-only grouping.
func datetimeFormat(from, to time.Time) string {
	return "%Y-%m-%d"
}

// roundPtr rounds a float64 to 1 decimal place
// and returns a pointer.
func roundPtr(v float64) *float64 {
	rounded := math.Round(v*10) / 10
	return &rounded
}

// isActiveRule checks if a domain+path combination
// has an active rule in the http_rules postgres table.
func isActiveRule(ctx context.Context, teamId, appId uuid.UUID, domain, path string) (bool, error) {
	stmt := sqlf.PostgreSQL.
		Select("1").
		From("measure.http_rules").
		Where("team_id = ?", teamId).
		Where("app_id = ?", appId).
		Where("domain = ?", domain).
		Where("path = ?", path).
		Where("is_active = true")
	defer stmt.Close()

	var one int
	err := server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&one)
	if err == pgx.ErrNoRows {
		return false, nil
	}
	return err == nil, err
}

// mergeMetricsResponses concatenates two MetricsResponse values.
func mergeMetricsResponses(a, b *MetricsResponse) *MetricsResponse {
	return &MetricsResponse{
		Latency:     append(a.Latency, b.Latency...),
		StatusCodes: append(a.StatusCodes, b.StatusCodes...),
	}
}

// fetchMetricsFromRules queries pre-aggregated data
// from http_rule_metrics for a known domain+path rule.
// The from and to parameters define the time range to query.
func fetchMetricsFromRules(ctx context.Context, appId, teamId uuid.UUID, domain, path string, af *filter.AppFilter, from, to time.Time) (result *MetricsResponse, err error) {
	result = &MetricsResponse{}

	// Fetch latency metrics
	format := datetimeFormat(af.From, af.To)
	latencyStmt := sqlf.From("http_rule_metrics").
		Select(fmt.Sprintf("formatDateTime(time_bucket, '%s', ?) as datetime", format), af.Timezone).
		Select("quantilesMerge(0.5, 0.9, 0.95, 0.99)(latency_quantiles) as latencies").
		Select("sumIf(request_count, status_code >= 200 and status_code < 600) as count").
		Where("team_id = ? and app_id = ? and domain = ? and path = ? and time_bucket >= ? and time_bucket <= ?", teamId, appId, domain, path, from, to)

	applyFilters(latencyStmt, af)

	latencyStmt.GroupBy("datetime")
	latencyStmt.OrderBy("datetime")

	defer latencyStmt.Close()

	latencyRows, err := server.Server.ChPool.Query(ctx, latencyStmt.String(), latencyStmt.Args()...)
	if err != nil {
		return
	}

	for latencyRows.Next() {
		var datetime string
		var latencies []float64
		var count uint64
		if err = latencyRows.Scan(&datetime, &latencies, &count); err != nil {
			return
		}
		if err = latencyRows.Err(); err != nil {
			return
		}
		data := MetricsDataPoint{"datetime": datetime, "count": count}
		if len(latencies) >= 4 {
			data["p50"] = roundPtr(float64(latencies[0]))
			data["p90"] = roundPtr(float64(latencies[1]))
			data["p95"] = roundPtr(float64(latencies[2]))
			data["p99"] = roundPtr(float64(latencies[3]))
		}
		result.Latency = append(result.Latency, data)
	}
	if err = latencyRows.Err(); err != nil {
		return
	}

	// Fetch status code metrics
	statusStmt := sqlf.From("http_rule_metrics").
		Select(fmt.Sprintf("formatDateTime(time_bucket, '%s', ?) as datetime", format), af.Timezone).
		Select("sumIf(request_count, status_code >= 200 and status_code < 600) as total_count").
		Select("sumIf(request_count, status_code >= 200 and status_code < 300) as count_2xx").
		Select("sumIf(request_count, status_code >= 300 and status_code < 400) as count_3xx").
		Select("sumIf(request_count, status_code >= 400 and status_code < 500) as count_4xx").
		Select("sumIf(request_count, status_code >= 500 and status_code < 600) as count_5xx").
		Where("team_id = ? and app_id = ? and domain = ? and path = ? and time_bucket >= ? and time_bucket <= ?", teamId, appId, domain, path, from, to).
		Where("status_code != 0")

	applyFilters(statusStmt, af)

	statusStmt.GroupBy("datetime")
	statusStmt.OrderBy("datetime")

	defer statusStmt.Close()

	statusRows, err := server.Server.ChPool.Query(ctx, statusStmt.String(), statusStmt.Args()...)
	if err != nil {
		return
	}

	for statusRows.Next() {
		var datetime string
		var totalCount, count2xx, count3xx, count4xx, count5xx uint64
		if err = statusRows.Scan(&datetime, &totalCount, &count2xx, &count3xx, &count4xx, &count5xx); err != nil {
			return
		}
		if err = statusRows.Err(); err != nil {
			return
		}
		result.StatusCodes = append(result.StatusCodes, MetricsDataPoint{
			"datetime":    datetime,
			"total_count": totalCount,
			"count_2xx":   count2xx,
			"count_3xx":   count3xx,
			"count_4xx":   count4xx,
			"count_5xx":   count5xx,
		})
	}
	if err = statusRows.Err(); err != nil {
		return
	}

	return
}

// fetchMetricsFromEvents queries raw http_events
// for endpoints that don't have pre-aggregated rule data.
// The from and to parameters define the time range to query.
func fetchMetricsFromEvents(ctx context.Context, appId, teamId uuid.UUID, domain, pathPattern string, af *filter.AppFilter, from, to time.Time) (result *MetricsResponse, err error) {
	result = &MetricsResponse{}

	// Fetch latency metrics
	format := datetimeFormat(af.From, af.To)
	latencyStmt := sqlf.From("http_events").
		Select(fmt.Sprintf("formatDateTime(timestamp, '%s', ?) as datetime", format), af.Timezone).
		Select("quantiles(0.50, 0.90, 0.95, 0.99)(latency_ms) as latencies").
		Select("countIf(status_code >= 200 and status_code < 600) as count").
		Where("team_id = ? and app_id = ? and domain = ? and timestamp >= ? and timestamp <= ?", teamId, appId, domain, from, to)

	applyPathFilter(latencyStmt, pathPattern)
	applyFilters(latencyStmt, af)

	latencyStmt.GroupBy("datetime")
	latencyStmt.OrderBy("datetime")

	defer latencyStmt.Close()

	latencyRows, err := server.Server.ChPool.Query(ctx, latencyStmt.String(), latencyStmt.Args()...)
	if err != nil {
		return
	}

	for latencyRows.Next() {
		var datetime string
		var latencies []float64
		var count uint64
		if err = latencyRows.Scan(&datetime, &latencies, &count); err != nil {
			return
		}
		if err = latencyRows.Err(); err != nil {
			return
		}
		data := MetricsDataPoint{"datetime": datetime, "count": count}
		if len(latencies) >= 4 {
			data["p50"] = roundPtr(float64(latencies[0]))
			data["p90"] = roundPtr(float64(latencies[1]))
			data["p95"] = roundPtr(float64(latencies[2]))
			data["p99"] = roundPtr(float64(latencies[3]))
		}
		result.Latency = append(result.Latency, data)
	}
	if err = latencyRows.Err(); err != nil {
		return
	}

	// Fetch status code metrics
	statusStmt := sqlf.From("http_events").
		Select(fmt.Sprintf("formatDateTime(timestamp, '%s', ?) as datetime", format), af.Timezone).
		Select("countIf(status_code >= 200 and status_code < 600) as total_count").
		Select("countIf(status_code >= 200 and status_code < 300) as count_2xx").
		Select("countIf(status_code >= 300 and status_code < 400) as count_3xx").
		Select("countIf(status_code >= 400 and status_code < 500) as count_4xx").
		Select("countIf(status_code >= 500 and status_code < 600) as count_5xx").
		Where("team_id = ? and app_id = ? and domain = ? and timestamp >= ? and timestamp <= ?", teamId, appId, domain, from, to).
		Where("status_code != 0")

	applyPathFilter(statusStmt, pathPattern)
	applyFilters(statusStmt, af)

	statusStmt.GroupBy("datetime")
	statusStmt.OrderBy("datetime")

	defer statusStmt.Close()

	statusRows, err := server.Server.ChPool.Query(ctx, statusStmt.String(), statusStmt.Args()...)
	if err != nil {
		return
	}

	for statusRows.Next() {
		var datetime string
		var totalCount, count2xx, count3xx, count4xx, count5xx uint64
		if err = statusRows.Scan(&datetime, &totalCount, &count2xx, &count3xx, &count4xx, &count5xx); err != nil {
			return
		}
		if err = statusRows.Err(); err != nil {
			return
		}
		result.StatusCodes = append(result.StatusCodes, MetricsDataPoint{
			"datetime":    datetime,
			"total_count": totalCount,
			"count_2xx":   count2xx,
			"count_3xx":   count3xx,
			"count_4xx":   count4xx,
			"count_5xx":   count5xx,
		})
	}
	if err = statusRows.Err(); err != nil {
		return
	}

	return
}
