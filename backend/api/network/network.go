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

const trendsLimit = 10

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

// SessionTimelinePoint represents a single URL
// pattern's average timing within sessions.
type SessionTimelinePoint struct {
	Domain      string  `json:"domain"`
	Pattern     string  `json:"pattern"`
	AvgOffsetMs float64 `json:"avg_offset_ms"`
	CallCount   uint64  `json:"call_count"`
}

// TimeRange is a period between
// two points in time.
type TimeRange struct {
	From time.Time
	To   time.Time
}

// IsValid returns true if the range has a
// positive duration and non-zero times.
func (r TimeRange) isValid() bool {
	return !r.From.IsZero() && !r.To.IsZero() && r.To.After(r.From)
}

// partitionHistoricalAndToday splits a range into
// archive (pre-midnight) and recent (post-midnight).
func partitionHistoricalAndToday(from, to time.Time) (history, today TimeRange) {
	y, m, d := to.Date()
	midnight := time.Date(y, m, d, 0, 0, 0, 0, to.Location())

	// If 'from' starts on or after midnight
	// the whole range is 'today'
	if !from.Before(midnight) {
		return TimeRange{}, TimeRange{From: from, To: to}
	}

	history = TimeRange{From: from, To: midnight}
	today = TimeRange{From: midnight, To: to}

	return history, today
}

func (m *MetricsResponse) merge(other *MetricsResponse) {
	if other == nil {
		return
	}
	m.Latency = append(m.Latency, other.Latency...)
	m.StatusCodes = append(m.StatusCodes, other.StatusCodes...)
}

// applyFiltersToHttpMetrics applies filters to
// http_metrics queries. Scalar columns use WHERE;
// array columns use HAVING.
func applyFiltersToHttpMetrics(stmt *sqlf.Stmt, af *filter.AppFilter) {
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
	if af.HasHttpMethods() {
		stmt.Where("method").In(af.HttpMethods)
	}
}

// roundPtr rounds a float64 to 1 decimal place
// and returns a pointer.
func roundPtr(v float64) *float64 {
	rounded := math.Round(v*10) / 10
	return &rounded
}

// fetchTrendsCategory queries a single trends
// category from http_metrics.
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

	applyFiltersToHttpMetrics(stmt, af)

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

// patternExists checks if a path pattern exists in
// the url_patterns table for the given app.
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

// applyPathFilter adds path matching to the query.
// Optimizes to use startsWith when possible.
func applyPathFilter(stmt *sqlf.Stmt, pathPattern string) {
	if prefix, ok := strings.CutSuffix(pathPattern, "**"); ok {
		if !strings.Contains(prefix, "*") {
			stmt.Where("startsWith(path, ?)", prefix)
		} else {
			likePattern := strings.ReplaceAll(prefix, "*", "%") + "%"
			stmt.Where("path LIKE ?", likePattern)
		}
		return
	}

	if strings.Contains(pathPattern, "*") {
		likePattern := strings.ReplaceAll(pathPattern, "*", "%")
		stmt.Where("path LIKE ?", likePattern)
		return
	}

	stmt.Where("path = ?", pathPattern)
}

// applyFiltersToHttpEvents applies common filters from
// AppFilter to the query statement.
func applyFiltersToHttpEvents(stmt *sqlf.Stmt, af *filter.AppFilter) {
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

	if af.HasHttpMethods() {
		stmt.Where("method").In(af.HttpMethods)
	}
}

// fetchMetricsFromEvents queries raw http_events
// for endpoints that don't have pre-aggregated data.
func fetchMetricsFromEvents(ctx context.Context, appId, teamId uuid.UUID, domain, pathPattern string, af *filter.AppFilter, from, to time.Time, bucketExpr, datetimeFormat string) (result *MetricsResponse, err error) {
	result = &MetricsResponse{}

	latencyStmt := sqlf.From("http_events").
		Select(bucketExpr+" as datetime_bucket", af.Timezone).
		Select("formatDateTime(datetime_bucket, ?) as datetime", datetimeFormat).
		Select("quantiles(0.50, 0.90, 0.95, 0.99)(latency_ms) as latencies").
		Select("countIf(status_code >= 200 and status_code < 600) as count").
		Where("team_id = ? and app_id = ? and domain = ? and timestamp >= ? and timestamp < ?", teamId, appId, domain, from, to).
		Where("latency_ms <= 60000")

	applyPathFilter(latencyStmt, pathPattern)
	applyFiltersToHttpEvents(latencyStmt, af)

	latencyStmt.GroupBy("datetime_bucket").OrderBy("datetime_bucket")
	defer latencyStmt.Close()

	latencyRows, err := server.Server.ChPool.Query(ctx, latencyStmt.String(), latencyStmt.Args()...)
	if err != nil {
		return
	}

	for latencyRows.Next() {
		var db time.Time
		var dt string
		var lats []float64
		var count uint64
		if err = latencyRows.Scan(&db, &dt, &lats, &count); err != nil {
			return
		}
		data := MetricsDataPoint{"datetime": dt, "count": count}
		if len(lats) >= 4 {
			data["p50"] = roundPtr(lats[0])
			data["p90"] = roundPtr(lats[1])
			data["p95"] = roundPtr(lats[2])
			data["p99"] = roundPtr(lats[3])
		}
		result.Latency = append(result.Latency, data)
	}

	statusStmt := sqlf.From("http_events").
		Select(bucketExpr+" as datetime_bucket", af.Timezone).
		Select("formatDateTime(datetime_bucket, ?) as datetime", datetimeFormat).
		Select("countIf(status_code_bucket in ('2xx','3xx','4xx','5xx')) as total_count").
		Select("countIf(status_code_bucket = '2xx') as count_2xx").
		Select("countIf(status_code_bucket = '3xx') as count_3xx").
		Select("countIf(status_code_bucket = '4xx') as count_4xx").
		Select("countIf(status_code_bucket = '5xx') as count_5xx").
		Where("team_id = ? and app_id = ? and domain = ? and timestamp >= ? and timestamp < ?", teamId, appId, domain, from, to).
		Where("latency_ms <= 60000")

	applyPathFilter(statusStmt, pathPattern)
	applyFiltersToHttpEvents(statusStmt, af)

	statusStmt.GroupBy("datetime_bucket").OrderBy("datetime_bucket")
	defer statusStmt.Close()

	statusRows, err := server.Server.ChPool.Query(ctx, statusStmt.String(), statusStmt.Args()...)
	if err != nil {
		return
	}

	for statusRows.Next() {
		var db time.Time
		var dt string
		var total, c2, c3, c4, c5 uint64
		if err = statusRows.Scan(&db, &dt, &total, &c2, &c3, &c4, &c5); err != nil {
			return
		}
		result.StatusCodes = append(result.StatusCodes, MetricsDataPoint{
			"datetime":    dt,
			"total_count": total,
			"count_2xx":   c2,
			"count_3xx":   c3,
			"count_4xx":   c4,
			"count_5xx":   c5,
		})
	}

	return
}

// fetchMetricsFromAggregated queries pre-aggregated
// http_metrics for performance data.
func fetchMetricsFromAggregated(ctx context.Context, appId, teamId uuid.UUID, domain, pathPattern string, af *filter.AppFilter, from, to time.Time, bucketExpr, datetimeFormat string) (result *MetricsResponse, err error) {
	result = &MetricsResponse{}

	latencyStmt := sqlf.From("http_metrics").
		Select(bucketExpr+" as datetime_bucket", af.Timezone).
		Select("formatDateTime(datetime_bucket, ?) as datetime", datetimeFormat).
		Select("quantilesMerge(0.5, 0.75, 0.90, 0.95, 0.99, 1.0)(latency_percentiles) as latencies").
		Select("sum(request_count) as count").
		Where("team_id = ? and app_id = ? and domain = ? and timestamp >= ? and timestamp < ?", teamId, appId, domain, from, to).
		Where("path = ?", pathPattern)

	applyFiltersToHttpMetrics(latencyStmt, af)

	latencyStmt.GroupBy("datetime_bucket").OrderBy("datetime_bucket")
	defer latencyStmt.Close()

	latencyRows, err := server.Server.ChPool.Query(ctx, latencyStmt.String(), latencyStmt.Args()...)
	if err != nil {
		return
	}

	for latencyRows.Next() {
		var db time.Time
		var dt string
		var lats []float64
		var count uint64
		if err = latencyRows.Scan(&db, &dt, &lats, &count); err != nil {
			return
		}
		data := MetricsDataPoint{"datetime": dt, "count": count}
		if len(lats) >= 6 {
			data["p50"] = roundPtr(lats[0])
			data["p90"] = roundPtr(lats[2])
			data["p95"] = roundPtr(lats[3])
			data["p99"] = roundPtr(lats[4])
		}
		result.Latency = append(result.Latency, data)
	}

	statusStmt := sqlf.From("http_metrics").
		Select(bucketExpr+" as datetime_bucket", af.Timezone).
		Select("formatDateTime(datetime_bucket, ?) as datetime", datetimeFormat).
		Select("sum(request_count) as total_count").
		Select("sum(count_2xx) as count_2xx").
		Select("sum(count_3xx) as count_3xx").
		Select("sum(count_4xx) as count_4xx").
		Select("sum(count_5xx) as count_5xx").
		Where("team_id = ? and app_id = ? and domain = ? and timestamp >= ? and timestamp < ?", teamId, appId, domain, from, to).
		Where("path = ?", pathPattern)

	applyFiltersToHttpMetrics(statusStmt, af)

	statusStmt.GroupBy("datetime_bucket").OrderBy("datetime_bucket")
	defer statusStmt.Close()

	statusRows, err := server.Server.ChPool.Query(ctx, statusStmt.String(), statusStmt.Args()...)
	if err != nil {
		return
	}

	for statusRows.Next() {
		var db time.Time
		var dt string
		var total, c2, c3, c4, c5 uint64
		if err = statusRows.Scan(&db, &dt, &total, &c2, &c3, &c4, &c5); err != nil {
			return
		}
		result.StatusCodes = append(result.StatusCodes, MetricsDataPoint{
			"datetime":    dt,
			"total_count": total,
			"count_2xx":   c2,
			"count_3xx":   c3,
			"count_4xx":   c4,
			"count_5xx":   c5,
		})
	}

	return
}

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

// FetchDomains returns list of unique domains for a
// given app and team.
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
		domains = append(domains, domain)
	}
	err = rows.Err()
	return
}

// FetchPaths returns list of unique paths for a
// given app, team and domain.
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
		paths = append(paths, path)
	}
	err = rows.Err()
	return
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

// FetchMetrics returns latency percentiles and
// status code distribution for a given domain
// and path.
func FetchMetrics(ctx context.Context, appId, teamId uuid.UUID, domain, path string, af *filter.AppFilter, bucketExpr, datetimeFormat string) (*MetricsResponse, error) {
	exists, err := patternExists(ctx, appId, teamId, domain, path)

	// Fallback, compute metrics from http_events
	if !exists || err != nil {
		return fetchMetricsFromEvents(ctx, appId, teamId, domain, path, af, af.From, af.To, bucketExpr, datetimeFormat)
	}

	// Initialize the res
	res := &MetricsResponse{
		Latency:     []MetricsDataPoint{},
		StatusCodes: []MetricsDataPoint{},
	}

	// Split range into historical and today
	historicalRange, todayRange := partitionHistoricalAndToday(af.From, af.To)

	// Query older data from aggregated http_metrics
	if historicalRange.isValid() {
		r, err := fetchMetricsFromAggregated(ctx, appId, teamId, domain, path, af, historicalRange.From, historicalRange.To, bucketExpr, datetimeFormat)
		if err != nil {
			return nil, err
		}
		res.merge(r)
	}

	// Query latest data from raw http_events
	if todayRange.isValid() {
		r, err := fetchMetricsFromEvents(ctx, appId, teamId, domain, path, af, todayRange.From, todayRange.To, bucketExpr, datetimeFormat)
		if err != nil {
			return nil, err
		}
		res.merge(r)
	}

	return res, nil
}

// GetRequestStatusOverview returns a distribution
// of status codes over time.
func GetRequestStatusOverview(ctx context.Context, appId, teamId uuid.UUID, af *filter.AppFilter, bucketExpr, datetimeFormat string) (result []MetricsDataPoint, err error) {
	stmt := sqlf.From("http_events").
		Select(bucketExpr+" as datetime_bucket", af.Timezone).
		Select("formatDateTime(datetime_bucket, ?) as datetime", datetimeFormat).
		Select("countIf(status_code_bucket in ('2xx','3xx','4xx','5xx')) as total_count").
		Select("countIf(status_code_bucket = '2xx') as count_2xx").
		Select("countIf(status_code_bucket = '3xx') as count_3xx").
		Select("countIf(status_code_bucket = '4xx') as count_4xx").
		Select("countIf(status_code_bucket = '5xx') as count_5xx").
		Where("team_id = ? and app_id = ? and timestamp >= ? and timestamp <= ?", teamId, appId, af.From, af.To)

	applyFiltersToHttpEvents(stmt, af)

	stmt.GroupBy("datetime_bucket").OrderBy("datetime_bucket")
	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	result = []MetricsDataPoint{}
	for rows.Next() {
		var db time.Time
		var dt string
		var total, c2, c3, c4, c5 uint64
		if err = rows.Scan(&db, &dt, &total, &c2, &c3, &c4, &c5); err != nil {
			return
		}
		result = append(result, MetricsDataPoint{
			"datetime":    dt,
			"total_count": total,
			"count_2xx":   c2,
			"count_3xx":   c3,
			"count_4xx":   c4,
			"count_5xx":   c5,
		})
	}
	err = rows.Err()
	return
}
