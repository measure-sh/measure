package measure

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"backend/libs/chquery"
	"backend/libs/devicememory"
	"backend/libs/event"
	"backend/libs/filter"
	"backend/libs/opsys"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"github.com/leporo/sqlf"
	"go.opentelemetry.io/otel"
)

var tracer = otel.Tracer("measure")

// MemoryUsagePlotPoint contains sample
// percentiles in KB.
type MemoryUsagePlotPoint struct {
	Version     string   `json:"version"`
	DateTime    string   `json:"datetime"`
	P50         *float64 `json:"p50"`
	P90         *float64 `json:"p90"`
	P95         *float64 `json:"p95"`
	P99         *float64 `json:"p99"`
	SampleCount uint64   `json:"sample_count"`
}

// MemoryUsageBreakdownRow contains sample
// percentiles in KB for one device memory
// tier.
type MemoryUsageBreakdownRow struct {
	DeviceTotalMemoryTier string   `json:"device_total_memory_tier"`
	P50                   *float64 `json:"p50"`
	P90                   *float64 `json:"p90"`
	P95                   *float64 `json:"p95"`
	SessionCount          uint64   `json:"session_count"`
	SampleCount           uint64   `json:"sample_count"`
}

// HighMemoryUsageSession contains sessions with
// high peak memory usage.
type HighMemoryUsageSession struct {
	SessionID                          uuid.UUID        `json:"session_id"`
	AppID                              uuid.UUID        `json:"app_id"`
	Attribute                          *event.Attribute `json:"attribute"`
	FirstEventTime                     *time.Time       `json:"first_event_time"`
	LastEventTime                      *time.Time       `json:"last_event_time"`
	PeakMemoryKB                       uint64           `json:"peak_memory_kb"`
	TargetMemoryKB                     *uint64          `json:"target_memory_kb,omitempty"`
	PercentOfTarget                    *float64         `json:"percent_of_target,omitempty"`
	PeakMemoryLimitUtilization         *float64         `json:"peak_memory_limit_utilization,omitempty"`           // iOS ratio, 0–1.
	AvailableMemoryAtPeakUtilizationKB *uint64          `json:"available_memory_at_peak_utilization_kb,omitempty"` // iOS available memory at the sample with peak utilization.
}

// memorySource contains the platform-specific
// event used for memory monitoring.
type memorySource struct {
	eventType      string
	usageKB        string
	deviceMemoryKB string
}

type androidMemoryTarget struct {
	foreground  uint64
	userService uint64
	background  uint64
}

const (
	memoryKBPerGB                  uint64 = 1024 * 1024
	highMemoryUtilizationThreshold        = 0.75
)

// Android app memory targets in KiB
// by device memory tier.
//
// frontend/dashboard/app/sandbox/device_memory.ts
// keeps a copy.
var androidMemoryTargets = map[string]androidMemoryTarget{
	"0-4gb":   {2 * memoryKBPerGB, memoryKBPerGB, memoryKBPerGB},
	"5-6gb":   {9 * memoryKBPerGB / 4, 5 * memoryKBPerGB / 4, 5 * memoryKBPerGB / 4},
	"7-8gb":   {9 * memoryKBPerGB / 4, 3 * memoryKBPerGB / 2, 3 * memoryKBPerGB / 2},
	"9-12gb":  {13 * memoryKBPerGB / 4, 7 * memoryKBPerGB / 4, 7 * memoryKBPerGB / 4},
	"13-16gb": {17 * memoryKBPerGB / 4, 2 * memoryKBPerGB, 2 * memoryKBPerGB},
	"17-32gb": {6 * memoryKBPerGB, 4 * memoryKBPerGB, 4 * memoryKBPerGB},
	"33gb+":   {10 * memoryKBPerGB, 6 * memoryKBPerGB, 6 * memoryKBPerGB},
}

func (a App) memorySource() (memorySource, bool) {
	switch a.Family() {
	case opsys.Android:
		return memorySource{
			eventType:      event.TypeMemoryUsage,
			usageKB:        "`memory_usage.anon_rss` + `memory_usage.swap`",
			deviceMemoryKB: "`attribute.device_total_memory`",
		}, true
	case opsys.AppleFamily:
		return memorySource{
			eventType:      event.TypeMemoryUsageAbs,
			usageKB:        "`memory_usage_absolute.used_memory`",
			deviceMemoryKB: "`memory_usage_absolute.max_memory`",
		}, true
	default:
		return memorySource{}, false
	}
}

func (a App) memorySessions(flt *filter.Filter) *sqlf.Stmt {
	stmt := sqlf.From("sessions").
		Select("session_id").
		Select("app_version").
		Select("os_version").
		Select("device_name").
		Select("device_model").
		Select("device_manufacturer").
		Select("min(first_event_timestamp) AS group_start_time").
		Select("max(last_event_timestamp) AS group_end_time").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("last_event_timestamp >= ? AND first_event_timestamp <= ?", flt.From, flt.To).
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
		GroupBy("session_id")
}

func memoryUsageEvents(a App, flt *filter.Filter, source memorySource) (*sqlf.Stmt, error) {
	stmt := sqlf.From("events").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("type = ?", source.eventType).
		Where("timestamp >= ? AND timestamp <= ?", flt.From, flt.To).
		Where(source.usageKB + " > 0")
	if err := applyMemoryPredicate(stmt, flt); err != nil {
		stmt.Close()
		return nil, err
	}
	return stmt, nil
}

// applyMemoryPredicate adds the filter expression to a memory events query.
func applyMemoryPredicate(stmt *sqlf.Stmt, flt *filter.Filter) error {
	if !flt.HasFilterExpr() {
		return nil
	}

	predicate, err := flt.Predicate(nil)
	if err != nil {
		return err
	}
	defer predicate.Close()

	stmt.Where(predicate.String(), predicate.Args()...)
	return nil
}

// GetMemoryUsagePlot returns percentiles of
// memory usage samples grouped by time interval
// and app version/build, across device memory tiers.
func (a App) GetMemoryUsagePlot(ctx context.Context, rch driver.Conn, flt *filter.Filter) (points []MemoryUsagePlotPoint, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	if flt.Timezone == "" {
		return nil, errors.New("missing timezone filter")
	}
	source, ok := a.memorySource()
	if !ok {
		return []MemoryUsagePlotPoint{}, nil
	}

	flt.SetDefaultPlotTimeGroupIfUnset()
	groupExpr, err := GetPlotTimeGroupExpr("timestamp", flt.PlotTimeGroup)
	if err != nil {
		return nil, err
	}

	stmt, err := memoryUsageEvents(a, flt, source)
	if err != nil {
		return nil, err
	}
	stmt.
		Select("concat(`attribute.app_version`, ' (', `attribute.app_build`, ')') AS version").
		Select(groupExpr.BucketExpr+" AS datetime_bucket", flt.Timezone).
		Select("formatDateTime(datetime_bucket, ?) AS datetime", groupExpr.DatetimeFormat).
		Select("CAST(quantilesTDigest(0.50, 0.90, 0.95, 0.99)(" + source.usageKB + ") AS Array(Float64)) AS quantiles").
		Select("count() AS sample_count").
		GroupBy("`attribute.app_version`, `attribute.app_build`, datetime_bucket").
		OrderBy("datetime_bucket, `attribute.app_build` DESC, `attribute.app_version`")
	defer stmt.Close()

	ctx, querySpan := tracer.Start(ctx, "memory.usage_plot")
	defer querySpan.End()

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var point MemoryUsagePlotPoint
		var bucket time.Time
		var quantiles []float64
		if err := rows.Scan(&point.Version, &bucket, &point.DateTime, &quantiles, &point.SampleCount); err != nil {
			return nil, err
		}
		if len(quantiles) == 4 {
			point.P50, point.P90 = &quantiles[0], &quantiles[1]
			point.P95, point.P99 = &quantiles[2], &quantiles[3]
		}
		points = append(points, point)
	}
	return points, rows.Err()
}

// GetMemoryUsageBreakdown returns percentiles of individual samples grouped by
// device memory tier over the entire selected date range.
func (a App) GetMemoryUsageBreakdown(ctx context.Context, rch driver.Conn, flt *filter.Filter) (breakdown []MemoryUsageBreakdownRow, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	source, ok := a.memorySource()
	if !ok {
		return []MemoryUsageBreakdownRow{}, nil
	}
	tierPredicates := devicememory.Predicates(source.deviceMemoryKB)
	tierCases := make([]string, 0, 2*len(devicememory.Tiers)+1)
	for _, tier := range devicememory.Tiers {
		tierCases = append(tierCases, tierPredicates[tier.Name], "'"+tier.Name+"'")
	}
	tierCases = append(tierCases, "'"+devicememory.Unknown+"'")
	tierExpr := "multiIf(" + strings.Join(tierCases, ", ") + ")"

	// Keep breakdown rows in ascending device-memory order.
	tierNames := devicememory.Names()
	quoted := make([]string, 0, len(tierNames))
	for _, name := range tierNames {
		quoted = append(quoted, "'"+name+"'")
	}
	tierOrder := "indexOf([" + strings.Join(quoted, ", ") + "], device_total_memory_tier)"
	stmt, err := memoryUsageEvents(a, flt, source)
	if err != nil {
		return nil, err
	}
	stmt.
		Select(tierExpr + " AS device_total_memory_tier").
		Select("CAST(quantilesTDigest(0.50, 0.90, 0.95)(" + source.usageKB + ") AS Array(Float64)) AS quantiles").
		Select("uniqExact(session_id) AS session_count").
		Select("count() AS sample_count").
		GroupBy("device_total_memory_tier").
		OrderBy(tierOrder)
	defer stmt.Close()

	ctx, querySpan := tracer.Start(ctx, "memory.usage_breakdown")
	defer querySpan.End()

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var row MemoryUsageBreakdownRow
		var quantiles []float64
		if err := rows.Scan(&row.DeviceTotalMemoryTier, &quantiles, &row.SessionCount, &row.SampleCount); err != nil {
			return nil, err
		}
		if len(quantiles) == 3 {
			row.P50, row.P90, row.P95 = &quantiles[0], &quantiles[1], &quantiles[2]
		}
		breakdown = append(breakdown, row)
	}
	return breakdown, rows.Err()
}

// GetHighMemoryUsageSessions selects Android sessions
// with peak usage at or above 75% of their target and
// iOS sessions with peak process-limit utilization
// of at least 75%.
func (a App) GetHighMemoryUsageSessions(ctx context.Context, rch driver.Conn, flt *filter.Filter) (sessions []HighMemoryUsageSession, next, previous bool, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	source, ok := a.memorySource()
	if !ok {
		return []HighMemoryUsageSession{}, false, false, nil
	}

	isIOS := source.eventType == event.TypeMemoryUsageAbs

	// Reduce samples to one row per session
	// before attaching metadata.
	memory, err := memoryUsageEvents(a, flt, source)
	if err != nil {
		return nil, false, false, err
	}
	memory.
		Select("session_id").
		Select("max(" + source.deviceMemoryKB + ") AS device_total_memory").
		GroupBy("session_id")
	if isIOS {
		// Convert before adding: UInt64 footprint + available memory could overflow.
		// A missing or zero headroom reading means the process limit is unknown, so
		// those samples cannot produce a utilization figure.
		usage := "toFloat64(" + source.usageKB + ")"
		available := "`memory_usage_absolute.available_memory`"
		utilization := usage + " / (" + usage + " + toFloat64(" + available + "))"
		memory.Select("max("+source.usageKB+") AS peak_memory_kb").
			Select("max("+utilization+") AS peak_memory_limit_utilization").
			Select("argMax("+available+", tuple("+utilization+", timestamp)) AS available_memory_at_peak_utilization_kb").
			Where(available+" > 0").
			Having("peak_memory_limit_utilization >= ?", highMemoryUtilizationThreshold)
	} else {
		target := androidMemoryTargetKB(source.deviceMemoryKB)
		percent := "toFloat64(" + source.usageKB + ") * 100 / " + target
		memory.Select("max("+percent+") AS percent_of_target").
			Select("argMax("+source.usageKB+", "+percent+") AS peak_memory_kb").
			Select("argMax("+target+", "+percent+") AS target_memory_kb").
			Where(target+" > 0").
			Having("percent_of_target >= ?", highMemoryUtilizationThreshold*100)
	}

	stmt := sqlf.With("memory_sessions", a.memorySessions(flt)).
		With("session_memory", memory).
		From("session_memory AS m").
		Join("memory_sessions AS s", "m.session_id = s.session_id").
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
		Select("m.peak_memory_kb AS peak_memory_kb").
		Select("m.device_total_memory AS device_total_memory")
	if isIOS {
		stmt.Select("CAST(NULL AS Nullable(UInt64)) AS target_memory_kb").
			Select("CAST(NULL AS Nullable(Float64)) AS percent_of_target").
			Select("m.peak_memory_limit_utilization AS peak_memory_limit_utilization").
			Select("m.available_memory_at_peak_utilization_kb AS available_memory_at_peak_utilization_kb").
			OrderBy("peak_memory_limit_utilization DESC")
	} else {
		stmt.Select("m.target_memory_kb AS target_memory_kb").
			Select("m.percent_of_target AS percent_of_target").
			Select("CAST(NULL AS Nullable(Float64)) AS peak_memory_limit_utilization").
			Select("CAST(NULL AS Nullable(UInt64)) AS available_memory_at_peak_utilization_kb").
			OrderBy("percent_of_target DESC")
	}
	stmt.OrderBy("end_time DESC").OrderBy("s.session_id DESC")

	defer stmt.Close()
	if flt.Limit > 0 {
		stmt.Limit(uint64(flt.Limit) + 1)
	}
	if flt.Offset >= 0 {
		stmt.Offset(uint64(flt.Offset))
	}

	ctx, querySpan := tracer.Start(ctx, "memory.high_usage_sessions")
	defer querySpan.End()

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, false, false, err
	}
	defer rows.Close()
	for rows.Next() {
		var session HighMemoryUsageSession
		session.AppID = flt.AppID
		session.Attribute = new(event.Attribute)
		if err := rows.Scan(&session.SessionID, &session.Attribute.AppVersion, &session.Attribute.AppBuild, &session.Attribute.OSName, &session.Attribute.OSVersion, &session.Attribute.DeviceName, &session.Attribute.DeviceModel, &session.Attribute.DeviceManufacturer, &session.FirstEventTime, &session.LastEventTime, &session.PeakMemoryKB, &session.Attribute.DeviceTotalMemory, &session.TargetMemoryKB, &session.PercentOfTarget, &session.PeakMemoryLimitUtilization, &session.AvailableMemoryAtPeakUtilizationKB); err != nil {
			return nil, false, false, err
		}
		sessions = append(sessions, session)
	}
	if err := rows.Err(); err != nil {
		return nil, false, false, err
	}
	if flt.Limit > 0 && len(sessions) > flt.Limit {
		sessions = sessions[:len(sessions)-1]
		next = true
	}
	return sessions, next, flt.Offset > 0, nil
}

// androidMemoryTargetKB is the memory target in KiB for the device
// memory tier and app importance, 0 when device memory is unknown.
func androidMemoryTargetKB(deviceMemoryKB string) string {
	importance := "`memory_usage.app_importance`"
	tierPredicates := devicememory.Predicates(deviceMemoryKB)
	cases := make([]string, 0, 2*len(devicememory.Tiers)+1)
	for _, tier := range devicememory.Tiers {
		target := androidMemoryTargets[tier.Name]
		targetByImportance := fmt.Sprintf("multiIf(%s = 'user_service', %d, %s = 'background', %d, %d)",
			importance, target.userService, importance, target.background, target.foreground)
		cases = append(cases, tierPredicates[tier.Name], targetByImportance)
	}
	cases = append(cases, "0")
	return "toUInt64(multiIf(" + strings.Join(cases, ", ") + "))"
}
