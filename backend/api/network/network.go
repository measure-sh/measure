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
	"github.com/leporo/sqlf"
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

// trendsLimit is the default number of endpoints to return
// in each trends category.
const trendsLimit = 100

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
		From("url_patterns FINAL").
		Where("team_id = ?", teamId).
		Where("app_id = ?", appId).
		Where("domain = ?", domain)

	if search != "" {
		stmt.Where("positionCaseInsensitive(path, ?) > 0", search)
	}

	stmt.OrderBy("path").Limit(10)

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

	eventsStmt := sqlf.
		Select("path").
		From("http_events").
		Where("team_id = ?", teamId).
		Where("app_id = ?", appId).
		Where("domain = ?", domain)

	if search != "" {
		eventsStmt.Where("positionCaseInsensitive(path, ?) > 0", search)
	}

	eventsStmt.GroupBy("path").
		OrderBy("count() DESC").
		Limit(10)

	defer eventsStmt.Close()

	eventsRows, err := server.Server.ChPool.Query(ctx, eventsStmt.String(), eventsStmt.Args()...)
	if err != nil {
		return
	}

	for eventsRows.Next() {
		var path string
		if err = eventsRows.Scan(&path); err != nil {
			return
		}
		if err = eventsRows.Err(); err != nil {
			return
		}
		paths = append(paths, path)
	}

	err = eventsRows.Err()
	return
}

// fetchTrendsCategory queries a single trends category
// (latency, error_rate, or frequency) from http_metrics.
func fetchTrendsCategory(ctx context.Context, appId, teamId uuid.UUID, af *filter.AppFilter, orderBy string) ([]TrendsEndpoint, error) {
	stmt := sqlf.
		Select("domain").
		Select("path AS path_pattern").
		Select("quantilesMerge(0.5, 0.75, 0.90, 0.95, 0.99, 1.0)(latency_percentiles)[4] AS p95_latency").
		Select("if(sum(request_count) > 0, (sum(count_4xx) + sum(count_5xx)) * 100.0 / sum(request_count), 0) AS error_rate").
		Select("sum(request_count) AS frequency").
		From("http_metrics").
		Where("team_id = ?", teamId).
		Where("app_id = ?", appId).
		Where("timestamp >= ?", af.From).
		Where("timestamp <= ?", af.To)

	applyAggregatedFilters(stmt, af)

	stmt.GroupBy("domain, path").
		OrderBy(orderBy).
		Limit(trendsLimit)

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}

	var endpoints []TrendsEndpoint
	for rows.Next() {
		var ep TrendsEndpoint
		var p95Latency, errorRate float64
		if err := rows.Scan(&ep.Domain, &ep.PathPattern, &p95Latency, &errorRate, &ep.Frequency); err != nil {
			return nil, err
		}
		if err := rows.Err(); err != nil {
			return nil, err
		}
		ep.P95Latency = roundPtr(p95Latency)
		ep.ErrorRate = roundPtr(errorRate)
		endpoints = append(endpoints, ep)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if endpoints == nil {
		endpoints = []TrendsEndpoint{}
	}
	return endpoints, nil
}

// FetchTrends returns a high-level summary of
// network performance for a given app.
func FetchTrends(ctx context.Context, appId, teamId uuid.UUID, af *filter.AppFilter) (*TrendsResponse, error) {
	trendsLatency, err := fetchTrendsCategory(ctx, appId, teamId, af, "p95_latency DESC")
	if err != nil {
		return nil, err
	}

	trendsErrorRate, err := fetchTrendsCategory(ctx, appId, teamId, af, "error_rate DESC")
	if err != nil {
		return nil, err
	}

	trendsFrequency, err := fetchTrendsCategory(ctx, appId, teamId, af, "frequency DESC")
	if err != nil {
		return nil, err
	}

	return &TrendsResponse{
		TrendsLatency:   trendsLatency,
		TrendsErrorRate: trendsErrorRate,
		TrendsFrequency: trendsFrequency,
	}, nil
}

// FetchMetrics returns latency percentiles and status
// code distribution for the given domain and path pattern.
// It reads historical data from pre-aggregated http_metrics
// and only queries raw http_events for the current day,
// falling back to http_events entirely when the pattern
// is not in url_patterns.
func FetchMetrics(ctx context.Context, appId, teamId uuid.UUID, domain, pathPattern string, af *filter.AppFilter) (*MetricsResponse, error) {
	// Check if pattern exists in url_patterns
	exists, err := patternExists(ctx, appId, teamId, domain, pathPattern)
	if err != nil || !exists {
		return fetchMetricsFromEvents(ctx, appId, teamId, domain, pathPattern, af, af.From, af.To)
	}

	// Compute day-aligned cutoff
	cutoff := metricsCutoff(af.Timezone)

	// If entire range is within current day, just use events
	if !af.From.Before(cutoff) {
		return fetchMetricsFromEvents(ctx, appId, teamId, domain, pathPattern, af, af.From, af.To)
	}

	// If entire range is historical, just use metrics
	if !af.To.After(cutoff) {
		return fetchMetricsFromAggregated(ctx, appId, teamId, domain, pathPattern, af, af.From, af.To)
	}

	// Split: metrics for historical days, events for current day
	aggregated, err := fetchMetricsFromAggregated(ctx, appId, teamId, domain, pathPattern, af, af.From, cutoff)
	if err != nil {
		return nil, err
	}

	events, err := fetchMetricsFromEvents(ctx, appId, teamId, domain, pathPattern, af, cutoff, af.To)
	if err != nil {
		return nil, err
	}

	return &MetricsResponse{
		Latency:     append(aggregated.Latency, events.Latency...),
		StatusCodes: append(aggregated.StatusCodes, events.StatusCodes...),
	}, nil
}

func GetRequestStatusOverview(ctx context.Context, appId, teamId uuid.UUID, af *filter.AppFilter) (result []MetricsDataPoint, err error) {
	format := datetimeFormat(af.From, af.To)
	stmt := sqlf.From("http_events").
		Select(fmt.Sprintf("formatDateTime(timestamp, '%s', ?) as datetime", format), af.Timezone).
		Select("countIf(status_code_bucket in ('2xx','3xx','4xx','5xx')) as total_count").
		Select("countIf(status_code_bucket = '2xx') as count_2xx").
		Select("countIf(status_code_bucket = '3xx') as count_3xx").
		Select("countIf(status_code_bucket = '4xx') as count_4xx").
		Select("countIf(status_code_bucket = '5xx') as count_5xx").
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
		stmt.Where("app_version.1 in ?", af.Versions)
		stmt.Where("app_version.2 in ?", af.VersionCodes)
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

// applyAggregatedFilters applies filters to http_metrics
// queries. Scalar columns use WHERE clauses; array columns
// use HAVING with hasAll(groupUniqArrayMerge(...), ?).
func applyAggregatedFilters(stmt *sqlf.Stmt, af *filter.AppFilter) {
	if af.HasVersions() {
		selectedVersions, err := af.VersionPairs()
		if err == nil {
			stmt.Where("app_version in (?)", selectedVersions.Parameterize())
		}
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

	if af.HasNetworkProviders() {
		stmt.Having("hasAll(groupUniqArrayArray(network_providers), ?)", af.NetworkProviders)
	}
	if af.HasNetworkTypes() {
		stmt.Having("hasAll(groupUniqArrayArray(network_types), ?)", af.NetworkTypes)
	}
	if af.HasNetworkGenerations() {
		stmt.Having("hasAll(groupUniqArrayArray(network_generations), ?)", af.NetworkGenerations)
	}
	if af.HasDeviceLocales() {
		stmt.Having("hasAll(groupUniqArrayArray(device_locales), ?)", af.Locales)
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

// patternExists checks if a path pattern exists in
// the url_patterns table for the given app and domain.
func patternExists(ctx context.Context, appId, teamId uuid.UUID, domain, pathPattern string) (bool, error) {
	stmt := sqlf.
		Select("1").
		From("url_patterns FINAL").
		Where("team_id = ?", teamId).
		Where("app_id = ?", appId).
		Where("domain = ?", domain).
		Where("path = ?", pathPattern).
		Limit(1)

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return false, err
	}

	return rows.Next(), rows.Err()
}

// metricsCutoff returns the start of today in the given
// timezone, converted to UTC. This provides a day-aligned
// boundary for splitting queries between http_metrics and
// http_events.
func metricsCutoff(timezone string) time.Time {
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		return time.Now().UTC().Add(-24 * time.Hour)
	}
	now := time.Now().In(loc)
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	return startOfDay.UTC()
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
		Where("team_id = ? and app_id = ? and domain = ? and timestamp >= ? and timestamp <= ?", teamId, appId, domain, from, to).
		Where("latency_ms <= 60000")

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
		Select("countIf(status_code_bucket in ('2xx','3xx','4xx','5xx')) as total_count").
		Select("countIf(status_code_bucket = '2xx') as count_2xx").
		Select("countIf(status_code_bucket = '3xx') as count_3xx").
		Select("countIf(status_code_bucket = '4xx') as count_4xx").
		Select("countIf(status_code_bucket = '5xx') as count_5xx").
		Where("team_id = ? and app_id = ? and domain = ? and timestamp >= ? and timestamp <= ?", teamId, appId, domain, from, to).
		Where("latency_ms <= 60000")

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

// fetchMetricsFromAggregated queries pre-aggregated
// http_metrics for latency percentiles and status code
// distribution. Uses quantilesMerge to combine the
// pre-computed percentile states.
func fetchMetricsFromAggregated(ctx context.Context, appId, teamId uuid.UUID, domain, pathPattern string, af *filter.AppFilter, from, to time.Time) (result *MetricsResponse, err error) {
	result = &MetricsResponse{}

	// Fetch latency metrics
	format := datetimeFormat(af.From, af.To)
	latencyStmt := sqlf.From("http_metrics").
		Select(fmt.Sprintf("formatDateTime(timestamp, '%s', ?) as datetime", format), af.Timezone).
		Select("quantilesMerge(0.5, 0.75, 0.90, 0.95, 0.99, 1.0)(latency_percentiles) as latencies").
		Select("sum(request_count) as count").
		Where("team_id = ? and app_id = ? and domain = ? and timestamp >= ? and timestamp < ?", teamId, appId, domain, from, to).
		Where("path = ?", pathPattern)

	applyAggregatedFilters(latencyStmt, af)

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
		if len(latencies) >= 6 {
			data["p50"] = roundPtr(latencies[0])
			data["p90"] = roundPtr(latencies[2])
			data["p95"] = roundPtr(latencies[3])
			data["p99"] = roundPtr(latencies[4])
		}
		result.Latency = append(result.Latency, data)
	}
	if err = latencyRows.Err(); err != nil {
		return
	}

	// Fetch status code metrics
	statusStmt := sqlf.From("http_metrics").
		Select(fmt.Sprintf("formatDateTime(timestamp, '%s', ?) as datetime", format), af.Timezone).
		Select("sum(request_count) as total_count").
		Select("sum(count_2xx) as count_2xx").
		Select("sum(count_3xx) as count_3xx").
		Select("sum(count_4xx) as count_4xx").
		Select("sum(count_5xx) as count_5xx").
		Where("team_id = ? and app_id = ? and domain = ? and timestamp >= ? and timestamp < ?", teamId, appId, domain, from, to).
		Where("path = ?", pathPattern)

	applyAggregatedFilters(statusStmt, af)

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
