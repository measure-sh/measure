package measure

import (
	"context"
	"errors"
	"fmt"
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

// MemoryUsageBreakdownPoint contains memory percentiles for a device memory tier.
type MemoryUsageBreakdownPoint struct {
	RamTier      string   `json:"ram_tier"`
	P50          *float64 `json:"p50"`
	P90          *float64 `json:"p90"`
	P95          *float64 `json:"p95"`
	P99          *float64 `json:"p99"`
	SessionCount uint64   `json:"session_count"`
	SampleCount  uint64   `json:"sample_count"`
}

// MemoryUsageDistributionPoint contains the percentage of samples in a memory bucket.
type MemoryUsageDistributionPoint struct {
	Bucket      string  `json:"bucket"`
	Percentage  float64 `json:"percentage"`
	SampleCount uint64  `json:"sample_count"`
}

// GetMemoryUsagePlot returns percentiles of individual Anon RSS + Swap samples,
// grouped by time interval and app version.
func (a App) GetMemoryUsagePlot(ctx context.Context, rch driver.Conn, flt *filter.Filter, appImportance string) (points []MemoryUsagePlotPoint, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	if err := validateMemoryUsageQuery(flt, appImportance); err != nil {
		return nil, err
	}

	flt.SetDefaultPlotTimeGroupIfUnset()
	groupExpr, err := GetPlotTimeGroupExpr("e.timestamp", flt.PlotTimeGroup)
	if err != nil {
		return nil, err
	}

	filteredSessions, err := a.memoryFilteredSessions(flt)
	if err != nil {
		return nil, err
	}
	stmt := memoryUsageEvents(filteredSessions, a, flt, appImportance).
		Select("concat(tupleElement(s.app_version, 1), ' ', '(', tupleElement(s.app_version, 2), ')') AS version").
		Select(groupExpr.BucketExpr+" AS datetime_bucket", flt.Timezone).
		Select("formatDateTime(datetime_bucket, ?) AS datetime", groupExpr.DatetimeFormat).
		Select("toFloat64(round(quantileTDigest(0.50)(e.memory_usage.anon_rss + e.memory_usage.swap), 2)) AS p50").
		Select("toFloat64(round(quantileTDigest(0.90)(e.memory_usage.anon_rss + e.memory_usage.swap), 2)) AS p90").
		Select("toFloat64(round(quantileTDigest(0.95)(e.memory_usage.anon_rss + e.memory_usage.swap), 2)) AS p95").
		Select("toFloat64(round(quantileTDigest(0.99)(e.memory_usage.anon_rss + e.memory_usage.swap), 2)) AS p99").
		Select("count() AS sample_count").
		GroupBy("s.app_version, datetime_bucket").
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

// GetMemoryUsageBreakdown returns sample percentiles grouped by existing device memory filter tier.
func (a App) GetMemoryUsageBreakdown(ctx context.Context, rch driver.Conn, flt *filter.Filter, appImportance string) (points []MemoryUsageBreakdownPoint, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	if err := validateMemoryUsageQuery(flt, appImportance); err != nil {
		return nil, err
	}

	filteredSessions, err := a.memoryFilteredSessions(flt)
	if err != nil {
		return nil, err
	}
	tierExpr := memoryTierExpression("s.device_total_memory")
	stmt := memoryUsageEvents(filteredSessions, a, flt, appImportance).
		Select(tierExpr + " AS ram_tier").
		Select("toFloat64(round(quantileTDigest(0.50)(e.memory_usage.anon_rss + e.memory_usage.swap), 2)) AS p50").
		Select("toFloat64(round(quantileTDigest(0.90)(e.memory_usage.anon_rss + e.memory_usage.swap), 2)) AS p90").
		Select("toFloat64(round(quantileTDigest(0.95)(e.memory_usage.anon_rss + e.memory_usage.swap), 2)) AS p95").
		Select("toFloat64(round(quantileTDigest(0.99)(e.memory_usage.anon_rss + e.memory_usage.swap), 2)) AS p99").
		Select("uniqExact(e.session_id) AS session_count").
		Select("count() AS sample_count").
		GroupBy("ram_tier").
		OrderBy("indexOf(['0-3gb', '4-5gb', '6-7gb', '8-11gb', '12-15gb', '16-31gb', '32-63gb', '64gb+', 'unknown'], ram_tier)")
	defer stmt.Close()

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var point MemoryUsageBreakdownPoint
		if err := rows.Scan(&point.RamTier, &point.P50, &point.P90, &point.P95, &point.P99, &point.SessionCount, &point.SampleCount); err != nil {
			return nil, err
		}
		points = append(points, point)
	}
	return points, rows.Err()
}

// GetMemoryUsageDistribution returns the distribution of individual memory samples.
func (a App) GetMemoryUsageDistribution(ctx context.Context, rch driver.Conn, flt *filter.Filter, appImportance string) (points []MemoryUsageDistributionPoint, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	if err := validateMemoryUsageQuery(flt, appImportance); err != nil {
		return nil, err
	}

	filteredSessions, err := a.memoryFilteredSessions(flt)
	if err != nil {
		return nil, err
	}
	const bucketSizeKiB = 100 * 1024
	bucketExpr := "least(intDiv(toUInt64(e.memory_usage.anon_rss + e.memory_usage.swap), ?), 9)"
	stmt := memoryUsageEvents(filteredSessions, a, flt, appImportance).
		Select(bucketExpr+" AS bucket", bucketSizeKiB).
		Select("count() AS sample_count").
		GroupBy("bucket").
		OrderBy("bucket")
	defer stmt.Close()

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var total uint64
	type bucketCount struct {
		bucket uint64
		count  uint64
	}
	var counts []bucketCount
	for rows.Next() {
		var item bucketCount
		if err := rows.Scan(&item.bucket, &item.count); err != nil {
			return nil, err
		}
		counts = append(counts, item)
		total += item.count
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if total == 0 {
		return []MemoryUsageDistributionPoint{}, nil
	}
	for _, item := range counts {
		points = append(points, MemoryUsageDistributionPoint{
			Bucket:      memoryDistributionBucketLabel(item.bucket),
			Percentage:  float64(item.count) * 100 / float64(total),
			SampleCount: item.count,
		})
	}
	return points, nil
}

func memoryDistributionBucketLabel(bucket uint64) string {
	if bucket >= 9 {
		return "900+"
	}
	return fmt.Sprintf("%d-%d", bucket*100, (bucket+1)*100)
}

func (a App) memoryFilteredSessions(flt *filter.Filter) (*sqlf.Stmt, error) {
	stmt := sqlf.From("sessions").
		Select("session_id").
		Select("app_version").
		Select("device_total_memory").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("last_event_timestamp >= ? AND first_event_timestamp <= ?", flt.From, flt.To).
		GroupBy("session_id, app_version, device_total_memory")
	if flt.HasFilterExpr() {
		if err := applySessionsPredicate(stmt, flt); err != nil {
			stmt.Close()
			return nil, err
		}
	}
	return stmt, nil
}

func memoryUsageEvents(filteredSessions *sqlf.Stmt, a App, flt *filter.Filter, appImportance string) *sqlf.Stmt {
	stmt := sqlf.With("filtered_sessions", filteredSessions).
		From("events AS e").
		Join("filtered_sessions AS s", "e.session_id = s.session_id").
		Where("e.team_id = toUUID(?)", a.TeamId).
		Where("e.app_id = toUUID(?)", a.ID).
		Where("e.type = 'memory_usage'").
		Where("e.timestamp >= ? AND e.timestamp <= ?", flt.From, flt.To).
		Where("e.memory_usage.anon_rss + e.memory_usage.swap > 0")
	if appImportance != "" {
		stmt.Where("e.memory_usage.app_importance = ?", appImportance)
	}
	return stmt
}

func memoryTierExpression(column string) string {
	return "multiIf(" + column + " = 0, 'unknown', " +
		column + " > 0 AND " + column + " < 4194304, '0-3gb', " +
		column + " < 6291456, '4-5gb', " +
		column + " < 8388608, '6-7gb', " +
		column + " < 12582912, '8-11gb', " +
		column + " < 16777216, '12-15gb', " +
		column + " < 33554432, '16-31gb', " +
		column + " < 67108864, '32-63gb', '64gb+')"
}

func validateMemoryUsageQuery(flt *filter.Filter, appImportance string) error {
	if flt.Timezone == "" {
		return errors.New("missing timezone filter")
	}
	if !validMemoryAppImportance(appImportance) {
		return errors.New("invalid app importance")
	}
	return nil
}

func validMemoryAppImportance(value string) bool {
	switch value {
	case "", "foreground", "user_service", "background":
		return true
	default:
		return false
	}
}
