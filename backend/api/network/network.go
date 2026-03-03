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

// TrendMetric represents metrics for
// a single endpoint.
type TrendMetric struct {
	Domain      string   `json:"domain"`
	PathPattern string   `json:"path_pattern"`
	P95Latency  *float64 `json:"p95_latency"`
	ErrorRate   *float64 `json:"error_rate"`
	Frequency   uint64   `json:"frequency"`
}

// TrendsResponse contains high-level network
// performance summary metrics.
type TrendsResponse struct {
	TrendsLatency   []TrendMetric `json:"trends_latency"`
	TrendsErrorRate []TrendMetric `json:"trends_error_rate"`
	TrendsFrequency []TrendMetric `json:"trends_frequency"`
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

// splitAtMidnight splits a range into
// pre-midnight and post-midnight.
func splitAtMidnight(from, to time.Time, now time.Time) (metrics, events TimeRange) {
	boundary := now.Add(-24 * time.Hour)

	// metrics range
	if from.Before(boundary) {
		metrics = TimeRange{
			From: from,
			To:   minTime(to, boundary),
		}
	}

	// events range
	if to.After(boundary) {
		events = TimeRange{
			From: maxTime(from, boundary),
			To:   to,
		}
	}

	return
}

func minTime(a, b time.Time) time.Time {
	if a.Before(b) {
		return a
	}
	return b
}

func maxTime(a, b time.Time) time.Time {
	if a.After(b) {
		return a
	}
	return b
}

// applyMetricsFilters applies filters to
// http_metrics queries. Scalar columns use WHERE;
// array columns use HAVING.
func applyMetricsFilters(stmt *sqlf.Stmt, af *filter.AppFilter) {
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

// applyEventsFilters applies common filters from
// AppFilter to the query statement.
func applyEventsFilters(stmt *sqlf.Stmt, af *filter.AppFilter) {
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
func fetchTrendsCategory(ctx context.Context, appId, teamId uuid.UUID, af *filter.AppFilter, orderBy string) ([]TrendMetric, error) {
	stmt := sqlf.
		Select("domain").
		Select("path").
		Select("quantilesMerge(0.95)(latency_percentiles)[1] AS p95_latency").
		Select("if(sum(request_count) > 0, (sum(count_4xx) + sum(count_5xx)) * 100.0 / sum(request_count), 0) AS error_rate").
		Select("sum(request_count) AS frequency").
		From("http_metrics").
		Where("team_id = ?", teamId).
		Where("app_id = ?", appId).
		Where("timestamp >= ?", af.From).
		Where("timestamp <= ?", af.To)

	applyMetricsFilters(stmt, af)

	stmt.GroupBy("domain, path").
		OrderBy(orderBy).
		Limit(trendsLimit)

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}

	var endpoints []TrendMetric
	for rows.Next() {
		var ep TrendMetric
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
		endpoints = []TrendMetric{}
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

// GetDetailLatencyPlot returns latency percentiles
// for a given domain and path.
func GetDetailLatencyPlot(
	ctx context.Context,
	appId, teamId uuid.UUID,
	domain, path string,
	af *filter.AppFilter,
	bucketExpr, datetimeFormat string,
) ([]MetricsDataPoint, error) {

	result := make([]MetricsDataPoint, 0)

	stmt := sqlf.From("http_events").
		Select(bucketExpr+" as datetime_bucket", af.Timezone).
		Select("formatDateTime(datetime_bucket, ?) as datetime", datetimeFormat).
		Select("quantiles(0.50, 0.90, 0.95, 0.99)(latency_ms) as latencies").
		Select("countIf(status_code >= 200 and status_code < 600) as count").
		Where("team_id = ? and app_id = ? and domain = ? and timestamp >= ? and timestamp < ?", teamId, appId, domain, af.From, af.To)

	applyPathFilter(stmt, path)
	applyEventsFilters(stmt, af)

	stmt.GroupBy("datetime_bucket").OrderBy("datetime_bucket")
	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}

	for rows.Next() {
		var db time.Time
		var dt string
		var lats []float64
		var count uint64
		if err = rows.Scan(&db, &dt, &lats, &count); err != nil {
			return nil, err
		}
		data := MetricsDataPoint{"datetime": dt, "count": count}
		if len(lats) >= 4 {
			data["p50"] = roundPtr(lats[0])
			data["p90"] = roundPtr(lats[1])
			data["p95"] = roundPtr(lats[2])
			data["p99"] = roundPtr(lats[3])
		}
		result = append(result, data)
	}

	return result, nil
}

// GetDetailStatusDistributionPlot returns status code
// distribution for a given domain and path.
func GetDetailStatusDistributionPlot(
	ctx context.Context,
	appId, teamId uuid.UUID,
	domain, path string,
	af *filter.AppFilter,
	bucketExpr, datetimeFormat string,
) ([]MetricsDataPoint, error) {

	result := make([]MetricsDataPoint, 0)

	stmt := sqlf.From("http_events").
		Select(bucketExpr+" as datetime_bucket", af.Timezone).
		Select("formatDateTime(datetime_bucket, ?) as datetime", datetimeFormat).
		Select("countIf(status_code_bucket in ('2xx','3xx','4xx','5xx')) as total_count").
		Select("countIf(status_code_bucket = '2xx') as count_2xx").
		Select("countIf(status_code_bucket = '3xx') as count_3xx").
		Select("countIf(status_code_bucket = '4xx') as count_4xx").
		Select("countIf(status_code_bucket = '5xx') as count_5xx").
		Where("team_id = ? and app_id = ? and domain = ? and timestamp >= ? and timestamp < ?", teamId, appId, domain, af.From, af.To)

	applyPathFilter(stmt, path)
	applyEventsFilters(stmt, af)

	stmt.GroupBy("datetime_bucket").OrderBy("datetime_bucket")
	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}

	for rows.Next() {
		var db time.Time
		var dt string
		var total, c2, c3, c4, c5 uint64
		if err = rows.Scan(&db, &dt, &total, &c2, &c3, &c4, &c5); err != nil {
			return nil, err
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

	return result, nil
}

// GetNetworkOverviewStatusDistributionPlot returns a distribution
// of status codes over time.
func GetNetworkOverviewStatusDistributionPlot(ctx context.Context, appId, teamId uuid.UUID, af *filter.AppFilter, bucketExpr, datetimeFormat string) (result []MetricsDataPoint, err error) {
	stmt := sqlf.From("http_events").
		Select(bucketExpr+" as datetime_bucket", af.Timezone).
		Select("formatDateTime(datetime_bucket, ?) as datetime", datetimeFormat).
		Select("countIf(status_code_bucket in ('2xx','3xx','4xx','5xx')) as total_count").
		Select("countIf(status_code_bucket = '2xx') as count_2xx").
		Select("countIf(status_code_bucket = '3xx') as count_3xx").
		Select("countIf(status_code_bucket = '4xx') as count_4xx").
		Select("countIf(status_code_bucket = '5xx') as count_5xx").
		Where("team_id = ? and app_id = ? and timestamp >= ? and timestamp <= ?", teamId, appId, af.From, af.To)

	applyEventsFilters(stmt, af)

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

// SessionTimelinePoint represents a single URL
// pattern's session timeline.
type SessionTimelinePoint struct {
	Domain             string  `json:"domain"`
	PathPattern        string  `json:"path_pattern"`
	AvgElapsedMs       float64 `json:"avg_elapsed_ms"`
	AvgCallsPerSession float64 `json:"avg_calls_per_session"`
}

// FetchRequestTimeline returns session timeline data
// for all URL patterns of a given app.
func FetchRequestTimeline(ctx context.Context, appId, teamId uuid.UUID, af *filter.AppFilter) ([]SessionTimelinePoint, error) {
	stmt := sqlf.
		Select("domain").
		Select("path").
		Select("sum(session_elapsed_sum) / sum(request_count) AS avg_elapsed_ms").
		Select("sum(request_count) / uniqMerge(session_count) AS avg_calls_per_session").
		From("http_metrics").
		Where("team_id = ?", teamId).
		Where("app_id = ?", appId).
		Where("timestamp >= ?", af.From).
		Where("timestamp <= ?", af.To)

	applyMetricsFilters(stmt, af)

	stmt.GroupBy("domain, path").
		Having("sum(session_elapsed_sum) > 0")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}

	var points []SessionTimelinePoint
	for rows.Next() {
		var p SessionTimelinePoint
		if err := rows.Scan(&p.Domain, &p.PathPattern, &p.AvgElapsedMs, &p.AvgCallsPerSession); err != nil {
			return nil, err
		}
		p.AvgElapsedMs = math.Round(p.AvgElapsedMs*10) / 10
		p.AvgCallsPerSession = math.Round(p.AvgCallsPerSession*10) / 10
		points = append(points, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if points == nil {
		points = []SessionTimelinePoint{}
	}
	return points, nil
}
