package measure

import (
	"context"
	"math"
	"time"

	"backend/libs/chquery"
	"backend/libs/exprfilter"
	"backend/libs/logcomment"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

// MemoryScope narrows the memory usage trend to one of the four process
// states Play Console's own Memory usage (Anon RSS + Swap) vital segments
// by. Android only — iOS collection is foreground-only already, so it has
// no other process state to narrow to.
type MemoryScope string

const (
	MemoryScopeAny                  MemoryScope = ""
	MemoryScopeForeground           MemoryScope = "foreground"
	MemoryScopeUserPerceivedService MemoryScope = "user_perceived_service"
	MemoryScopeBackground           MemoryScope = "background"
	MemoryScopeCached               MemoryScope = "cached"
)

// UsageDataPoint is one time bucket of the memory usage trend.
type UsageDataPoint map[string]any

// MemorySessionDisplay is one row of the highest-memory-sessions ranking:
// one session, ranked by its own p90 dynamic memory usage (Android) or
// memory footprint (iOS).
type MemorySessionDisplay struct {
	SessionID          uuid.UUID  `json:"session_id"`
	AppVersion         string     `json:"app_version"`
	AppBuild           string     `json:"app_build"`
	OSName             string     `json:"os_name"`
	OSVersion          string     `json:"os_version"`
	DeviceName         string     `json:"device_name"`
	DeviceModel        string     `json:"device_model"`
	DeviceManufacturer string     `json:"device_manufacturer"`
	DeviceTotalMemory  *uint64    `json:"device_total_memory_kb"`
	StartTime          *time.Time `json:"start_time"`
	// PeakMemoryKB is the session's own p90 across its sampled readings, in KB.
	PeakMemoryKB uint64 `json:"peak_memory_kb"`
	// RAMUsageRatio is PeakMemoryKB as a fraction (0-1) of DeviceTotalMemory
	// — the ranking key, since the raw KB value alone is misleading across
	// devices with different total RAM. 0 when DeviceTotalMemory is unknown.
	RAMUsageRatio float64 `json:"ram_usage_ratio"`
}

// withMemoryQueryName tags a query with its name for the ClickHouse query log.
func withMemoryQueryName(ctx context.Context, name string) context.Context {
	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.MustPut(logcomment.Root, logcomment.Memory).String(),
	}
	return chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, name))
}

// groupBySessionDimensions applies the standard sessions-table grouping key
// shared by every per-session memory query: one row per session, settled by
// the display dimensions GetSessionsWithFilter also groups by.
//
// device_total_memory_kb is deliberately not among them — it's a
// SimpleAggregateFunction(anyLast, ...) column, so it's read via anyLast(...)
// where it's selected, not used as a grouping key (see matchingSessionIDs /
// GetHighestMemorySessions).
func groupBySessionDimensions(stmt *sqlf.Stmt) {
	stmt.
		GroupBy("session_id").
		GroupBy("app_version").
		GroupBy("os_version").
		GroupBy("device_name").
		GroupBy("device_model").
		GroupBy("device_manufacturer")
}

// matchingSessionIDs is a subquery selecting the session_ids that satisfy
// ef's filter, scoped to the app and date range. Used to scope the trend
// query — which reads raw events, not the sessions rollup — to the same
// sessions the shared FilterBar's session-level filters (app version, RAM
// tier, foreground/background activity, ...) would select for the ranked
// list, so both views of the Memory Monitoring tab answer to one filter
// vocabulary (exprfilter.SessionsEntity) instead of two.
func (a App) matchingSessionIDs(ef *exprfilter.ExprFilter) (*sqlf.Stmt, error) {
	sub := sqlf.
		From("sessions").
		Select("session_id").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("first_event_timestamp >= ? and last_event_timestamp <= ?", ef.From, ef.To)

	if ef.HasFilterExpr() {
		if err := applySessionsPredicate(sub, ef); err != nil {
			return nil, err
		}
	}

	groupBySessionDimensions(sub)

	return sub, nil
}

// GetUsagePlot returns p50/p90/p95 of dynamic memory usage (Android,
// anon_rss + swap) or memory footprint (iOS, used_memory) over time.
func (a App) GetUsagePlot(
	ctx context.Context,
	ch driver.Conn,
	ios bool,
	scope MemoryScope,
	ef *exprfilter.ExprFilter,
	bucketExpr, datetimeFormat string,
) ([]UsageDataPoint, error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)

	result := make([]UsageDataPoint, 0)

	valueExpr := "memory_usage_dynamic.anon_rss + coalesce(memory_usage_dynamic.swap, 0)"
	eventType := "memory_usage_dynamic"
	if ios {
		valueExpr = "memory_usage_absolute.used_memory"
		eventType = "memory_usage_absolute"
	}

	matching, err := a.matchingSessionIDs(ef)
	if err != nil {
		return nil, err
	}

	stmt := sqlf.With("matching_sessions", matching).
		From("events").
		Select(bucketExpr+" as datetime_bucket", ef.Timezone).
		Select("formatDateTime(datetime_bucket, ?) as datetime", datetimeFormat).
		Select("quantiles(0.50, 0.90, 0.95)("+valueExpr+") as usage").
		Select("uniqCombined64(session_id) as sessions").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("type = ?", eventType).
		Where("timestamp >= ?", ef.From).
		Where("timestamp < ?", ef.To).
		Where("session_id in (select session_id from matching_sessions)")

	if !ios {
		// a memory_usage_dynamic row with a null anon_rss carried no usable
		// reading (proc/self/status was unavailable) and must not enter the
		// percentile computation.
		stmt.Where("memory_usage_dynamic.anon_rss is not null")
		if scope != MemoryScopeAny {
			stmt.Where("memory_usage_dynamic.process_state = ?", string(scope))
		}
	}

	defer stmt.Close()

	stmt.GroupBy("datetime_bucket").OrderBy("datetime_bucket")

	ctx = withMemoryQueryName(ctx, "usage_plot")

	rows, err := ch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}

	for rows.Next() {
		var db time.Time
		var dt string
		var usage []float64
		var sessions uint64
		if err = rows.Scan(&db, &dt, &usage, &sessions); err != nil {
			return nil, err
		}
		data := UsageDataPoint{"datetime": dt, "count": sessions}
		if len(usage) >= 3 {
			data["p50"] = math.Round(usage[0])
			data["p90"] = math.Round(usage[1])
			data["p95"] = math.Round(usage[2])
		}
		result = append(result, data)
	}

	return result, nil
}

// GetHighestMemorySessions ranks sessions by their own p90 memory usage as a
// fraction of their device's total RAM, highest first — not by the raw p90
// value, which is misleading across devices: a 68 MB peak means very
// different things on a 4 GB phone and a 16 GB one. A session with no known
// device_total_memory_kb ranks last, not first. Only sessions the memory
// sampling rate selected have a usable reading; sessions with none are
// excluded, not ranked at the bottom.
func (a App) GetHighestMemorySessions(ctx context.Context, rch driver.Conn, ios bool, ef *exprfilter.ExprFilter) (sessions []MemorySessionDisplay, next, previous bool, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	sessions = make([]MemorySessionDisplay, 0)

	base := sqlf.
		From("sessions").
		Select("session_id").
		Select("app_version.1 as app_version_major").
		Select("app_version.2 as app_version_minor").
		Select("os_version.1 as os_version_major").
		Select("os_version.2 as os_version_minor").
		Select("device_name").
		Select("device_model").
		Select("device_manufacturer").
		// device_total_memory_kb is a SimpleAggregateFunction(anyLast, ...)
		// column: re-applying anyLast() here is what actually merges it
		// correctly across any not-yet-background-merged parts, the same way
		// aggregatedSessionColumnForms re-applies sum()/max() for its fields.
		// A bare Select would return whichever physical row's value happened
		// to survive an unrelated merge, including null.
		//
		// Aliased to a different name, not back to device_total_memory_kb:
		// a session_ram_tier filter (applySessionsPredicate below) adds a
		// WHERE on the bare column in this same query, and ClickHouse
		// resolves that identifier against the SELECT alias when the names
		// match, turning a legal plain-column predicate into an illegal
		// "aggregate function found in WHERE" error. Re-aliased back to
		// device_total_memory_kb in the outer SELECT below instead, where
		// there's no WHERE clause left to collide with.
		Select("anyLast(device_total_memory_kb) as resolved_device_total_memory_kb").
		Select("min(first_event_timestamp) as start_time").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("first_event_timestamp >= ? and last_event_timestamp <= ?", ef.From, ef.To)

	if ios {
		base.Select("quantilesMerge(0.5, 0.9, 0.95)(memory_usage_absolute_percentiles)[2] as peak_memory")
	} else {
		base.Select("quantilesMerge(0.5, 0.9, 0.95)(memory_usage_percentiles)[2] as peak_memory")
	}

	if ef.HasFilterExpr() {
		if err = applySessionsPredicate(base, ef); err != nil {
			return
		}
	}

	groupBySessionDimensions(base)

	// a session the sampling rate did not select has an empty percentile
	// state, which merges to NaN — excluded, not shown as a zero.
	base.Having("peak_memory > 0")

	stmt := sqlf.With("base", base).
		From("base").
		Select("session_id").
		Select("app_version_major").
		Select("app_version_minor").
		Select("os_version_major").
		Select("os_version_minor").
		Select("device_name").
		Select("device_model").
		Select("device_manufacturer").
		Select("resolved_device_total_memory_kb as device_total_memory_kb").
		Select("start_time").
		Select("peak_memory").
		// NULL and zero denominators (device_total_memory_kb unknown) fall
		// back to 0 rather than NULL, so those sessions sort last under
		// ORDER BY ... DESC without needing an explicit NULLS LAST.
		Select("coalesce(peak_memory / nullIf(resolved_device_total_memory_kb, 0), 0) as ram_usage_ratio").
		OrderBy("ram_usage_ratio desc").
		OrderBy("session_id desc")

	defer stmt.Close()

	if ef.Limit > 0 {
		stmt.Limit(uint64(ef.Limit) + 1)
	}
	if ef.Offset >= 0 {
		stmt.Offset(uint64(ef.Offset))
	}

	ctx = withMemoryQueryName(ctx, "highest_sessions")

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var sess MemorySessionDisplay
		// ClickHouse's quantile functions always return Float64, regardless
		// of the input column's type — scanning straight into the uint64
		// field errors on every row (see network.GetLatencyPlot for the same
		// pattern: scan float64, then round).
		var peakMemory float64

		dest := []any{
			&sess.SessionID,
			&sess.AppVersion,
			&sess.AppBuild,
			&sess.OSName,
			&sess.OSVersion,
			&sess.DeviceName,
			&sess.DeviceModel,
			&sess.DeviceManufacturer,
			&sess.DeviceTotalMemory,
			&sess.StartTime,
			&peakMemory,
			&sess.RAMUsageRatio,
		}

		if err = rows.Scan(dest...); err != nil {
			return
		}
		sess.PeakMemoryKB = uint64(math.Round(peakMemory))

		sessions = append(sessions, sess)
	}

	if err = rows.Err(); err != nil {
		return
	}

	resultLen := len(sessions)
	if resultLen > ef.Limit {
		sessions = sessions[:resultLen-1]
		next = true
	}
	if ef.Offset > 0 {
		previous = true
	}

	return
}
