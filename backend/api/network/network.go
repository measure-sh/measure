package network

import (
	"backend/api/filter"
	"backend/api/server"
	"context"
	"fmt"
	"math"
	"net/url"
	"strings"

	"github.com/google/uuid"
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

// ParseURL splits a full URL into origin (scheme://host)
// and path components.
func ParseURL(rawURL string) (origin, path string, err error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return
	}
	origin = fmt.Sprintf("%s://%s", u.Scheme, u.Host)
	path = u.Path
	return
}

// FetchOrigins returns list of
// unique origins for a given
// app and team.
func FetchOrigins(ctx context.Context, appId, teamId uuid.UUID) (origins []string, err error) {
	stmt := sqlf.
		Select("distinct origin").
		From("http").
		Where("team_id = ?", teamId).
		Where("app_id = ?", appId).
		OrderBy("origin")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var origin string
		if err = rows.Scan(&origin); err != nil {
			return
		}
		if err = rows.Err(); err != nil {
			return
		}
		origins = append(origins, origin)
	}

	err = rows.Err()
	return
}

// applyPathFilter adds path matching to the query.
// Converts * wildcards to % for LIKE matching.
func applyPathFilter(stmt *sqlf.Stmt, pathPattern string) {
	if strings.Contains(pathPattern, "*") {
		likePattern := strings.ReplaceAll(pathPattern, "*", "%")
		stmt.Where("path LIKE ?", likePattern)
	} else {
		stmt.Where("path = ?", pathPattern)
	}
}

// applyFilters applies common filters from AppFilter
// to the query statement.
func applyFilters(stmt *sqlf.Stmt, af *filter.AppFilter) {
	if af.HasVersions() {
		selectedVersions, err := af.VersionPairs()
		if err == nil {
			stmt.Where("(`attribute.app_version`, `attribute.app_build`) in (?)", selectedVersions.Parameterize())
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

// OverviewEndpoint represents a single endpoint
// in the network overview.
type OverviewEndpoint struct {
	Origin      string   `json:"origin"`
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
	inner := sqlf.From("http").
		Select("origin").
		Select(`replaceRegexpAll(
      replaceRegexpAll(
        replaceRegexpAll(
          replaceRegexpAll(
            replaceRegexpAll(
              replaceRegexpAll(path,
                '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', '*'),
              '[0-9a-fA-F]{40}', '*'),
            '[0-9a-fA-F]{32}', '*'),
          '0[xX][0-9a-fA-F]+', '*'),
        '[0-9]{4}-[01][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]', '*'),
      '/[^/]*[0-9]{2,}[^/]*', '/*') AS path_pattern`).
		Select("quantile(0.95)(duration) AS p95_latency").
		Select("countIf(status_code >= 400 AND status_code < 600) * 100.0 / count() AS error_rate").
		Select("count() AS frequency").
		Clause("prewhere team_id = ? and app_id = ? and bucket >= ? and bucket <= ?", teamId, appId, af.From, af.To).
		GroupBy("origin, path_pattern")

	applyFilters(inner, af)

	defer inner.Close()

	query := fmt.Sprintf(`WITH grouped AS (%s)
SELECT 'latency' as category, origin, path_pattern, p95_latency, error_rate, frequency FROM grouped ORDER BY p95_latency DESC LIMIT %d
UNION ALL
SELECT 'error_rate' as category, origin, path_pattern, p95_latency, error_rate, frequency FROM grouped ORDER BY error_rate DESC LIMIT %d
UNION ALL
SELECT 'frequency' as category, origin, path_pattern, p95_latency, error_rate, frequency FROM grouped ORDER BY frequency DESC LIMIT %d`,
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
		if err := rows.Scan(&category, &ep.Origin, &ep.PathPattern, &p95Latency, &errorRate, &ep.Frequency); err != nil {
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
// frequency for the given origin and path pattern.
func FetchMetrics(ctx context.Context, appId, teamId uuid.UUID, origin, pathPattern string, af *filter.AppFilter) (result *MetricsResponse, err error) {
	result = &MetricsResponse{}

	// Fetch latency metrics
	latencyStmt := sqlf.From("http").
		Select("formatDateTime(bucket, '%Y-%m-%d', ?) as datetime", af.Timezone).
		Select("quantiles(0.50, 0.90, 0.95, 0.99)(duration) as latencies").
		Clause("prewhere team_id = ? and app_id = ? and origin = ? and bucket >= ? and bucket <= ?", teamId, appId, origin, af.From, af.To)

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
	statusStmt := sqlf.From("http").
		Select("toString(status_code) as status_code_str").
		Select("formatDateTime(bucket, '%Y-%m-%d', ?) as datetime", af.Timezone).
		Select("count() as count").
		Clause("prewhere team_id = ? and app_id = ? and origin = ? and bucket >= ? and bucket <= ?", teamId, appId, origin, af.From, af.To)

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
	freqStmt := sqlf.From("http").
		Select("formatDateTime(bucket, '%Y-%m-%d', ?) as datetime", af.Timezone).
		Select("count() as count").
		Clause("prewhere team_id = ? and app_id = ? and origin = ? and bucket >= ? and bucket <= ?", teamId, appId, origin, af.From, af.To)

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
