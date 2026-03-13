package network

import (
	"backend/api/filter"
	"backend/api/server"
	"context"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

const (
	maxPathSuggestions         = 10
	defaultOverviewTimelineMax = 10
)

// MetricsDataPoint represents a single data point
// in a time series.
type MetricsDataPoint map[string]any

// TrendMetric represents metrics for
// a single endpoint.
type TrendMetric struct {
	Domain      string  `json:"domain"`
	PathPattern string  `json:"path_pattern"`
	P95Latency  float64 `json:"p95_latency"`
	ErrorRate   float64 `json:"error_rate"`
	Frequency   uint64  `json:"frequency"`
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

// TimelinePoint represents a single URL
// pattern's per-session average request count bucket.
type TimelinePoint struct {
	Elapsed     uint32  `json:"elapsed"`
	Domain      string  `json:"domain"`
	PathPattern string  `json:"path_pattern"`
	Count       float64 `json:"count"`
}

// TimelineResponse wraps timeline points with
// the bucket interval size in seconds.
type TimelineResponse struct {
	Interval uint32          `json:"interval"`
	Points   []TimelinePoint `json:"points"`
}

// EndpointStatusCodesPlotResponse wraps
// per-status-code time series data.
type EndpointStatusCodesPlotResponse struct {
	StatusCodes []int              `json:"status_codes"`
	DataPoints  []MetricsDataPoint `json:"data_points"`
}

// perSessionAvg computes the average count per
// session, rounded to 2 decimal places.
func perSessionAvg(count, sessions uint64) float64 {
	return math.Round(float64(count)/float64(sessions)*100) / 100
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

// fetchTrendsCategory queries a single trends
// category from http_metrics.
func fetchTrendsCategory(ctx context.Context, appId, teamId uuid.UUID, af *filter.AppFilter, orderBy string, limit int) ([]TrendMetric, error) {
	stmt := sqlf.
		Select("domain").
		Select("path").
		Select("quantilesMerge(0.95)(latency_percentiles)[1] AS p95_latency").
		Select("(sum(count_4xx) + sum(count_5xx)) * 100.0 / sum(request_count) AS error_rate").
		Select("sum(request_count) AS frequency").
		From("http_metrics").
		Where("team_id = ?", teamId).
		Where("app_id = ?", appId).
		Where("timestamp >= ?", af.From).
		Where("timestamp <= ?", af.To)

	applyMetricsFilters(stmt, af)

	stmt.GroupBy("domain, path").
		OrderBy(orderBy).
		Limit(limit)

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}

	var tm []TrendMetric
	for rows.Next() {
		var ep TrendMetric
		var p95Latency, errorRate float64
		if err := rows.Scan(&ep.Domain, &ep.PathPattern, &p95Latency, &errorRate, &ep.Frequency); err != nil {
			return nil, err
		}
		ep.P95Latency = math.Round(p95Latency*10) / 10
		ep.ErrorRate = math.Round(errorRate*10) / 10
		tm = append(tm, ep)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if tm == nil {
		tm = []TrendMetric{}
	}
	return tm, nil
}

// FetchDomains returns list of unique domains for a
// given app and team within the given time range.
func FetchDomains(ctx context.Context, appId, teamId uuid.UUID, from, to time.Time) (domains []string, err error) {
	// clamp to a minimum of 1 week
	// as smaller time ranges may not
	// have enough data available
	minDuration := 7 * 24 * time.Hour
	if to.Sub(from) < minDuration {
		from = to.Add(-minDuration)
	}

	stmt := sqlf.
		Select("domain").
		From("http_events").
		Where("team_id = ?", teamId).
		Where("app_id = ?", appId).
		Where("timestamp >= ?", from).
		Where("timestamp <= ?", to).
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
// given app, team and domain. The from/to time range
// is used only for the fallback http_events search,
// clamped to a minimum of 1 week.
func FetchPaths(ctx context.Context, appId, teamId uuid.UUID, domain, search string, from, to time.Time) (paths []string, err error) {
	stmt := sqlf.
		Select("path").
		From("url_patterns FINAL").
		Where("team_id = ?", teamId).
		Where("app_id = ?", appId).
		Where("domain = ?", domain)

	if search != "" {
		stmt.Where("positionCaseInsensitive(path, ?) > 0", search)
	}

	stmt.OrderBy("path").Limit(maxPathSuggestions)
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
	if err != nil {
		return
	}

	// Fallback to http_events if no patterns found
	if search != "" && len(paths) == 0 {
		// clamp to a minimum of 1 week
		// as smaller time ranges may not
		// have enough data available
		minDuration := 7 * 24 * time.Hour
		if to.Sub(from) < minDuration {
			from = to.Add(-minDuration)
		}

		eventsStmt := sqlf.
			Select("DISTINCT path").
			From("http_events").
			Where("team_id = ?", teamId).
			Where("app_id = ?", appId).
			Where("domain = ?", domain).
			Where("timestamp >= ?", from).
			Where("timestamp <= ?", to).
			Where("positionCaseInsensitive(path, ?) > 0", search).
			OrderBy("path").
			Limit(maxPathSuggestions)

		defer eventsStmt.Close()

		eventsRows, eventsErr := server.Server.ChPool.Query(ctx, eventsStmt.String(), eventsStmt.Args()...)
		if eventsErr != nil {
			err = eventsErr
			return
		}

		for eventsRows.Next() {
			var path string
			if err = eventsRows.Scan(&path); err != nil {
				return
			}
			paths = append(paths, path)
		}
		err = eventsRows.Err()
	}
	return
}

// FetchTrends returns top endpoint patterns by latency
// error rate and frequency.
func FetchTrends(ctx context.Context, appId, teamId uuid.UUID, af *filter.AppFilter, limit int) (*TrendsResponse, error) {
	trendsLatency, err := fetchTrendsCategory(ctx, appId, teamId, af, "p95_latency DESC", limit)
	if err != nil {
		return nil, err
	}

	trendsErrorRate, err := fetchTrendsCategory(ctx, appId, teamId, af, "error_rate DESC", limit)
	if err != nil {
		return nil, err
	}

	trendsFrequency, err := fetchTrendsCategory(ctx, appId, teamId, af, "frequency DESC", limit)
	if err != nil {
		return nil, err
	}

	return &TrendsResponse{
		TrendsLatency:   trendsLatency,
		TrendsErrorRate: trendsErrorRate,
		TrendsFrequency: trendsFrequency,
	}, nil
}

// GetNetworkOverviewStatusCodesPlot returns a distribution
// of status codes over time.
func GetNetworkOverviewStatusCodesPlot(ctx context.Context, appId, teamId uuid.UUID, af *filter.AppFilter, bucketExpr, datetimeFormat string) (result []MetricsDataPoint, err error) {
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

// FetchOverviewTimeline returns 5-second average request
// count buckets (per session) for URL patterns of a given app.
func FetchOverviewTimeline(ctx context.Context, appId, teamId uuid.UUID, af *filter.AppFilter, limit int) (*TimelineResponse, error) {
	if limit <= 0 {
		limit = defaultOverviewTimelineMax
	}

	stmt := sqlf.
		Select("domain").
		Select("path").
		// sumMap merges per-row {elapsed_sec: req_count} maps by
		// summing values for matching keys.
		// e.g. row1={0:3, 5:7} + row2={0:1, 5:4} => {0:4, 5:11}
		Select("(sumMap(session_elapsed_counts) AS elapsed_count_pairs).1 AS bucket_secs").
		Select("elapsed_count_pairs.2 AS bucket_counts").
		Select("uniqCombined64Merge(session_count) AS sessions").
		From("http_metrics").
		Where("team_id = ?", teamId).
		Where("app_id = ?", appId).
		Where("timestamp >= ?", af.From).
		Where("timestamp <= ?", af.To)

	applyMetricsFilters(stmt, af)

	stmt.GroupBy("domain, path").
		OrderBy("sum(request_count) DESC").
		Limit(limit)

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}

	var points []TimelinePoint
	for rows.Next() {
		var domain, path string
		var bucketSecs []uint32
		var bucketCounts []uint64
		var sessions uint64
		if err := rows.Scan(&domain, &path, &bucketSecs, &bucketCounts, &sessions); err != nil {
			return nil, err
		}
		if sessions == 0 || len(bucketSecs) == 0 {
			continue
		}
		var hasData bool
		for _, c := range bucketCounts {
			if c > 0 {
				hasData = true
				break
			}
		}
		if !hasData {
			continue
		}
		for i, sec := range bucketSecs {
			avg := perSessionAvg(bucketCounts[i], sessions)
			if avg > 0 {
				points = append(points, TimelinePoint{
					Elapsed:     sec,
					Domain:      domain,
					PathPattern: path,
					Count:       avg,
				})
			}
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	sort.Slice(points, func(i, j int) bool {
		return points[i].Elapsed < points[j].Elapsed
	})

	if points == nil {
		points = []TimelinePoint{}
	}
	return &TimelineResponse{Interval: 5, Points: points}, nil
}

// GetEndpointLatencyPlot returns latency percentiles
// for a given domain and path.
func GetEndpointLatencyPlot(
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
		Select("count() as count").
		Where("team_id = ? and app_id = ? and domain = ? and status_code >= 200 and status_code < 600 and timestamp >= ? and timestamp < ?", teamId, appId, domain, af.From, af.To)

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
			data["p50"] = math.Round(lats[0]*10) / 10
			data["p90"] = math.Round(lats[1]*10) / 10
			data["p95"] = math.Round(lats[2]*10) / 10
			data["p99"] = math.Round(lats[3]*10) / 10
		}
		result = append(result, data)
	}

	return result, nil
}

// GetEndpointStatusCodesPlot returns per-status-code
// distribution for a given domain and path.
func GetEndpointStatusCodesPlot(
	ctx context.Context,
	appId, teamId uuid.UUID,
	domain, path string,
	af *filter.AppFilter,
	bucketExpr, datetimeFormat string,
) (*EndpointStatusCodesPlotResponse, error) {

	stmt := sqlf.From("http_events").
		Select(bucketExpr+" as datetime_bucket", af.Timezone).
		Select("formatDateTime(datetime_bucket, ?) as datetime", datetimeFormat).
		Select("status_code").
		Select("count() as count").
		Where("team_id = ?", teamId).
		Where("app_id = ?", appId).
		Where("domain = ?", domain).
		Where("status_code >= ?", 200).
		Where("status_code < ?", 600).
		Where("timestamp >= ?", af.From).
		Where("timestamp < ?", af.To)

	applyPathFilter(stmt, path)
	applyEventsFilters(stmt, af)

	stmt.GroupBy("datetime_bucket, status_code").OrderBy("datetime_bucket, status_code")
	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}

	dpMap := make(map[string]MetricsDataPoint)
	dpOrder := make([]string, 0)
	codeSet := make(map[int]struct{})

	for rows.Next() {
		var db time.Time
		var dt string
		var statusCode uint16
		var count uint64
		if err = rows.Scan(&db, &dt, &statusCode, &count); err != nil {
			return nil, err
		}

		dp, ok := dpMap[dt]
		if !ok {
			dp = MetricsDataPoint{
				"datetime":    dt,
				"total_count": uint64(0),
			}
			dpMap[dt] = dp
			dpOrder = append(dpOrder, dt)
		}

		code := int(statusCode)
		dp[fmt.Sprintf("count_%d", code)] = count
		dp["total_count"] = dp["total_count"].(uint64) + count
		codeSet[code] = struct{}{}
	}

	statusCodes := make([]int, 0, len(codeSet))
	for code := range codeSet {
		statusCodes = append(statusCodes, code)
	}
	sort.Ints(statusCodes)

	dataPoints := make([]MetricsDataPoint, 0, len(dpOrder))
	for _, dt := range dpOrder {
		dataPoints = append(dataPoints, dpMap[dt])
	}

	return &EndpointStatusCodesPlotResponse{
		StatusCodes: statusCodes,
		DataPoints:  dataPoints,
	}, nil
}

// FetchEndpointTimeline returns 5-second average request
// count buckets (per session) for a single URL pattern.
// It first checks whether the given path is a known pattern
// in the url_patterns table; if not, it returns nil.
func FetchEndpointTimeline(ctx context.Context, appId, teamId uuid.UUID, domain, pathPattern string, af *filter.AppFilter) (*TimelineResponse, error) {
	exists, err := patternExists(ctx, appId, teamId, domain, pathPattern)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, nil
	}

	stmt := sqlf.
		Select("domain").
		Select("path").
		Select("(sumMap(session_elapsed_counts) AS elapsed_count_pairs).1 AS bucket_secs").
		Select("elapsed_count_pairs.2 AS bucket_counts").
		Select("uniqCombined64Merge(session_count) AS sessions").
		From("http_metrics").
		Where("team_id = ?", teamId).
		Where("app_id = ?", appId).
		Where("domain = ?", domain).
		Where("timestamp >= ?", af.From).
		Where("timestamp <= ?", af.To)

	stmt.Where("path = ?", pathPattern)
	applyMetricsFilters(stmt, af)

	stmt.GroupBy("domain, path")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}

	var points []TimelinePoint
	for rows.Next() {
		var d, p string
		var bucketSecs []uint32
		var bucketCounts []uint64
		var sessions uint64
		if err := rows.Scan(&d, &p, &bucketSecs, &bucketCounts, &sessions); err != nil {
			return nil, err
		}
		if sessions == 0 || len(bucketSecs) == 0 {
			continue
		}
		var hasData bool
		for _, c := range bucketCounts {
			if c > 0 {
				hasData = true
				break
			}
		}
		if !hasData {
			continue
		}
		for i, sec := range bucketSecs {
			avg := perSessionAvg(bucketCounts[i], sessions)
			if avg > 0 {
				points = append(points, TimelinePoint{
					Elapsed:     sec,
					Domain:      d,
					PathPattern: p,
					Count:       avg,
				})
			}
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	sort.Slice(points, func(i, j int) bool {
		return points[i].Elapsed < points[j].Elapsed
	})

	if points == nil {
		points = []TimelinePoint{}
	}
	return &TimelineResponse{Interval: 5, Points: points}, nil
}
