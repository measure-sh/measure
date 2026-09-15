package measure

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"backend/libs/chquery"
	"backend/libs/event"
	"backend/libs/filter"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

// MemoryUsagePlotPoint contains percentiles of individual memory samples.
type MemoryUsagePlotPoint struct {
	DeviceTotalMemoryTier string   `json:"device_total_memory_tier"`
	DateTime              string   `json:"datetime"`
	P50                   *float64 `json:"p50"`
	P90                   *float64 `json:"p90"`
	P95                   *float64 `json:"p95"`
	P99                   *float64 `json:"p99"`
	SampleCount           uint64   `json:"sample_count"`
}

// MemoryUsageDistributionPoint contains the percentage of samples in a memory bucket.
type MemoryUsageDistributionPoint struct {
	Bucket      string  `json:"bucket"`
	Percentage  float64 `json:"percentage"`
	SampleCount uint64  `json:"sample_count"`
}

// HighMemoryUsageSession describes a session whose P90 memory usage is above
// the configured threshold for its device memory and process state.
type HighMemoryUsageSession struct {
	SessionID       uuid.UUID        `json:"session_id"`
	AppID           uuid.UUID        `json:"app_id"`
	Attribute       *event.Attribute `json:"attribute"`
	FirstEventTime  *time.Time       `json:"first_event_time"`
	LastEventTime   *time.Time       `json:"last_event_time"`
	P90MemoryKB     uint64           `json:"p90_memory_kb"`
	TargetMemoryKB  uint64           `json:"target_memory_kb"`
	PercentOfTarget float64          `json:"percent_of_target"`
}

const memoryKBPerGB uint64 = 1024 * 1024
const memoryUsageKBExpression = "e.memory_usage.anon_rss + e.memory_usage.swap"

var ErrInvalidMemoryAppImportance = errors.New("invalid app importance")

type memoryThresholdRange struct {
	lowerKB     uint64
	upperKB     uint64
	foreground  uint64
	userService uint64
	background  uint64
}

// Memory usage thresholds by device
// total memory and process state.
var memoryThresholdRanges = []memoryThresholdRange{
	{0, 5 * memoryKBPerGB, 2 * memoryKBPerGB, 1 * memoryKBPerGB, 1 * memoryKBPerGB},
	{5 * memoryKBPerGB, 7 * memoryKBPerGB, 9 * memoryKBPerGB / 4, 5 * memoryKBPerGB / 4, 5 * memoryKBPerGB / 4},
	{7 * memoryKBPerGB, 9 * memoryKBPerGB, 9 * memoryKBPerGB / 4, 3 * memoryKBPerGB / 2, 3 * memoryKBPerGB / 2},
	{9 * memoryKBPerGB, 13 * memoryKBPerGB, 13 * memoryKBPerGB / 4, 7 * memoryKBPerGB / 4, 7 * memoryKBPerGB / 4},
	{13 * memoryKBPerGB, 16 * memoryKBPerGB, 17 * memoryKBPerGB / 4, 2 * memoryKBPerGB, 2 * memoryKBPerGB},
	{16 * memoryKBPerGB, 32 * memoryKBPerGB, 6 * memoryKBPerGB, 4 * memoryKBPerGB, 4 * memoryKBPerGB},
	{32 * memoryKBPerGB, 0, 10 * memoryKBPerGB, 6 * memoryKBPerGB, 6 * memoryKBPerGB},
}

func memoryThresholdExpression(deviceMemory, appImportance string) string {
	var threshold func(memoryThresholdRange) uint64
	switch appImportance {
	case "user_service":
		threshold = func(r memoryThresholdRange) uint64 { return r.userService }
	case "background":
		threshold = func(r memoryThresholdRange) uint64 { return r.background }
	default:
		threshold = func(r memoryThresholdRange) uint64 { return r.foreground }
	}

	parts := make([]string, 0, len(memoryThresholdRanges)*2+1)
	for _, r := range memoryThresholdRanges {
		condition := fmt.Sprintf("%s >= %d", deviceMemory, r.lowerKB)
		if r.lowerKB == 0 {
			condition = fmt.Sprintf("%s > 0", deviceMemory)
		}
		if r.upperKB != 0 {
			condition += fmt.Sprintf(" AND %s < %d", deviceMemory, r.upperKB)
		}
		parts = append(parts, fmt.Sprintf("%s, %d", condition, threshold(r)))
	}
	parts = append(parts, "0")
	return "toUInt64(multiIf(" + strings.Join(parts, ", ") + "))"
}

// GetMemoryUsagePlot returns percentiles
// of memory usage samples grouped by
// time interval and device memory tier.
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

	var filteredSessions *sqlf.Stmt
	if flt.HasFilterExpr() {
		filteredSessions, err = a.memoryFilteredSessions(flt)
		if err != nil {
			return nil, err
		}
	}
	tierExpr := memoryTierExpression("e.attribute.device_total_memory")
	stmt := memoryUsageEvents(filteredSessions, a, flt, appImportance).
		Select(tierExpr+" AS device_total_memory_tier").
		Select(groupExpr.BucketExpr+" AS datetime_bucket", flt.Timezone).
		Select("formatDateTime(datetime_bucket, ?) AS datetime", groupExpr.DatetimeFormat).
		Select("toFloat64(quantilesTDigest(0.50, 0.90, 0.95, 0.99)(" + memoryUsageKBExpression + ")[1]) AS p50").
		Select("toFloat64(quantilesTDigest(0.50, 0.90, 0.95, 0.99)(" + memoryUsageKBExpression + ")[2]) AS p90").
		Select("toFloat64(quantilesTDigest(0.50, 0.90, 0.95, 0.99)(" + memoryUsageKBExpression + ")[3]) AS p95").
		Select("toFloat64(quantilesTDigest(0.50, 0.90, 0.95, 0.99)(" + memoryUsageKBExpression + ")[4]) AS p99").
		Select("count() AS sample_count").
		GroupBy("device_total_memory_tier, datetime_bucket").
		OrderBy("datetime_bucket")
	defer stmt.Close()

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var point MemoryUsagePlotPoint
		var bucket time.Time
		if err := rows.Scan(&point.DeviceTotalMemoryTier, &bucket, &point.DateTime, &point.P50, &point.P90, &point.P95, &point.P99, &point.SampleCount); err != nil {
			return nil, err
		}
		points = append(points, point)
	}
	return points, rows.Err()
}

// GetMemoryUsageDistribution returns the
// distribution of individual memory samples.
func (a App) GetMemoryUsageDistribution(ctx context.Context, rch driver.Conn, flt *filter.Filter, appImportance string) (points []MemoryUsageDistributionPoint, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	if err := validateMemoryUsageQuery(flt, appImportance); err != nil {
		return nil, err
	}

	var filteredSessions *sqlf.Stmt
	if flt.HasFilterExpr() {
		filteredSessions, err = a.memoryFilteredSessions(flt)
		if err != nil {
			return nil, err
		}
	}
	const bucketSizeKB = 100 * 1024
	bucketExpr := "least(intDiv(toUInt64(" + memoryUsageKBExpression + "), ?), 9)"
	stmt := memoryUsageEvents(filteredSessions, a, flt, appImportance).
		Select(bucketExpr+" AS bucket", bucketSizeKB).
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

// GetHighMemoryUsageSessions returns sessions whose P90 memory usage is above
// the configured threshold and that overlap the date range.
func (a App) GetHighMemoryUsageSessions(ctx context.Context, rch driver.Conn, flt *filter.Filter, appImportance string) (sessions []HighMemoryUsageSession, next, previous bool, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	if err := validateMemoryAppImportance(appImportance); err != nil {
		return nil, false, false, err
	}

	base, err := a.memoryFilteredSessions(flt)
	if err != nil {
		return nil, false, false, err
	}
	deviceMemory := "s.device_total_memory"
	threshold := memoryThresholdExpression(deviceMemory, appImportance)
	stmt := sqlf.With("session_rows", base).
		From("events AS e").
		Join("session_rows AS s", "e.session_id = s.session_id").
		Select("s.session_id").
		Select("tupleElement(s.app_version, 1) AS app_version_major").
		Select("tupleElement(s.app_version, 2) AS app_version_minor").
		Select("tupleElement(s.os_version, 1) AS os_version_major").
		Select("tupleElement(s.os_version, 2) AS os_version_minor").
		Select("s.device_name").
		Select("s.device_model").
		Select("s.device_manufacturer").
		Select("s.start_time").
		Select("s.end_time").
		Select("toFloat64(quantileTDigest(0.90)("+memoryUsageKBExpression+")) AS p90_memory_kb").
		Select(deviceMemory+" AS device_total_memory").
		Select(threshold+" AS target_memory_kb").
		Select("toFloat64(p90_memory_kb) * 100 / target_memory_kb AS percent_of_target").
		Where("e.team_id = toUUID(?)", a.TeamId).
		Where("e.app_id = toUUID(?)", a.ID).
		Where("e.type = 'memory_usage'").
		Where("e.timestamp >= ? AND e.timestamp <= ?", flt.From, flt.To).
		Where("(e.attribute.app_version, e.attribute.app_build) IN (SELECT app_version FROM session_rows)").
		Where(memoryUsageKBExpression + " > 0").
		GroupBy("s.session_id").
		GroupBy("s.app_version").
		GroupBy("s.os_version").
		GroupBy("s.device_name").
		GroupBy("s.device_model").
		GroupBy("s.device_manufacturer").
		GroupBy("s.start_time").
		GroupBy("s.end_time").
		GroupBy("s.device_total_memory").
		Having("target_memory_kb > 0").
		Having("p90_memory_kb > target_memory_kb").
		OrderBy("percent_of_target DESC").
		OrderBy("end_time DESC").
		OrderBy("s.session_id DESC")
	applyMemoryAppImportance(stmt, appImportance)

	defer stmt.Close()
	if flt.Limit > 0 {
		stmt.Limit(uint64(flt.Limit) + 1)
	}
	if flt.Offset >= 0 {
		stmt.Offset(uint64(flt.Offset))
	}

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, false, false, err
	}
	defer rows.Close()
	for rows.Next() {
		var session HighMemoryUsageSession
		var p90Memory float64
		session.AppID = flt.AppID
		session.Attribute = new(event.Attribute)
		if err := rows.Scan(&session.SessionID, &session.Attribute.AppVersion, &session.Attribute.AppBuild, &session.Attribute.OSName, &session.Attribute.OSVersion, &session.Attribute.DeviceName, &session.Attribute.DeviceModel, &session.Attribute.DeviceManufacturer, &session.FirstEventTime, &session.LastEventTime, &p90Memory, &session.Attribute.DeviceTotalMemory, &session.TargetMemoryKB, &session.PercentOfTarget); err != nil {
			return nil, false, false, err
		}
		session.P90MemoryKB = uint64(math.Round(p90Memory))
		sessions = append(sessions, session)
	}
	if err := rows.Err(); err != nil {
		return nil, false, false, err
	}
	if len(sessions) > flt.Limit {
		sessions = sessions[:len(sessions)-1]
		next = true
	}
	return sessions, next, flt.Offset > 0, nil
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
		Select("os_version").
		Select("device_name").
		Select("device_model").
		Select("device_manufacturer").
		Select("min(first_event_timestamp) AS group_start_time").
		Select("max(last_event_timestamp) AS group_end_time").
		Select("max(device_total_memory) AS session_device_total_memory").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("last_event_timestamp >= ? AND first_event_timestamp <= ?", flt.From, flt.To)
	if flt.HasFilterExpr() {
		if err := applySessionsPredicate(stmt, flt); err != nil {
			stmt.Close()
			return nil, err
		}
	}
	stmt.
		GroupBy("session_id").
		GroupBy("app_version").
		GroupBy("os_version").
		GroupBy("device_name").
		GroupBy("device_model").
		GroupBy("device_manufacturer")

	return sqlf.With("session_groups", stmt).
		From("session_groups").
		Select("session_id").
		Select("argMax(app_version, group_end_time) AS app_version").
		Select("argMax(os_version, group_end_time) AS os_version").
		Select("argMax(device_name, group_end_time) AS device_name").
		Select("argMax(device_model, group_end_time) AS device_model").
		Select("argMax(device_manufacturer, group_end_time) AS device_manufacturer").
		Select("min(group_start_time) AS start_time").
		Select("max(group_end_time) AS end_time").
		Select("max(session_device_total_memory) AS device_total_memory").
		GroupBy("session_id"), nil
}

func memoryUsageEvents(filteredSessions *sqlf.Stmt, a App, flt *filter.Filter, appImportance string) *sqlf.Stmt {
	stmt := sqlf.From("events AS e").
		Where("e.team_id = toUUID(?)", a.TeamId).
		Where("e.app_id = toUUID(?)", a.ID).
		Where("e.type = 'memory_usage'").
		Where("e.timestamp >= ? AND e.timestamp <= ?", flt.From, flt.To)
	if filteredSessions != nil {
		stmt.With("filtered_sessions", filteredSessions).
			Join("filtered_sessions AS s", "e.session_id = s.session_id").
			Where("(e.attribute.app_version, e.attribute.app_build) IN (SELECT app_version FROM filtered_sessions)")
	}
	stmt.
		Where(memoryUsageKBExpression + " > 0")
	applyMemoryAppImportance(stmt, appImportance)
	return stmt
}

func applyMemoryAppImportance(stmt *sqlf.Stmt, appImportance string) {
	switch appImportance {
	case "foreground":
		stmt.Where("(e.memory_usage.app_importance = '' OR e.memory_usage.app_importance = ?)", appImportance)
	case "user_service", "background":
		stmt.Where("e.memory_usage.app_importance = ?", appImportance)
	}
}

func memoryTierExpression(column string) string {
	return "multiIf(" + column + " = 0, 'unknown', " +
		column + " > 0 AND " + column + " < 5242880, '0-4gb', " +
		column + " < 7340032, '5-6gb', " +
		column + " < 9437184, '7-8gb', " +
		column + " < 13631488, '9-12gb', " +
		column + " < 16777216, '13-16gb', " +
		column + " < 33554432, '16-32gb', " +
		"'32gb+')"
}

func validateMemoryUsageQuery(flt *filter.Filter, appImportance string) error {
	if flt.Timezone == "" {
		return errors.New("missing timezone filter")
	}
	return validateMemoryAppImportance(appImportance)
}

func validateMemoryAppImportance(appImportance string) error {
	if !validMemoryAppImportance(appImportance) {
		return ErrInvalidMemoryAppImportance
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
