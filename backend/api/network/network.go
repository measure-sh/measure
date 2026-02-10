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

// LatencyMetric represents a single latency
// data point with percentiles.
type LatencyMetric struct {
	Version  string
	DateTime string
	P50      *float64
	P90      *float64
	P95      *float64
	P99      *float64
}

// StatusCodeMetric represents request count
// for a specific status code at a point in time.
type StatusCodeMetric struct {
	StatusCode string
	DateTime   string
	Count      uint64
}

// FrequencyMetric represents total request count
// at a point in time.
type FrequencyMetric struct {
	Version  string
	DateTime string
	Count    uint64
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
		From("http_metrics").
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

// roundPtr rounds a float64 to 2 decimal places
// and returns a pointer.
func roundPtr(v float64) *float64 {
	rounded := math.Round(v*100) / 100
	return &rounded
}

// FetchLatencyMetrics returns latency percentile
// time series from http_metrics for the given
// origin and path pattern.
func FetchLatencyMetrics(ctx context.Context, appId, teamId uuid.UUID, origin, pathPattern string, af *filter.AppFilter) (metrics []LatencyMetric, err error) {
	stmt := sqlf.From("http_metrics").
		Select("concat(`attribute.app_version`, ' ', '(', `attribute.app_build`, ')') as app_version_fmt").
		Select("formatDateTime(bucket, '%Y-%m-%d', ?) as datetime", af.Timezone).
		Select("quantilesMerge(0.50, 0.90, 0.95, 0.99)(latency_quantile) as latencies").
		Clause("prewhere team_id = ? and app_id = ? and origin = ? and bucket >= ? and bucket <= ?", teamId, appId, origin, af.From, af.To)

	applyPathFilter(stmt, pathPattern)
	applyFilters(stmt, af)

	stmt.GroupBy("`attribute.app_version`, `attribute.app_build`, datetime")
	stmt.OrderBy("datetime, `attribute.app_build` desc")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var m LatencyMetric
		var latencies []float32
		if err = rows.Scan(&m.Version, &m.DateTime, &latencies); err != nil {
			return
		}
		if err = rows.Err(); err != nil {
			return
		}
		if len(latencies) >= 4 {
			m.P50 = roundPtr(float64(latencies[0]))
			m.P90 = roundPtr(float64(latencies[1]))
			m.P95 = roundPtr(float64(latencies[2]))
			m.P99 = roundPtr(float64(latencies[3]))
		}
		metrics = append(metrics, m)
	}

	err = rows.Err()
	return
}

// FetchStatusCodeMetrics returns request count
// time series grouped by status code.
func FetchStatusCodeMetrics(ctx context.Context, appId, teamId uuid.UUID, origin, pathPattern string, af *filter.AppFilter) (metrics []StatusCodeMetric, err error) {
	stmt := sqlf.From("http_metrics").
		Select("toString(status_code) as status_code_str").
		Select("formatDateTime(bucket, '%Y-%m-%d', ?) as datetime", af.Timezone).
		Select("sum(request_count) as count").
		Clause("prewhere team_id = ? and app_id = ? and origin = ? and bucket >= ? and bucket <= ?", teamId, appId, origin, af.From, af.To)

	applyPathFilter(stmt, pathPattern)
	applyFilters(stmt, af)

	stmt.GroupBy("status_code, datetime")
	stmt.OrderBy("datetime, status_code")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var m StatusCodeMetric
		if err = rows.Scan(&m.StatusCode, &m.DateTime, &m.Count); err != nil {
			return
		}
		if err = rows.Err(); err != nil {
			return
		}
		metrics = append(metrics, m)
	}

	err = rows.Err()
	return
}

// FetchFrequencyMetrics returns total request
// count time series grouped by app version.
func FetchFrequencyMetrics(ctx context.Context, appId, teamId uuid.UUID, origin, pathPattern string, af *filter.AppFilter) (metrics []FrequencyMetric, err error) {
	stmt := sqlf.From("http_metrics").
		Select("concat(`attribute.app_version`, ' ', '(', `attribute.app_build`, ')') as app_version_fmt").
		Select("formatDateTime(bucket, '%Y-%m-%d', ?) as datetime", af.Timezone).
		Select("sum(request_count) as count").
		Clause("prewhere team_id = ? and app_id = ? and origin = ? and bucket >= ? and bucket <= ?", teamId, appId, origin, af.From, af.To)

	applyPathFilter(stmt, pathPattern)
	applyFilters(stmt, af)

	stmt.GroupBy("`attribute.app_version`, `attribute.app_build`, datetime")
	stmt.OrderBy("datetime, `attribute.app_build` desc")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var m FrequencyMetric
		if err = rows.Scan(&m.Version, &m.DateTime, &m.Count); err != nil {
			return
		}
		if err = rows.Err(); err != nil {
			return
		}
		metrics = append(metrics, m)
	}

	err = rows.Err()
	return
}
