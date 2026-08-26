package network

import (
	"backend/libs/chquery"
	"backend/libs/filter"
	"backend/libs/logcomment"
	"context"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/google/uuid"
	"github.com/leporo/sqlf"
	"golang.org/x/sync/errgroup"
)

const (
	searchResultsLimit = 20

	maxTimelineEndpointPatterns = 10
)

// MetricsDataPoint is one time-series data point.
type MetricsDataPoint map[string]any

// EndpointStatusCodesPlotResponse contains a
// time series for each observed HTTP status
// code.
type EndpointStatusCodesPlotResponse struct {
	StatusCodes []int              `json:"status_codes"`
	DataPoints  []MetricsDataPoint `json:"data_points"`
}

// TrendMetric contains metrics for one
// endpoint pattern.
type TrendMetric struct {
	Domain      string  `json:"domain"`
	PathPattern string  `json:"path_pattern"`
	P95Latency  float64 `json:"p95_latency"`
	ErrorRate   float64 `json:"error_rate"`
	Frequency   uint64  `json:"frequency"`
}

// TrendsResponse groups endpoint rankings
// by latency, error rate, and frequency.
type TrendsResponse struct {
	TrendsLatency   []TrendMetric `json:"trends_latency"`
	TrendsErrorRate []TrendMetric `json:"trends_error_rate"`
	TrendsFrequency []TrendMetric `json:"trends_frequency"`
}

// Endpoint represents a domain and URL path pattern.
type Endpoint struct {
	Domain      string `json:"domain"`
	PathPattern string `json:"path_pattern"`
}

// TimelinePoint is the per-session average
// request count for one endpoint and time
// bucket.
type TimelinePoint struct {
	Elapsed     uint32  `json:"elapsed"`
	Domain      string  `json:"domain"`
	PathPattern string  `json:"path_pattern"`
	Count       float64 `json:"count"`
}

// TimelineResponse includes timeline points
// and their bucket interval in seconds.
type TimelineResponse struct {
	Interval uint32          `json:"interval"`
	Points   []TimelinePoint `json:"points"`
}

// searchInput represents a parsed picker search.
type searchInput struct {
	text     string
	domain   string
	path     string
	wildcard bool
}

// withQueryName tags a query with its name
// for the ClickHouse query log.
func withQueryName(ctx context.Context, name string) context.Context {
	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.MustPut(logcomment.Root, logcomment.Network).String(),
	}
	return chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, name))
}

// applyEventsFilters applies supported
// AppFilter criteria to http_events.
func applyEventsFilters(stmt *sqlf.Stmt, af *filter.AppFilter) {
	if af.HasVersions() {
		selectedVersions, err := af.VersionPairs()
		if err == nil {
			stmt.Where("`attribute.app_version` in (?)", selectedVersions.Parameterize())
		}
	}

	if af.HasNetworkTypes() {
		stmt.Where("`attribute.network_type`").In(af.NetworkTypes)
	}

	if af.HasNetworkGenerations() {
		stmt.Where("`attribute.network_generation`").In(af.NetworkGenerations)
	}

	if af.HasNetworkProviders() {
		stmt.Where("`attribute.network_provider`").In(af.NetworkProviders)
	}

	if af.HasOSVersions() {
		selectedOSVersions, err := af.OSVersionPairs()
		if err == nil {
			stmt.Where("`attribute.os_version` in (?)", selectedOSVersions.Parameterize())
		}
	}

	if af.HasDeviceManufacturers() {
		stmt.Where("`attribute.device_manufacturer`").In(af.DeviceManufacturers)
	}

	if af.HasDeviceNames() {
		stmt.Where("`attribute.device_name`").In(af.DeviceNames)
	}

	if af.HasDeviceLocales() {
		stmt.Where("`attribute.device_locale`").In(af.Locales)
	}

	if af.HasCountries() {
		stmt.Where("`inet.country_code`").In(af.Countries)
	}

	if af.HasHttpMethods() {
		stmt.Where("method").In(af.HttpMethods)
	}
}

// applyMetricsFilters applies supported
// AppFilter criteria to http_metrics.
func applyMetricsFilters(stmt *sqlf.Stmt, af *filter.AppFilter) {
	if af.HasVersions() {
		selectedVersions, err := af.VersionPairs()
		if err == nil {
			stmt.Having("hasAny(groupUniqArrayArray(`app_versions`), [?])", selectedVersions.Parameterize())
		}
	}
	if af.HasOSVersions() {
		selectedOSVersions, err := af.OSVersionPairs()
		if err == nil {
			stmt.Having("hasAny(groupUniqArrayArray(`os_versions`), [?])", selectedOSVersions.Parameterize())
		}
	}
	if af.HasDeviceManufacturers() {
		stmt.Having("hasAny(groupUniqArrayArray(`device_manufacturers`), ?)", af.DeviceManufacturers)
	}
	if af.HasDeviceNames() {
		stmt.Having("hasAny(groupUniqArrayArray(`device_names`), ?)", af.DeviceNames)
	}
	if af.HasNetworkProviders() {
		stmt.Having("hasAny(groupUniqArrayArray(`network_providers`), ?)", af.NetworkProviders)
	}
	if af.HasNetworkTypes() {
		stmt.Having("hasAny(groupUniqArrayArray(`network_types`), ?)", af.NetworkTypes)
	}
	if af.HasNetworkGenerations() {
		stmt.Having("hasAny(groupUniqArrayArray(`network_generations`), ?)", af.NetworkGenerations)
	}
	if af.HasDeviceLocales() {
		stmt.Having("hasAny(groupUniqArrayArray(`device_locales`), ?)", af.Locales)
	}
	if af.HasHttpMethods() {
		stmt.Having("hasAny(groupUniqArrayArray(`methods`), ?)", af.HttpMethods)
	}
	if af.HasCountries() {
		stmt.Having("hasAny(groupUniqArrayArray(`inet.country_code`), ?)", af.Countries)
	}
}

func applyDomainFilter(stmt *sqlf.Stmt, domain string) {
	if domain == "" {
		return
	}

	if strings.Contains(domain, "*") {
		stmt.Where("domain LIKE ?", searchWildcardsToLike(domain))
		return
	}

	stmt.Where("domain = ?", domain)
}

// searchWildcardsToLike translates * to SQL LIKE's %.
func searchWildcardsToLike(pattern string) string {
	return strings.ReplaceAll(pattern, "*", "%")
}

// endpointSearchCondition builds the SQL condition
// for search.
// - Plain text matches any part of a domain or path
// - Domain/path input matches a domain suffix and a path prefix
// - Asterisks use SQL LIKE semantics
func endpointSearchCondition(domainColumn, pathColumn string, search searchInput) (string, []any) {
	domain := fmt.Sprintf("lower(%s)", domainColumn)
	path := fmt.Sprintf("lower(%s)", pathColumn)

	switch {
	case !search.wildcard && search.path == "":
		// "users" matches either a domain or path containing "users".
		condition := fmt.Sprintf("(%s LIKE concat('%%', lower(?), '%%') OR %s LIKE concat('%%', lower(?), '%%'))", domain, path)
		return condition, []any{search.text, search.text}

	case !search.wildcard && search.domain == "":
		// "/v1/users" matches paths containing "/v1/users".
		return fmt.Sprintf("%s LIKE concat('%%', lower(?), '%%')", path), []any{search.path}

	case !search.wildcard:
		// "api.example.com/v1" matches a domain suffix and path prefix.
		condition := fmt.Sprintf("endsWith(%s, lower(?)) AND startsWith(%s, lower(?))", domain, path)
		return condition, []any{search.domain, search.path}

	case search.path == "":
		// "api*" wildcard-matches domains.
		return fmt.Sprintf("%s LIKE lower(?)", domain), []any{searchPatternToLikePrefix(search.text)}

	case search.domain == "":
		// "users/*" wildcard-matches paths.
		pathPattern := searchPatternToLikePrefix(search.path)
		return fmt.Sprintf("%s LIKE lower(?)", path), []any{"%" + pathPattern}

	default:
		// "api.example.com/v1/*" matches the domain and a wildcard path.
		condition := fmt.Sprintf("%s LIKE lower(?) AND %s LIKE lower(?)", domain, path)
		return condition, []any{searchWildcardsToLike(search.domain), searchPatternToLikePrefix(search.path)}
	}
}

func searchPatternToLikePrefix(pattern string) string {
	return strings.TrimRight(searchWildcardsToLike(pattern), "%") + "%"
}

// pathPatternMatchExpression returns a ClickHouse expression for paths where
// a complete "*" segment matches one non-empty segment and a final "**"
// matches one or more descendant segments.
func pathPatternMatchExpression(pathExpression, patternExpression string) string {
	pathParts := fmt.Sprintf("splitByChar('/', %s)", pathExpression)
	patternParts := fmt.Sprintf("splitByChar('/', %s)", patternExpression)
	prefixPatternParts := fmt.Sprintf(
		"arraySlice(%s, 1, length(%s) - 1)",
		patternParts,
		patternParts,
	)
	prefixPathParts := fmt.Sprintf(
		"arraySlice(%s, 1, length(%s) - 1)",
		pathParts,
		patternParts,
	)

	matchesExpression := func(paths, patterns string) string {
		return "arrayAll(index -> if(arrayElement(" + patterns + ", index) = '*', arrayElement(" + paths + ", index) != '', arrayElement(" + paths + ", index) = arrayElement(" + patterns + ", index)), range(1, length(" + patterns + ") + 1))"
	}

	descendantMatch := fmt.Sprintf(
		"length(%s) > length(%s) - 1 AND %s",
		pathParts,
		patternParts,
		matchesExpression(prefixPathParts, prefixPatternParts),
	)
	exactMatch := fmt.Sprintf(
		"length(%s) = length(%s) AND %s",
		pathParts,
		patternParts,
		matchesExpression(pathParts, patternParts),
	)

	return fmt.Sprintf(
		"multiIf((%[1]s = '**' OR endsWith(%[1]s, '/**')), %[2]s, %[3]s)",
		patternExpression,
		descendantMatch,
		exactMatch,
	)
}

// pathPatternMatchPredicate uses simple path predicates where they preserve
// the wildcard rules. Other wildcard patterns keep the full matcher behind a
// literal-prefix filter.
func pathPatternMatchPredicate(pathExpression, pattern string) (string, []any) {
	if !strings.Contains(pattern, "*") {
		return pathExpression + " = ?", []any{pattern}
	}

	if hasTrailingDescendantWildcard(pattern) {
		prefix := strings.TrimSuffix(pattern, "**")
		if !strings.Contains(prefix, "*") {
			if prefix == "" {
				return "1", nil
			}
			return "startsWith(" + pathExpression + ", ?)", []any{prefix}
		}
	}

	expression := pathPatternMatchExpression(pathExpression, "?")
	args := make([]any, strings.Count(expression, "?"))
	for i := range args {
		args[i] = pattern
	}

	literalPrefix := pattern[:strings.Index(pattern, "*")]
	if literalPrefix != "" {
		return "startsWith(" + pathExpression + ", ?) AND (" + expression + ")", append([]any{literalPrefix}, args...)
	}

	return expression, args
}

func hasTrailingDescendantWildcard(pattern string) bool {
	return pattern == "**" || strings.HasSuffix(pattern, "/**")
}

// applyPathFilter adds segment-aware endpoint-pattern matching.
func applyPathFilter(stmt *sqlf.Stmt, pathPattern string) {
	if pathPattern == "" {
		return
	}

	condition, args := pathPatternMatchPredicate("path", pathPattern)
	stmt.Where(condition, args...)
}

// fetchTrendsCategory returns one endpoint ranking from http_metrics.
func fetchTrendsCategory(ctx context.Context, ch driver.Conn, appId, teamId uuid.UUID, af *filter.AppFilter, orderBy string, limit int) ([]TrendMetric, error) {
	ctx = chquery.WithTeamScope(ctx, teamId)
	stmt := sqlf.
		Select("domain").
		Select("path").
		Select("quantilesMerge(0.5, 0.75, 0.90, 0.95, 0.99)(latency_percentiles)[4] AS p95_latency").
		Select("(sum(count_4xx) + sum(count_5xx)) * 100.0 / sum(request_count) AS error_rate").
		Select("sum(request_count) AS frequency").
		From("http_metrics").
		Where("team_id = toUUID(?)", teamId).
		Where("app_id = toUUID(?)", appId).
		Where("timestamp >= ?", af.From).
		Where("timestamp < ?", af.To)

	stmt.GroupBy("domain, path").
		OrderBy(orderBy).
		Limit(limit)

	defer stmt.Close()

	ctx = withQueryName(ctx, "fetch_trends_category")

	rows, err := ch.Query(ctx, stmt.String(), stmt.Args()...)
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

func scanEndpoints(rows driver.Rows) (endpoints []Endpoint, err error) {
	endpoints = []Endpoint{}
	for rows.Next() {
		var e Endpoint
		if err = rows.Scan(&e.Domain, &e.PathPattern); err != nil {
			return
		}
		endpoints = append(endpoints, e)
	}
	err = rows.Err()
	return
}

// FetchEndpoints returns matching generated patterns and raw request paths.
func FetchEndpoints(ctx context.Context, ch driver.Conn, appId, teamId uuid.UUID, search string, af *filter.AppFilter) (endpoints []Endpoint, err error) {
	ctx = chquery.WithTeamScope(ctx, teamId)

	// parse the search query
	search = strings.TrimSpace(search)
	input := searchInput{wildcard: strings.Contains(search, "*")}
	if strings.HasPrefix(search, "/") {
		input.path = search
	} else if prefix, suffix, hasPath := strings.Cut(search, "/"); !hasPath {
		input.text = search
	} else if strings.Contains(prefix, ".") || strings.Contains(prefix, ":") || prefix == "localhost" || prefix == "*" {
		input.domain = prefix
		input.path = "/" + suffix
	} else {
		input.path = "/" + search
	}

	// return initial suggestions from
	// url_patterns when input is just
	// plain text with no path or domain
	if input.text == "" && input.path == "" {
		stmt := sqlf.
			Select("domain").
			Select("path").
			From("url_patterns FINAL").
			Where("team_id = toUUID(?)", teamId).
			Where("app_id = toUUID(?)", appId).
			OrderBy("domain, path").
			Limit(searchResultsLimit)
		defer stmt.Close()

		rows, err := ch.Query(withQueryName(ctx, "fetch_endpoint_suggestions"), stmt.String(), stmt.Args()...)
		if err != nil {
			return nil, err
		}

		return scanEndpoints(rows)
	}

	var patterns, rawEndpoints []Endpoint
	var endpointsGroup errgroup.Group

	// Search url_patterns by ignoring filters
	endpointsGroup.Go(func() error {
		stmt := sqlf.
			Select("domain").
			Select("path").
			From("url_patterns FINAL").
			Where("team_id = toUUID(?)", teamId).
			Where("app_id = toUUID(?)", appId)
		defer stmt.Close()

		condition, args := endpointSearchCondition("domain", "path", input)
		stmt.Where(condition, args...)
		stmt.OrderBy("domain, path").
			Limit(searchResultsLimit)

		rows, err := ch.Query(withQueryName(ctx, "fetch_endpoints_patterns"), stmt.String(), stmt.Args()...)
		if err != nil {
			return err
		}
		patterns, err = scanEndpoints(rows)
		return err
	})

	// Search http_events with filters
	endpointsGroup.Go(func() error {
		stmt := sqlf.
			Select("domain").
			Select("path").
			From("http_events").
			Where("team_id = toUUID(?)", teamId).
			Where("app_id = toUUID(?)", appId).
			Where("timestamp >= ?", af.From).
			Where("timestamp < ?", af.To)
		defer stmt.Close()

		condition, args := endpointSearchCondition("domain", "path", input)
		stmt.Where(condition, args...)
		applyEventsFilters(stmt, af)
		stmt.GroupBy("domain, path").
			OrderBy("count() DESC, domain, path").
			Limit(searchResultsLimit)

		rows, err := ch.Query(withQueryName(ctx, "fetch_endpoints_events"), stmt.String(), stmt.Args()...)
		if err != nil {
			return err
		}
		rawEndpoints, err = scanEndpoints(rows)
		return err
	})

	if err = endpointsGroup.Wait(); err != nil {
		return nil, err
	}

	// remove duplicates from the two sources
	// while maintaining the order
	seen := make(map[Endpoint]struct{}, len(patterns))
	endpoints = make([]Endpoint, 0, len(patterns)+len(rawEndpoints))
	for _, endpoint := range patterns {
		seen[endpoint] = struct{}{}
		endpoints = append(endpoints, endpoint)
	}
	for _, endpoint := range rawEndpoints {
		if _, exists := seen[endpoint]; exists {
			continue
		}
		endpoints = append(endpoints, endpoint)
	}

	return endpoints, nil
}

// FetchTrends returns endpoint rankings by latency, error rate, and frequency.
func FetchTrends(ctx context.Context, ch driver.Conn, appId, teamId uuid.UUID, af *filter.AppFilter, limit int) (*TrendsResponse, error) {
	var result TrendsResponse
	var trendsGroup errgroup.Group

	trendsGroup.Go(func() (err error) {
		result.TrendsLatency, err = fetchTrendsCategory(ctx, ch, appId, teamId, af, "p95_latency DESC", limit)
		return
	})

	trendsGroup.Go(func() (err error) {
		result.TrendsErrorRate, err = fetchTrendsCategory(ctx, ch, appId, teamId, af, "error_rate DESC", limit)
		return
	})

	trendsGroup.Go(func() (err error) {
		result.TrendsFrequency, err = fetchTrendsCategory(ctx, ch, appId, teamId, af, "frequency DESC", limit)
		return
	})

	if err := trendsGroup.Wait(); err != nil {
		return nil, err
	}

	return &result, nil
}

// GetStatusCodesPlot returns HTTP status-class counts over time for an optional endpoint selection.
func GetStatusCodesPlot(ctx context.Context, ch driver.Conn, appId, teamId uuid.UUID, domain, path string, af *filter.AppFilter, bucketExpr, datetimeFormat string) (result []MetricsDataPoint, err error) {
	ctx = chquery.WithTeamScope(ctx, teamId)
	stmt := sqlf.From("http_events").
		Select(bucketExpr+" as datetime_bucket", af.Timezone).
		Select("formatDateTime(datetime_bucket, ?) as datetime", datetimeFormat).
		Select("countIf(status_code_bucket in ('2xx','3xx','4xx','5xx')) as total_count").
		Select("countIf(status_code_bucket = '2xx') as count_2xx").
		Select("countIf(status_code_bucket = '3xx') as count_3xx").
		Select("countIf(status_code_bucket = '4xx') as count_4xx").
		Select("countIf(status_code_bucket = '5xx') as count_5xx").
		Where("team_id = toUUID(?)", teamId).
		Where("app_id = toUUID(?)", appId).
		Where("timestamp >= ?", af.From).
		Where("timestamp < ?", af.To)

	applyDomainFilter(stmt, domain)
	applyPathFilter(stmt, path)
	applyEventsFilters(stmt, af)

	stmt.GroupBy("datetime_bucket").OrderBy("datetime_bucket")
	defer stmt.Close()

	ctx = withQueryName(ctx, "status_codes_plot")

	rows, err := ch.Query(ctx, stmt.String(), stmt.Args()...)
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

// GetEndpointStatusCodesPlot returns exact HTTP status-code counts over time.
func GetEndpointStatusCodesPlot(
	ctx context.Context,
	ch driver.Conn,
	appId, teamId uuid.UUID,
	domain, path string,
	af *filter.AppFilter,
	bucketExpr, datetimeFormat string,
) (*EndpointStatusCodesPlotResponse, error) {
	ctx = chquery.WithTeamScope(ctx, teamId)
	stmt := sqlf.From("http_events").
		Select(bucketExpr+" as datetime_bucket", af.Timezone).
		Select("formatDateTime(datetime_bucket, ?) as datetime", datetimeFormat).
		Select("status_code").
		Select("count() as count").
		Where("team_id = toUUID(?)", teamId).
		Where("app_id = toUUID(?)", appId).
		Where("status_code != ?", 0).
		Where("timestamp >= ?", af.From).
		Where("timestamp < ?", af.To)

	applyDomainFilter(stmt, domain)
	applyPathFilter(stmt, path)
	applyEventsFilters(stmt, af)

	stmt.GroupBy("datetime_bucket, status_code").OrderBy("datetime_bucket, status_code")
	defer stmt.Close()

	rows, err := ch.Query(withQueryName(ctx, "endpoint_status_codes_plot"), stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}

	dataPointsByDatetime := make(map[string]MetricsDataPoint)
	datetimeOrder := make([]string, 0)
	statusCodeSet := make(map[int]struct{})
	for rows.Next() {
		var datetimeBucket time.Time
		var datetime string
		var statusCode uint16
		var count uint64
		if err := rows.Scan(&datetimeBucket, &datetime, &statusCode, &count); err != nil {
			return nil, err
		}

		dataPoint, ok := dataPointsByDatetime[datetime]
		if !ok {
			dataPoint = MetricsDataPoint{
				"datetime":    datetime,
				"total_count": uint64(0),
			}
			dataPointsByDatetime[datetime] = dataPoint
			datetimeOrder = append(datetimeOrder, datetime)
		}

		code := int(statusCode)
		dataPoint[fmt.Sprintf("count_%d", code)] = count
		dataPoint["total_count"] = dataPoint["total_count"].(uint64) + count
		statusCodeSet[code] = struct{}{}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	statusCodes := make([]int, 0, len(statusCodeSet))
	for code := range statusCodeSet {
		statusCodes = append(statusCodes, code)
	}
	sort.Ints(statusCodes)

	dataPoints := make([]MetricsDataPoint, 0, len(datetimeOrder))
	for _, datetime := range datetimeOrder {
		dataPoints = append(dataPoints, dataPointsByDatetime[datetime])
	}

	return &EndpointStatusCodesPlotResponse{
		StatusCodes: statusCodes,
		DataPoints:  dataPoints,
	}, nil
}

// GetLatencyPlot returns latency percentiles over time for an optional endpoint selection.
func GetLatencyPlot(
	ctx context.Context,
	ch driver.Conn,
	appId, teamId uuid.UUID,
	domain, path string,
	af *filter.AppFilter,
	bucketExpr, datetimeFormat string,
) ([]MetricsDataPoint, error) {
	ctx = chquery.WithTeamScope(ctx, teamId)

	result := make([]MetricsDataPoint, 0)

	stmt := sqlf.From("http_events").
		Select(bucketExpr+" as datetime_bucket", af.Timezone).
		Select("formatDateTime(datetime_bucket, ?) as datetime", datetimeFormat).
		Select("quantiles(0.50, 0.90, 0.95, 0.99)(latency_ms) as latencies").
		Select("count() as count").
		Where("team_id = toUUID(?)", teamId).
		Where("app_id = toUUID(?)", appId).
		Where("status_code != ?", 0).
		Where("timestamp >= ?", af.From).
		Where("timestamp < ?", af.To)

	applyDomainFilter(stmt, domain)
	applyPathFilter(stmt, path)
	applyEventsFilters(stmt, af)

	stmt.GroupBy("datetime_bucket").OrderBy("datetime_bucket")
	defer stmt.Close()

	ctx = withQueryName(ctx, "latency_plot")

	rows, err := ch.Query(ctx, stmt.String(), stmt.Args()...)
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

// FetchTimelinePlot returns five-second, per-session request-count buckets for
// the whole app or a selected domain and path pattern.
func FetchTimelinePlot(ctx context.Context, ch driver.Conn, appId, teamId uuid.UUID, domain, pathPattern string, af *filter.AppFilter) (*TimelineResponse, error) {
	ctx = chquery.WithTeamScope(ctx, teamId)

	stmt := sqlf.
		Select("domain").
		Select("path").
		Select("(sumMap(session_elapsed_counts) AS elapsed_count_pairs).1 AS bucket_secs").
		Select("elapsed_count_pairs.2 AS bucket_counts").
		Select("uniqCombined64Merge(session_count) AS sessions").
		From("http_metrics").
		Where("team_id = toUUID(?)", teamId).
		Where("app_id = toUUID(?)", appId).
		Where("timestamp >= ?", af.From).
		Where("timestamp < ?", af.To)

	applyDomainFilter(stmt, domain)
	applyPathFilter(stmt, pathPattern)

	applyMetricsFilters(stmt, af)

	// A broad selection may match many patterns; retain the most requested ones.
	stmt.GroupBy("domain, path").
		OrderBy("sum(request_count) DESC").
		Limit(maxTimelineEndpointPatterns)

	defer stmt.Close()

	ctx = withQueryName(ctx, "timeline_plot")

	rows, err := ch.Query(ctx, stmt.String(), stmt.Args()...)
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
			avg := math.Round(float64(bucketCounts[i])/float64(sessions)*100) / 100
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
