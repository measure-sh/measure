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

// MemoryUsagePlotPoint contains per-version session peak memory percentiles.
type MemoryUsagePlotPoint struct {
	Version      string   `json:"version"`
	DateTime     string   `json:"datetime"`
	P50          *float64 `json:"p50"`
	P90          *float64 `json:"p90"`
	P95          *float64 `json:"p95"`
	P99          *float64 `json:"p99"`
	SessionCount uint64   `json:"session_count"`
}

// GetMemoryUsagePlot returns percentiles of session peak total memory,
// grouped by the selected time interval and app version.
func (a App) GetMemoryUsagePlot(ctx context.Context, rch driver.Conn, flt *filter.Filter) (points []MemoryUsagePlotPoint, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	if flt.Timezone == "" {
		return nil, errors.New("missing timezone filter")
	}

	flt.SetDefaultPlotTimeGroupIfUnset()
	groupExpr, err := GetPlotTimeGroupExpr("start_time", flt.PlotTimeGroup)
	if err != nil {
		return nil, err
	}

	sessions := sqlf.From("sessions").
		Select("session_id").
		Select("app_version").
		Select("min(first_event_timestamp) AS start_time").
		Select("max(peak_total_memory) AS peak_total_memory").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("first_event_timestamp >= ? AND last_event_timestamp <= ?", flt.From, flt.To).
		GroupBy("session_id, app_version")
	if flt.HasFilterExpr() {
		if err := applySessionsPredicate(sessions, flt); err != nil {
			return nil, err
		}
	}

	stmt := sqlf.With("base", sessions).
		From("base").
		Select("concat(tupleElement(app_version, 1), ' ', '(', tupleElement(app_version, 2), ')') AS version").
		Select(groupExpr.BucketExpr+" AS datetime_bucket", flt.Timezone).
		Select("formatDateTime(datetime_bucket, ?) AS datetime", groupExpr.DatetimeFormat).
		Select("round(quantile(0.50)(peak_total_memory), 2) AS p50").
		Select("round(quantile(0.90)(peak_total_memory), 2) AS p90").
		Select("round(quantile(0.95)(peak_total_memory), 2) AS p95").
		Select("round(quantile(0.99)(peak_total_memory), 2) AS p99").
		Select("count() AS session_count").
		Where("peak_total_memory > 0").
		GroupBy("app_version, datetime_bucket").
		OrderBy("datetime_bucket, tupleElement(app_version, 2) DESC")
	defer stmt.Close()

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var point MemoryUsagePlotPoint
		var bucket time.Time
		if err := rows.Scan(&point.Version, &bucket, &point.DateTime, &point.P50, &point.P90, &point.P95, &point.P99, &point.SessionCount); err != nil {
			return nil, err
		}
		points = append(points, point)
	}
	return points, rows.Err()
}
