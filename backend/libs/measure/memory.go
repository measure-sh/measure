package measure

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"backend/libs/chquery"
	"backend/libs/event"
	"backend/libs/filter"
	"backend/libs/opsys"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

// MemoryUsagePlotPoint contains sample percentiles in KB (1024 bytes), grouped
// by time bucket and app version/build across device memory tiers.
type MemoryUsagePlotPoint struct {
	Version     string   `json:"version"`
	DateTime    string   `json:"datetime"`
	P50         *float64 `json:"p50"`
	P90         *float64 `json:"p90"`
	P95         *float64 `json:"p95"`
	P99         *float64 `json:"p99"`
	SampleCount uint64   `json:"sample_count"`
}

// MemoryUsageBreakdownRow contains sample percentiles in KB (1024 bytes) over
// the entire selected date range for one device memory tier.
type MemoryUsageBreakdownRow struct {
	DeviceTotalMemoryTier string   `json:"device_total_memory_tier"`
	P50                   *float64 `json:"p50"`
	P90                   *float64 `json:"p90"`
	P95                   *float64 `json:"p95"`
	SessionCount          uint64   `json:"session_count"`
	SampleCount           uint64   `json:"sample_count"`
}

// HighMemoryUsageSession describes peak high usage: Android uses a RAM-tier
// target, while iOS uses the maximum per-sample process-limit utilization.
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

const memoryKBPerGB uint64 = 1024 * 1024

// KSCrash classifies footprint / (footprint + available memory) >= 0.75 as critical.
// Use the same warning ratio for Android RAM-tier targets.
// These are monitoring heuristics, not OS guarantees of termination.
// https://github.com/kstenerud/KSCrash/blob/8649e0727ef4506f3cf910453eb0f2481321e8ab/Sources/KSCrashRecording/KSCrashAppMemory.m#L32-L39
const highMemoryUtilizationThreshold = 0.75

// memorySource contains the platform-specific fields shared by all memory queries.
type memorySource struct {
	eventType      string
	usageKB        string
	deviceMemoryKB string
}

func (a App) memorySource() (memorySource, bool) {
	switch a.Family() {
	case opsys.Android:
		return memorySource{
			eventType:      event.TypeMemoryUsage,
			usageKB:        "e.memory_usage.anon_rss + e.memory_usage.swap",
			deviceMemoryKB: "e.attribute.device_total_memory",
		}, true
	case opsys.AppleFamily:
		return memorySource{
			eventType:      event.TypeMemoryUsageAbs,
			usageKB:        "e.memory_usage_absolute.used_memory",
			deviceMemoryKB: "e.memory_usage_absolute.max_memory",
		}, true
	default:
		return memorySource{}, false
	}
}

var ErrInvalidMemoryAppImportance = errors.New("invalid app importance")

type androidMemoryTarget struct {
	foreground  uint64
	userService uint64
	background  uint64
}

// Android app memory targets in KiB, keyed by the shared device RAM tiers.
// Range boundaries come from filter.DeviceMemoryRanges, as they do for the
// session filter and memory breakdown.
var androidMemoryTargets = map[string]androidMemoryTarget{
	"0-4gb":   {2 * memoryKBPerGB, memoryKBPerGB, memoryKBPerGB},
	"5-6gb":   {9 * memoryKBPerGB / 4, 5 * memoryKBPerGB / 4, 5 * memoryKBPerGB / 4},
	"7-8gb":   {9 * memoryKBPerGB / 4, 3 * memoryKBPerGB / 2, 3 * memoryKBPerGB / 2},
	"9-12gb":  {13 * memoryKBPerGB / 4, 7 * memoryKBPerGB / 4, 7 * memoryKBPerGB / 4},
	"13-16gb": {17 * memoryKBPerGB / 4, 2 * memoryKBPerGB, 2 * memoryKBPerGB},
	"17-32gb": {6 * memoryKBPerGB, 4 * memoryKBPerGB, 4 * memoryKBPerGB},
	"33gb+":   {10 * memoryKBPerGB, 6 * memoryKBPerGB, 6 * memoryKBPerGB},
}

func androidMemoryTargetExpression(deviceMemory, appImportance string) string {
	var targetKB func(androidMemoryTarget) uint64
	switch appImportance {
	case "user_service":
		targetKB = func(target androidMemoryTarget) uint64 { return target.userService }
	case "background":
		targetKB = func(target androidMemoryTarget) uint64 { return target.background }
	default:
		targetKB = func(target androidMemoryTarget) uint64 { return target.foreground }
	}

	parts := make([]string, 0, len(filter.DeviceMemoryRanges)*2+1)
	for _, r := range filter.DeviceMemoryRanges {
		condition := fmt.Sprintf("%s >= %d", deviceMemory, r.LowerKB)
		if r.LowerKB == 0 {
			condition = fmt.Sprintf("%s > 0", deviceMemory)
		}
		if r.UpperKB != 0 {
			condition += fmt.Sprintf(" AND %s < %d", deviceMemory, r.UpperKB)
		}
		parts = append(parts, fmt.Sprintf("%s, %d", condition, targetKB(androidMemoryTargets[r.Name])))
	}
	parts = append(parts, "0")
	return "toUInt64(multiIf(" + strings.Join(parts, ", ") + "))"
}

// GetMemoryUsagePlot returns percentiles
// of memory usage samples grouped by
// time interval and app version/build, across device memory tiers.
func (a App) GetMemoryUsagePlot(ctx context.Context, rch driver.Conn, flt *filter.Filter, appImportance string) (points []MemoryUsagePlotPoint, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	if flt.Timezone == "" {
		return nil, errors.New("missing timezone filter")
	}
	appImportance, err = a.resolveMemoryAppImportance(appImportance)
	if err != nil {
		return nil, err
	}
	source, ok := a.memorySource()
	if !ok {
		return []MemoryUsagePlotPoint{}, nil
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
	stmt := memoryUsageEvents(filteredSessions, a, flt, source, appImportance).
		Select("concat(e.attribute.app_version, ' (', e.attribute.app_build, ')') AS version").
		Select(groupExpr.BucketExpr+" AS datetime_bucket", flt.Timezone).
		Select("formatDateTime(datetime_bucket, ?) AS datetime", groupExpr.DatetimeFormat).
		Select("toFloat64(quantilesTDigest(0.50, 0.90, 0.95, 0.99)(" + source.usageKB + ")[1]) AS p50").
		Select("toFloat64(quantilesTDigest(0.50, 0.90, 0.95, 0.99)(" + source.usageKB + ")[2]) AS p90").
		Select("toFloat64(quantilesTDigest(0.50, 0.90, 0.95, 0.99)(" + source.usageKB + ")[3]) AS p95").
		Select("toFloat64(quantilesTDigest(0.50, 0.90, 0.95, 0.99)(" + source.usageKB + ")[4]) AS p99").
		Select("count() AS sample_count").
		GroupBy("e.attribute.app_version, e.attribute.app_build, datetime_bucket").
		OrderBy("datetime_bucket, e.attribute.app_build DESC, e.attribute.app_version")
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

// GetMemoryUsageBreakdown returns percentiles of individual samples grouped by
// device memory tier over the entire selected date range.
func (a App) GetMemoryUsageBreakdown(ctx context.Context, rch driver.Conn, flt *filter.Filter, appImportance string) (breakdown []MemoryUsageBreakdownRow, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	if flt.Timezone == "" {
		return nil, errors.New("missing timezone filter")
	}
	appImportance, err = a.resolveMemoryAppImportance(appImportance)
	if err != nil {
		return nil, err
	}
	source, ok := a.memorySource()
	if !ok {
		return []MemoryUsageBreakdownRow{}, nil
	}
	var filteredSessions *sqlf.Stmt
	if flt.HasFilterExpr() {
		filteredSessions, err = a.memoryFilteredSessions(flt)
		if err != nil {
			return nil, err
		}
	}
	tierExpr := memoryTierExpression(source.deviceMemoryKB)
	stmt := memoryUsageEvents(filteredSessions, a, flt, source, appImportance).
		Select(tierExpr + " AS device_total_memory_tier").
		Select("toFloat64(quantilesTDigest(0.50, 0.90, 0.95)(" + source.usageKB + ")[1]) AS p50").
		Select("toFloat64(quantilesTDigest(0.50, 0.90, 0.95)(" + source.usageKB + ")[2]) AS p90").
		Select("toFloat64(quantilesTDigest(0.50, 0.90, 0.95)(" + source.usageKB + ")[3]) AS p95").
		Select("uniqExact(e.session_id) AS session_count").
		Select("count() AS sample_count").
		GroupBy("device_total_memory_tier").
		OrderBy(memoryTierOrderExpression("device_total_memory_tier"))
	defer stmt.Close()

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var row MemoryUsageBreakdownRow
		if err := rows.Scan(&row.DeviceTotalMemoryTier, &row.P50, &row.P90, &row.P95, &row.SessionCount, &row.SampleCount); err != nil {
			return nil, err
		}
		breakdown = append(breakdown, row)
	}
	return breakdown, rows.Err()
}

// GetHighMemoryUsageSessions selects Android sessions with peak usage at or above 75% of their RAM-tier target
// and iOS sessions with peak process-limit utilization of at least 75%.
func (a App) GetHighMemoryUsageSessions(ctx context.Context, rch driver.Conn, flt *filter.Filter, appImportance string) (sessions []HighMemoryUsageSession, next, previous bool, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	appImportance, err = a.resolveMemoryAppImportance(appImportance)
	if err != nil {
		return nil, false, false, err
	}
	source, ok := a.memorySource()
	if !ok {
		return []HighMemoryUsageSession{}, false, false, nil
	}

	base, err := a.memoryFilteredSessions(flt)
	if err != nil {
		return nil, false, false, err
	}
	isIOS := source.eventType == event.TypeMemoryUsageAbs
	// Reduce samples to one row per session before attaching display metadata.
	// Joining first repeats that metadata for every sample and makes the
	// aggregation carry a much wider grouping key.
	//
	// Restrict to the filtered sessions here rather than leaning on the join.
	// The join drops unwanted sessions only after a peak has been
	// computed for every session in the app. The version predicate stays
	// alongside it for pruning, since version/build precede time in the
	// events key while session_id follows it.
	memory := memoryUsageEvents(nil, a, flt, source, appImportance).
		Select("e.session_id").
		Select("max(" + source.usageKB + ") AS peak_memory_kb").
		Where("e.session_id IN (SELECT session_id FROM session_rows)").
		Where("(e.attribute.app_version, e.attribute.app_build) IN (SELECT app_version FROM session_rows)").
		GroupBy("e.session_id")
	if isIOS {
		// Convert before adding: UInt64 footprint + available memory could overflow.
		// Missing available memory must not be interpreted as an exhausted budget (zero).
		usage := "toFloat64(" + source.usageKB + ")"
		available := "e.memory_usage_absolute.available_memory"
		utilization := usage + " / (" + usage + " + toFloat64(" + available + "))"
		memory.Select("max("+source.deviceMemoryKB+") AS device_total_memory").
			Select("max("+utilization+") AS peak_memory_limit_utilization").
			Select("argMax("+available+", tuple("+utilization+", e.timestamp)) AS available_memory_at_peak_utilization_kb").
			Where(available+" IS NOT NULL").
			Having("peak_memory_limit_utilization >= ?", highMemoryUtilizationThreshold)
	}

	deviceMemory := "s.device_total_memory"
	if isIOS {
		// Older iOS SDKs did not populate the shared device-memory attribute.
		// RAM is display context only; iOS selection uses available app memory.
		deviceMemory = "m.device_total_memory"
	}
	stmt := sqlf.With("session_rows", base).
		With("session_memory", memory).
		From("session_memory AS m").
		Join("session_rows AS s", "m.session_id = s.session_id").
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
		Select(deviceMemory + " AS device_total_memory")
	if isIOS {
		stmt.Select("CAST(NULL AS Nullable(UInt64)) AS target_memory_kb").
			Select("CAST(NULL AS Nullable(Float64)) AS percent_of_target").
			Select("m.peak_memory_limit_utilization AS peak_memory_limit_utilization").
			Select("m.available_memory_at_peak_utilization_kb AS available_memory_at_peak_utilization_kb").
			OrderBy("peak_memory_limit_utilization DESC")
	} else {
		target := androidMemoryTargetExpression(deviceMemory, appImportance)
		stmt.Select(target+" AS target_memory_kb").
			Select("toFloat64(peak_memory_kb) * 100 / target_memory_kb AS percent_of_target").
			Select("CAST(NULL AS Nullable(Float64)) AS peak_memory_limit_utilization").
			Select("CAST(NULL AS Nullable(UInt64)) AS available_memory_at_peak_utilization_kb").
			Where("target_memory_kb > 0").
			Where("percent_of_target >= ?", highMemoryUtilizationThreshold*100).
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

func memoryUsageEvents(filteredSessions *sqlf.Stmt, a App, flt *filter.Filter, source memorySource, appImportance string) *sqlf.Stmt {
	stmt := sqlf.From("events AS e").
		Where("e.team_id = toUUID(?)", a.TeamId).
		Where("e.app_id = toUUID(?)", a.ID).
		Where("e.type = ?", source.eventType).
		Where("e.timestamp >= ? AND e.timestamp <= ?", flt.From, flt.To)
	if filteredSessions != nil {
		// Charts only need session membership, not a join carrying session rows.
		// Keep the version predicate: version/build precede time in the events key.
		stmt.With("filtered_sessions", filteredSessions).
			Where("e.session_id IN (SELECT session_id FROM filtered_sessions)").
			Where("(e.attribute.app_version, e.attribute.app_build) IN (SELECT app_version FROM filtered_sessions)")
	}
	stmt.
		Where(source.usageKB + " > 0")
	if source.eventType == event.TypeMemoryUsage {
		applyMemoryAppImportance(stmt, appImportance)
	}
	return stmt
}

func applyMemoryAppImportance(stmt *sqlf.Stmt, appImportance string) {
	switch appImportance {
	case "foreground":
		// Older Android SDKs omitted the event's state label.
		stmt.Where("(e.memory_usage.app_importance = '' OR e.memory_usage.app_importance = ?)", appImportance)
	case "user_service", "background":
		stmt.Where("e.memory_usage.app_importance = ?", appImportance)
	}
}

// memoryTierExpression buckets a device memory column into the shared tiers.
// multiIf evaluates its arms in order, so each tier only needs to test its own
// upper bound, and the unbounded tier is the fallback.
func memoryTierExpression(column string) string {
	parts := make([]string, 0, len(filter.DeviceMemoryRanges)+1)
	parts = append(parts, fmt.Sprintf("%s = 0, '%s'", column, filter.DeviceMemoryTierUnknown))
	for i, r := range filter.DeviceMemoryRanges {
		if r.UpperKB == 0 {
			parts = append(parts, fmt.Sprintf("'%s'", r.Name))
			continue
		}
		condition := fmt.Sprintf("%s < %d", column, r.UpperKB)
		if i == 0 {
			condition = fmt.Sprintf("%s > 0 AND %s", column, condition)
		}
		parts = append(parts, fmt.Sprintf("%s, '%s'", condition, r.Name))
	}
	return "multiIf(" + strings.Join(parts, ", ") + ")"
}

// memoryTierOrderExpression sorts breakdown rows by ascending device memory.
// indexOf returns zero for a name absent from the array, so deriving the array
// from the shared tiers keeps a renamed tier from silently sorting first.
func memoryTierOrderExpression(column string) string {
	tiers := filter.DeviceMemoryTiers()
	quoted := make([]string, 0, len(tiers))
	for _, tier := range tiers {
		quoted = append(quoted, "'"+tier+"'")
	}
	return "indexOf([" + strings.Join(quoted, ", ") + "], " + column + ")"
}

// resolveMemoryAppImportance handles the optional filter before query construction.
// Android defaults to foreground; other platforms do not use process-state filters.
func (a App) resolveMemoryAppImportance(value string) (string, error) {
	if a.Family() != opsys.Android {
		return "", nil
	}
	if value == "" {
		return "foreground", nil
	}
	if !validMemoryAppImportance(value) {
		return "", ErrInvalidMemoryAppImportance
	}
	return value, nil
}

func validMemoryAppImportance(value string) bool {
	switch value {
	case "foreground", "user_service", "background":
		return true
	default:
		return false
	}
}
