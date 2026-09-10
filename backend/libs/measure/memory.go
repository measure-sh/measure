package measure

import (
	"context"
	"time"

	"backend/libs/chquery"
	"backend/libs/exprfilter"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

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
}

// GetHighestMemorySessions ranks sessions by their own p90 dynamic memory
// usage (Android, anon_rss + swap) or memory footprint (iOS, used_memory),
// highest first. Only sessions the memory sampling rate selected have a
// usable reading; sessions with none are excluded, not ranked at the bottom.
func (a App) GetHighestMemorySessions(ctx context.Context, rch driver.Conn, ios bool, ef *exprfilter.ExprFilter) (sessions []MemorySessionDisplay, next, previous bool, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)

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
		Select("device_total_memory_kb").
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

	base.
		GroupBy("session_id").
		GroupBy("app_version").
		GroupBy("os_version").
		GroupBy("device_name").
		GroupBy("device_model").
		GroupBy("device_manufacturer").
		GroupBy("device_total_memory_kb")

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
		Select("device_total_memory_kb").
		Select("start_time").
		Select("peak_memory").
		OrderBy("peak_memory desc").
		OrderBy("session_id desc")

	defer stmt.Close()

	if ef.Limit > 0 {
		stmt.Limit(uint64(ef.Limit) + 1)
	}
	if ef.Offset >= 0 {
		stmt.Offset(uint64(ef.Offset))
	}

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var sess MemorySessionDisplay

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
			&sess.PeakMemoryKB,
		}

		if err = rows.Scan(dest...); err != nil {
			return
		}

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
