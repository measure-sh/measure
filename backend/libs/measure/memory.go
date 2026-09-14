package measure

import (
	"context"
	"errors"
	"time"

	"backend/libs/chquery"
	"backend/libs/filter"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/leporo/sqlf"
)

// MemoryUsagePlotPoint contains percentiles of individual memory samples.
type MemoryUsagePlotPoint struct {
	Version     string   `json:"version"`
	DateTime    string   `json:"datetime"`
	P50         *float64 `json:"p50"`
	P90         *float64 `json:"p90"`
	P95         *float64 `json:"p95"`
	P99         *float64 `json:"p99"`
	SampleCount uint64   `json:"sample_count"`
}

// GetMemoryUsagePlot returns percentiles of individual Anon RSS + Swap samples,
// grouped by time interval and app version.
func (a App) GetMemoryUsagePlot(ctx context.Context, rch driver.Conn, flt *filter.Filter, appImportance string) (points []MemoryUsagePlotPoint, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	if flt.Timezone == "" {
		return nil, errors.New("missing timezone filter")
	}
	if !validMemoryAppImportance(appImportance) {
		return nil, errors.New("invalid app importance")
	}

	flt.SetDefaultPlotTimeGroupIfUnset()
	groupExpr, err := GetPlotTimeGroupExpr("e.timestamp", flt.PlotTimeGroup)
	if err != nil {
		return nil, err
	}

	filteredSessions := sqlf.From("sessions").
		Select("session_id").
		Select("app_version").
		Select("device_total_memory").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("last_event_timestamp >= ? AND first_event_timestamp <= ?", flt.From, flt.To).
		GroupBy("session_id, app_version, device_total_memory")
	if flt.HasFilterExpr() {
		if err := applySessionsPredicate(filteredSessions, flt); err != nil {
			return nil, err
		}
	}

	stmt := sqlf.With("filtered_sessions", filteredSessions).
		From("events AS e").
		Join("filtered_sessions AS s", "e.session_id = s.session_id").
		Select("concat(tupleElement(s.app_version, 1), ' ', '(', tupleElement(s.app_version, 2), ')') AS version").
		Select(groupExpr.BucketExpr+" AS datetime_bucket", flt.Timezone).
		Select("formatDateTime(datetime_bucket, ?) AS datetime", groupExpr.DatetimeFormat).
		Select("toFloat64(round(quantileTDigest(0.50)(e.memory_usage.anon_rss + e.memory_usage.swap), 2)) AS p50").
		Select("toFloat64(round(quantileTDigest(0.90)(e.memory_usage.anon_rss + e.memory_usage.swap), 2)) AS p90").
		Select("toFloat64(round(quantileTDigest(0.95)(e.memory_usage.anon_rss + e.memory_usage.swap), 2)) AS p95").
		Select("toFloat64(round(quantileTDigest(0.99)(e.memory_usage.anon_rss + e.memory_usage.swap), 2)) AS p99").
		Select("count() AS sample_count").
		Where("e.team_id = toUUID(?)", a.TeamId).
		Where("e.app_id = toUUID(?)", a.ID).
		Where("e.type = 'memory_usage'").
		Where("e.timestamp >= ? AND e.timestamp <= ?", flt.From, flt.To).
		Where("e.memory_usage.anon_rss + e.memory_usage.swap > 0")
	if appImportance != "" {
		stmt.Where("e.memory_usage.app_importance = ?", appImportance)
	}
	stmt.GroupBy("s.app_version, datetime_bucket").
		OrderBy("datetime_bucket, tupleElement(s.app_version, 2) DESC")
	defer stmt.Close()

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var point MemoryUsagePlotPoint
		var bucket time.Time
		if err := rows.Scan(&point.Version, &bucket, &point.DateTime, &point.P50, &point.P90, &point.P95, &point.P99, &point.SampleCount); err != nil {
			return nil, err
		}
		points = append(points, point)
	}
	return points, rows.Err()
}

func validMemoryAppImportance(value string) bool {
	switch value {
	case "", "foreground", "user_service", "background":
		return true
	default:
		return false
	}
}
