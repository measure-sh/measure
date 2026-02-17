package network

import (
	"backend/api/filter"
	"backend/api/server"
	"context"
	"fmt"
	"math"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
)

// MetricsDataPoint represents a single data point
// in a time series.
type MetricsDataPoint map[string]any

// MetricDataPoint represents a named time series.
type MetricDataPoint struct {
	ID   string             `json:"id"`
	Data []MetricsDataPoint `json:"data"`
}

// MetricsResponse contains all network metrics
// grouped by category.
type MetricsResponse struct {
	Latency     []MetricsDataPoint `json:"latency"`
	StatusCodes []MetricDataPoint  `json:"status_codes"`
	Frequency   []MetricsDataPoint `json:"frequency"`
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

// FetchDomains returns list of
// unique domains for a given
// app and team.
func FetchDomains(ctx context.Context, appId, teamId uuid.UUID) (domains []string, err error) {
	stmt := sqlf.
		Select("domain").
		From("http_events").
		Where("team_id = ?", teamId).
		Where("app_id = ?", appId).
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
// applyPathFilter adds path matching to the query.
// Optimizes to use startsWith when possible, falls back to LIKE.
// * matches any characters, ** at the end matches everything after.
func applyPathFilter(stmt *sqlf.Stmt, pathPattern string) {
	// Handle ** at the end - matches everything after prefix
	if strings.HasSuffix(pathPattern, "**") {
		prefix := strings.TrimSuffix(pathPattern, "**")
		if !strings.Contains(prefix, "*") {
			// Pure prefix match - use startsWith
			stmt.Where("startsWith(path, ?)", prefix)
		} else {
			// Has wildcards in prefix - use LIKE
			likePattern := strings.ReplaceAll(prefix, "*", "%") + "%"
			stmt.Where("path LIKE ?", likePattern)
		}
		return
	}

	// Handle single * wildcards
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
}

// roundPtr rounds a float64 to 1 decimal place
// and returns a pointer.
func roundPtr(v float64) *float64 {
	rounded := math.Round(v*10) / 10
	return &rounded
}

// groupByID groups rows into MetricsInstance slices
// keyed by id field.
func groupByID(id string, data MetricsDataPoint, lut map[string]int, instances *[]MetricDataPoint) {
	ndx, ok := lut[id]
	if ok {
		(*instances)[ndx].Data = append((*instances)[ndx].Data, data)
	} else {
		*instances = append(*instances, MetricDataPoint{
			ID:   id,
			Data: []MetricsDataPoint{data},
		})
		lut[id] = len(*instances) - 1
	}
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

// OverviewEndpoint represents a single endpoint
// in the network overview.
type OverviewEndpoint struct {
	Domain      string   `json:"domain"`
	PathPattern string   `json:"path_pattern"`
	P95Latency  *float64 `json:"p95_latency"`
	ErrorRate   *float64 `json:"error_rate"`
	Frequency   uint64   `json:"frequency"`
}

// OverviewResponse contains high-level network
// performance summary metrics.
type OverviewResponse struct {
	TopNLatency   []OverviewEndpoint `json:"top_n_latency"`
	TopNErrorRate []OverviewEndpoint `json:"top_n_error_rate"`
	TopNFrequency []OverviewEndpoint `json:"top_n_frequency"`
}

// topN is the default number of endpoints to return
// in each overview category.
const topN = 10

// FetchOverview returns a high-level summary of
// network performance for a given app.
func FetchOverview(ctx context.Context, appId, teamId uuid.UUID, af *filter.AppFilter) (*OverviewResponse, error) {
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

	result := &OverviewResponse{
		TopNLatency:   []OverviewEndpoint{},
		TopNErrorRate: []OverviewEndpoint{},
		TopNFrequency: []OverviewEndpoint{},
	}
	for rows.Next() {
		var category string
		var ep OverviewEndpoint
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
			result.TopNLatency = append(result.TopNLatency, ep)
		case "error_rate":
			result.TopNErrorRate = append(result.TopNErrorRate, ep)
		case "frequency":
			result.TopNFrequency = append(result.TopNFrequency, ep)
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
// it uses pre-aggregated data from http_rule_metrics,
// otherwise falls back to raw http_events.
func FetchMetrics(ctx context.Context, appId, teamId uuid.UUID, domain, pathPattern string, af *filter.AppFilter) (*MetricsResponse, error) {
	active, err := isActiveRule(ctx, teamId, appId, domain, pathPattern)
	if err != nil {
		return nil, err
	}
	if active {
		return fetchMetricsFromRules(ctx, appId, teamId, domain, pathPattern, af)
	}
	return fetchMetricsFromEvents(ctx, appId, teamId, domain, pathPattern, af)
}

// fetchMetricsFromRules queries pre-aggregated data
// from http_rule_metrics for a known domain+path rule.
func fetchMetricsFromRules(ctx context.Context, appId, teamId uuid.UUID, domain, path string, af *filter.AppFilter) (result *MetricsResponse, err error) {
	result = &MetricsResponse{}

	// Fetch latency metrics
	latencyStmt := sqlf.From("http_rule_metrics").
		Select("formatDateTime(time_bucket, '%Y-%m-%d', ?) as datetime", af.Timezone).
		Select("quantilesMerge(0.5, 0.9, 0.95, 0.99)(latency_quantiles) as latencies").
		Where("team_id = ? and app_id = ? and domain = ? and path = ? and time_bucket >= ? and time_bucket <= ?", teamId, appId, domain, path, af.From, af.To)

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
		if err = latencyRows.Scan(&datetime, &latencies); err != nil {
			return
		}
		if err = latencyRows.Err(); err != nil {
			return
		}
		data := MetricsDataPoint{"datetime": datetime}
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
		Select("toString(status_code) as status_code_str").
		Select("formatDateTime(time_bucket, '%Y-%m-%d', ?) as datetime", af.Timezone).
		Select("sum(request_count) as count").
		Where("team_id = ? and app_id = ? and domain = ? and path = ? and time_bucket >= ? and time_bucket <= ?", teamId, appId, domain, path, af.From, af.To)

	applyFilters(statusStmt, af)

	statusStmt.GroupBy("status_code, datetime")
	statusStmt.OrderBy("datetime, status_code")

	defer statusStmt.Close()

	statusRows, err := server.Server.ChPool.Query(ctx, statusStmt.String(), statusStmt.Args()...)
	if err != nil {
		return
	}

	type statusRow struct {
		statusCode string
		datetime   string
		count      uint64
	}
	var statusData []statusRow
	datetimeTotals := make(map[string]uint64)

	for statusRows.Next() {
		var r statusRow
		if err = statusRows.Scan(&r.statusCode, &r.datetime, &r.count); err != nil {
			return
		}
		if err = statusRows.Err(); err != nil {
			return
		}
		statusData = append(statusData, r)
		datetimeTotals[r.datetime] += r.count
	}
	if err = statusRows.Err(); err != nil {
		return
	}

	statusLut := make(map[string]int)
	for _, r := range statusData {
		var pct float64
		if total := datetimeTotals[r.datetime]; total > 0 {
			pct = float64(r.count) * 100.0 / float64(total)
		}
		groupByID(r.statusCode, MetricsDataPoint{"datetime": r.datetime, "percentage": roundPtr(pct)}, statusLut, &result.StatusCodes)
	}

	// Fetch frequency metrics
	freqStmt := sqlf.From("http_rule_metrics").
		Select("formatDateTime(time_bucket, '%Y-%m-%d', ?) as datetime", af.Timezone).
		Select("sum(request_count) as count").
		Where("team_id = ? and app_id = ? and domain = ? and path = ? and time_bucket >= ? and time_bucket <= ?", teamId, appId, domain, path, af.From, af.To)

	applyFilters(freqStmt, af)

	freqStmt.GroupBy("datetime")
	freqStmt.OrderBy("datetime")

	defer freqStmt.Close()

	freqRows, err := server.Server.ChPool.Query(ctx, freqStmt.String(), freqStmt.Args()...)
	if err != nil {
		return
	}

	for freqRows.Next() {
		var datetime string
		var count uint64
		if err = freqRows.Scan(&datetime, &count); err != nil {
			return
		}
		if err = freqRows.Err(); err != nil {
			return
		}
		result.Frequency = append(result.Frequency, MetricsDataPoint{"datetime": datetime, "count": count})
	}
	err = freqRows.Err()
	return
}

// fetchMetricsFromEvents queries raw http_events
// for endpoints that don't have pre-aggregated rule data.
func fetchMetricsFromEvents(ctx context.Context, appId, teamId uuid.UUID, domain, pathPattern string, af *filter.AppFilter) (result *MetricsResponse, err error) {
	result = &MetricsResponse{}

	// Fetch latency metrics
	latencyStmt := sqlf.From("http_events").
		Select("formatDateTime(timestamp, '%Y-%m-%d', ?) as datetime", af.Timezone).
		Select("quantiles(0.50, 0.90, 0.95, 0.99)(latency_ms) as latencies").
		Where("team_id = ? and app_id = ? and domain = ? and timestamp >= ? and timestamp <= ?", teamId, appId, domain, af.From, af.To)

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
		if err = latencyRows.Scan(&datetime, &latencies); err != nil {
			return
		}
		if err = latencyRows.Err(); err != nil {
			return
		}
		data := MetricsDataPoint{"datetime": datetime}
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
		Select("toString(status_code) as status_code_str").
		Select("formatDateTime(timestamp, '%Y-%m-%d', ?) as datetime", af.Timezone).
		Select("count() as count").
		Where("team_id = ? and app_id = ? and domain = ? and timestamp >= ? and timestamp <= ?", teamId, appId, domain, af.From, af.To)

	applyPathFilter(statusStmt, pathPattern)
	applyFilters(statusStmt, af)

	statusStmt.GroupBy("status_code, datetime")
	statusStmt.OrderBy("datetime, status_code")

	defer statusStmt.Close()

	statusRows, err := server.Server.ChPool.Query(ctx, statusStmt.String(), statusStmt.Args()...)
	if err != nil {
		return
	}

	type statusRow struct {
		statusCode string
		datetime   string
		count      uint64
	}
	var statusData []statusRow
	datetimeTotals := make(map[string]uint64)

	for statusRows.Next() {
		var r statusRow
		if err = statusRows.Scan(&r.statusCode, &r.datetime, &r.count); err != nil {
			return
		}
		if err = statusRows.Err(); err != nil {
			return
		}
		statusData = append(statusData, r)
		datetimeTotals[r.datetime] += r.count
	}
	if err = statusRows.Err(); err != nil {
		return
	}

	statusLut := make(map[string]int)
	for _, r := range statusData {
		var pct float64
		if total := datetimeTotals[r.datetime]; total > 0 {
			pct = float64(r.count) * 100.0 / float64(total)
		}
		groupByID(r.statusCode, MetricsDataPoint{"datetime": r.datetime, "percentage": roundPtr(pct)}, statusLut, &result.StatusCodes)
	}

	// Fetch frequency metrics
	freqStmt := sqlf.From("http_events").
		Select("formatDateTime(timestamp, '%Y-%m-%d', ?) as datetime", af.Timezone).
		Select("count() as count").
		Where("team_id = ? and app_id = ? and domain = ? and timestamp >= ? and timestamp <= ?", teamId, appId, domain, af.From, af.To)

	applyPathFilter(freqStmt, pathPattern)
	applyFilters(freqStmt, af)

	freqStmt.GroupBy("datetime")
	freqStmt.OrderBy("datetime")

	defer freqStmt.Close()

	freqRows, err := server.Server.ChPool.Query(ctx, freqStmt.String(), freqStmt.Args()...)
	if err != nil {
		return
	}

	for freqRows.Next() {
		var datetime string
		var count uint64
		if err = freqRows.Scan(&datetime, &count); err != nil {
			return
		}
		if err = freqRows.Err(); err != nil {
			return
		}
		result.Frequency = append(result.Frequency, MetricsDataPoint{"datetime": datetime, "count": count})
	}
	err = freqRows.Err()
	return
}

func GetErrorRatePlot(ctx context.Context, appId, teamId uuid.UUID, af *filter.AppFilter) (result []MetricsDataPoint, err error) {
	stmt := sqlf.From("http_events").
		Select("formatDateTime(timestamp, '%Y-%m-%d', ?) as datetime", af.Timezone).
		Select("countIf(status_code >= 400 OR status_code = 0) as error_count").
		Select("count() as total_count").
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
		var errorCount, totalCount uint64
		if err = rows.Scan(&datetime, &errorCount, &totalCount); err != nil {
			return
		}
		if err = rows.Err(); err != nil {
			return
		}
		result = append(result, MetricsDataPoint{
			"datetime":    datetime,
			"error_count": errorCount,
			"total_count": totalCount,
		})
	}
	err = rows.Err()
	return
}
