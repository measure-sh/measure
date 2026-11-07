package measure

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"backend/libs/chquery"
	"backend/libs/event"
	"backend/libs/filter"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"github.com/leporo/sqlf"
	valkey "github.com/valkey-io/valkey-go"
)

// LaunchTypes lists the launch_type values accepted by the device launch list.
var LaunchTypes = []string{event.TypeColdLaunch, event.TypeWarmLaunch, event.TypeHotLaunch}

// DevicesPlotLimit is the maximum number of device lines in the sessions plot.
const DevicesPlotLimit = 5

// Device identifies one device model. If its rows contain multiple device
// names, DeviceName is the most common one.
type Device struct {
	DeviceManufacturer string `json:"device_manufacturer"`
	DeviceModel        string `json:"device_model"`
	DeviceName         string `json:"device_name"`
}

// DevicesPercentiles lists the percentiles reported by the duration and memory
// lists, in quantile-array order.
var DevicesPercentiles = []string{"p50", "p90", "p95"}

// DevicesPage contains one page of results, ranked by the list's metric.
// Ascending reverses the default highest-to-lowest order. The duration and
// memory lists rank by Percentile, defaulting to p95 when it is empty.
type DevicesPage struct {
	Ascending  bool
	Percentile string
}

func (page DevicesPage) quantileRank() string {
	i := slices.Index(DevicesPercentiles, page.Percentile)
	if i < 0 {
		i = len(DevicesPercentiles) - 1
	}
	// ClickHouse arrays are 1-indexed.
	return fmt.Sprintf("quantiles[%d]", i+1)
}

// DeviceSessionsRow contains session counts for one device model.
type DeviceSessionsRow struct {
	Device
	SessionCount      uint64  `json:"session_count"`
	PercentOfSessions float64 `json:"percent_of_sessions"`
}

// DeviceErrorsRow contains error counts for one device model.
type DeviceErrorsRow struct {
	Device
	CrashCount    uint64 `json:"crash_count"`
	ANRCount      uint64 `json:"anr_count"`
	AppHangCount  uint64 `json:"app_hang_count"`
	NonFatalCount uint64 `json:"non_fatal_count"`
	ErrorCount    uint64 `json:"error_count"`
	SessionCount  uint64 `json:"session_count"`
}

// DeviceDurationRow contains duration percentiles, in milliseconds, for one
// device model.
type DeviceDurationRow struct {
	Device
	P50   *float64 `json:"p50"`
	P90   *float64 `json:"p90"`
	P95   *float64 `json:"p95"`
	Count uint64   `json:"count"`
}

// DeviceMemoryRow contains memory usage percentiles, in KiB, for one device
// model.
type DeviceMemoryRow struct {
	Device
	P50          *float64 `json:"p50"`
	P90          *float64 `json:"p90"`
	P95          *float64 `json:"p95"`
	SessionCount uint64   `json:"session_count"`
	SampleCount  uint64   `json:"sample_count"`
}

// DeviceSessionsPlotPoint contains the session count for one device model in
// one time bucket.
type DeviceSessionsPlotPoint struct {
	DeviceManufacturer string `json:"device_manufacturer"`
	DeviceModel        string `json:"device_model"`
	DateTime           string `json:"datetime"`
	SessionCount       uint64 `json:"session_count"`
}

func applyDevicesPredicate(stmt *sqlf.Stmt, flt *filter.Filter, columns *filter.Columns) error {
	if !flt.HasFilterExpr() {
		return nil
	}
	predicate, err := flt.Predicate(columns)
	if err != nil {
		return err
	}
	defer predicate.Close()
	stmt.Where(predicate.String(), predicate.Args()...)
	return nil
}

// orderDevicesPage ranks results by rankExpr and reads one extra row to
// determine whether another page exists.
func orderDevicesPage(stmt *sqlf.Stmt, flt *filter.Filter, page DevicesPage, rankExpr string) {
	direction := " DESC"
	if page.Ascending {
		direction = " ASC"
	}
	stmt.OrderBy(rankExpr+direction, "device_manufacturer", "device_model").
		Limit(flt.Limit + 1).
		Offset(flt.Offset)
}

func trimDevicesPage[Row any](rows []Row, flt *filter.Filter) (page []Row, next, previous bool) {
	if len(rows) > flt.Limit {
		return rows[:flt.Limit], true, flt.Offset > 0
	}
	return rows, false, flt.Offset > 0
}

// devicesEvents selects an app's events in the filter's time range that report
// a device model, grouped by device.
func (a App) devicesEvents(flt *filter.Filter) (*sqlf.Stmt, error) {
	stmt := sqlf.From("events").
		Select("`attribute.device_manufacturer` AS device_manufacturer").
		Select("`attribute.device_model` AS device_model").
		Select("topK(1)(`attribute.device_name`)[1] AS device_name").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("timestamp >= ? AND timestamp <= ?", flt.From, flt.To).
		Where("`attribute.device_model` != ''").
		GroupBy("device_manufacturer, device_model")
	if err := applyDevicesPredicate(stmt, flt, nil); err != nil {
		stmt.Close()
		return nil, err
	}
	return stmt, nil
}

// devicesSessions selects one row per session that overlaps the filter's time
// range and reports a device model.
func (a App) devicesSessions(flt *filter.Filter) (*sqlf.Stmt, error) {
	stmt := sqlf.From("sessions").
		Select("session_id").
		Select("min(first_event_timestamp) AS start_time").
		Select("device_manufacturer").
		Select("device_model").
		Select("device_name").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("last_event_timestamp >= ? AND first_event_timestamp <= ?", flt.From, flt.To).
		Where("device_model != ''").
		GroupBy("session_id, device_manufacturer, device_model, device_name")
	if err := applyDevicesPredicate(stmt, flt, filter.DevicesSessionsColumns); err != nil {
		stmt.Close()
		return nil, err
	}
	return stmt, nil
}

// GetDevicesSessions returns one page of device models ranked by session count.
func (a App) GetDevicesSessions(ctx context.Context, rch driver.Conn, flt *filter.Filter, page DevicesPage) (rows []DeviceSessionsRow, next, previous bool, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	sessions, err := a.devicesSessions(flt)
	if err != nil {
		return nil, false, false, err
	}
	stmt := sqlf.With("device_sessions", sessions).
		From("device_sessions").
		Select("device_manufacturer").
		Select("device_model").
		Select("topK(1)(device_name)[1] AS device_name").
		Select("count() AS session_count").
		Select("session_count * 100 / sum(session_count) OVER () AS percent_of_sessions").
		GroupBy("device_manufacturer, device_model")
	defer stmt.Close()
	orderDevicesPage(stmt, flt, page, "session_count")

	ctx, querySpan := tracer.Start(ctx, "devices.sessions")
	defer querySpan.End()

	result, err := chRows(ctx, rch, stmt, func(scan func(...any) error) (DeviceSessionsRow, error) {
		var row DeviceSessionsRow
		err := scan(&row.DeviceManufacturer, &row.DeviceModel, &row.DeviceName, &row.SessionCount, &row.PercentOfSessions)
		return row, err
	})
	if err != nil {
		return nil, false, false, err
	}
	rows, next, previous = trimDevicesPage(result, flt)
	return rows, next, previous, nil
}

// GetDevicesSessionsPlot returns per-bucket session counts for the device
// models with the most sessions in the filter's time range.
func (a App) GetDevicesSessionsPlot(ctx context.Context, rch driver.Conn, flt *filter.Filter) ([]DeviceSessionsPlotPoint, error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	if flt.Timezone == "" {
		return nil, errors.New("missing timezone filter")
	}
	flt.SetDefaultPlotTimeGroupIfUnset()
	// Sessions that started before the range count in its first bucket, so the
	// plot totals match the sessions list's session counts.
	groupExpr, err := GetPlotTimeGroupExpr("greatest(start_time, ?)", flt.PlotTimeGroup)
	if err != nil {
		return nil, err
	}
	sessions, err := a.devicesSessions(flt)
	if err != nil {
		return nil, err
	}
	top := sqlf.From("device_sessions").
		Select("device_manufacturer, device_model").
		GroupBy("device_manufacturer, device_model").
		OrderBy("count() DESC", "device_manufacturer", "device_model").
		Limit(DevicesPlotLimit)
	stmt := sqlf.With("device_sessions", sessions).
		With("top_devices", top).
		From("device_sessions").
		Select("device_manufacturer").
		Select("device_model").
		Select(groupExpr.BucketExpr+" AS datetime_bucket", flt.From, flt.Timezone).
		Select("formatDateTime(datetime_bucket, ?) AS datetime", groupExpr.DatetimeFormat).
		Select("count() AS session_count").
		Where("(device_manufacturer, device_model) IN (SELECT device_manufacturer, device_model FROM top_devices)").
		GroupBy("device_manufacturer, device_model, datetime_bucket").
		OrderBy("datetime_bucket, device_manufacturer, device_model")
	defer stmt.Close()

	ctx, querySpan := tracer.Start(ctx, "devices.sessions_plot")
	defer querySpan.End()

	return chRows(ctx, rch, stmt, func(scan func(...any) error) (DeviceSessionsPlotPoint, error) {
		var point DeviceSessionsPlotPoint
		var bucket time.Time
		err := scan(&point.DeviceManufacturer, &point.DeviceModel, &bucket, &point.DateTime, &point.SessionCount)
		return point, err
	})
}

// GetDevicesErrors returns one page of device models ranked by error count:
// crashes, ANRs, app hangs, and non-fatal errors.
func (a App) GetDevicesErrors(ctx context.Context, rch driver.Conn, flt *filter.Filter, page DevicesPage) (rows []DeviceErrorsRow, next, previous bool, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	stmt, err := a.devicesEvents(flt)
	if err != nil {
		return nil, false, false, err
	}
	defer stmt.Close()
	nonFatal := filter.ErrorTypeSQL(filter.ErrorTypeHandledError) + " OR " + filter.ErrorTypeSQL(filter.ErrorTypeUnhandledError)
	stmt.
		Select("uniqExactIf(id, " + filter.ErrorTypeSQL(filter.ErrorTypeCrash) + ") AS crash_count").
		Select("uniqExactIf(id, type = 'anr') AS anr_count").
		Select("uniqExactIf(id, type = 'app_hang') AS app_hang_count").
		Select("uniqExactIf(id, " + nonFatal + ") AS non_fatal_count").
		Select("uniqExact(id) AS error_count").
		Select("uniqExact(session_id) AS session_count").
		Where("type IN ('exception', 'anr', 'app_hang')")
	orderDevicesPage(stmt, flt, page, "error_count")

	ctx, querySpan := tracer.Start(ctx, "devices.errors")
	defer querySpan.End()

	result, err := chRows(ctx, rch, stmt, func(scan func(...any) error) (DeviceErrorsRow, error) {
		var row DeviceErrorsRow
		err := scan(&row.DeviceManufacturer, &row.DeviceModel, &row.DeviceName, &row.CrashCount, &row.ANRCount, &row.AppHangCount, &row.NonFatalCount, &row.ErrorCount, &row.SessionCount)
		return row, err
	})
	if err != nil {
		return nil, false, false, err
	}
	rows, next, previous = trimDevicesPage(result, flt)
	return rows, next, previous, nil
}

// GetDevicesLaunches returns one page of device models ranked by the duration
// of one launch type.
func (a App) GetDevicesLaunches(ctx context.Context, rch driver.Conn, flt *filter.Filter, page DevicesPage, launchType string) (rows []DeviceDurationRow, next, previous bool, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	if !slices.Contains(LaunchTypes, launchType) {
		return nil, false, false, fmt.Errorf("invalid launch type %q", launchType)
	}
	duration := "`" + launchType + ".duration`"
	stmt, err := a.devicesEvents(flt)
	if err != nil {
		return nil, false, false, err
	}
	defer stmt.Close()
	stmt.
		Select("CAST(quantilesTDigest(0.50, 0.90, 0.95)("+duration+") AS Array(Float64)) AS quantiles").
		Select("count() AS launch_count").
		Where("type = ?", launchType).
		Where(duration + " > 0")
	orderDevicesPage(stmt, flt, page, page.quantileRank())

	ctx, querySpan := tracer.Start(ctx, "devices.launches")
	defer querySpan.End()

	result, err := chRows(ctx, rch, stmt, scanDeviceDuration)
	if err != nil {
		return nil, false, false, err
	}
	rows, next, previous = trimDevicesPage(result, flt)
	return rows, next, previous, nil
}

// GetDevicesSpans returns one page of device models ranked by the duration of
// one span.
func (a App) GetDevicesSpans(ctx context.Context, rch driver.Conn, flt *filter.Filter, page DevicesPage, spanName string) (rows []DeviceDurationRow, next, previous bool, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	stmt := sqlf.From("span_metrics").
		Select("device_manufacturer").
		Select("device_model").
		Select("topK(1)(device_name)[1] AS device_name").
		Select("[quantileMerge(0.50)(p50), quantileMerge(0.90)(p90), quantileMerge(0.95)(p95)] AS quantiles").
		Select("uniq(span_id) AS span_count").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("span_name = ?", spanName).
		Where("timestamp >= ? AND timestamp <= ?", flt.From, flt.To).
		Where("device_model != ''").
		GroupBy("device_manufacturer, device_model")
	defer stmt.Close()
	if err := applyDevicesPredicate(stmt, flt, filter.SpanMetricsColumns); err != nil {
		return nil, false, false, err
	}
	orderDevicesPage(stmt, flt, page, page.quantileRank())

	ctx, querySpan := tracer.Start(ctx, "devices.spans")
	defer querySpan.End()

	result, err := chRows(ctx, rch, stmt, scanDeviceDuration)
	if err != nil {
		return nil, false, false, err
	}
	rows, next, previous = trimDevicesPage(result, flt)
	return rows, next, previous, nil
}

func scanDeviceDuration(scan func(...any) error) (DeviceDurationRow, error) {
	var row DeviceDurationRow
	var quantiles []float64
	err := scan(&row.DeviceManufacturer, &row.DeviceModel, &row.DeviceName, &quantiles, &row.Count)
	row.P50, row.P90, row.P95 = percentilesOf(quantiles)
	return row, err
}

// percentilesOf returns the p50, p90, and p95 values from a quantiles column,
// or nil values if the column is empty.
func percentilesOf(quantiles []float64) (p50, p90, p95 *float64) {
	if len(quantiles) != len(DevicesPercentiles) {
		return nil, nil, nil
	}
	return &quantiles[0], &quantiles[1], &quantiles[2]
}

// GetDevicesMemory returns one page of device models ranked by memory usage.
func (a App) GetDevicesMemory(ctx context.Context, rch driver.Conn, flt *filter.Filter, page DevicesPage) (rows []DeviceMemoryRow, next, previous bool, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	source, ok := a.memorySource()
	if !ok {
		return []DeviceMemoryRow{}, false, false, nil
	}
	stmt, err := memoryUsageEvents(a, flt, source)
	if err != nil {
		return nil, false, false, err
	}
	defer stmt.Close()
	stmt.
		Select("`attribute.device_manufacturer` AS device_manufacturer").
		Select("`attribute.device_model` AS device_model").
		Select("topK(1)(`attribute.device_name`)[1] AS device_name").
		Select("CAST(quantilesTDigest(0.50, 0.90, 0.95)(" + source.usageKB + ") AS Array(Float64)) AS quantiles").
		Select("uniqExact(session_id) AS session_count").
		Select("count() AS sample_count").
		Where("`attribute.device_model` != ''").
		GroupBy("device_manufacturer, device_model")
	orderDevicesPage(stmt, flt, page, page.quantileRank())

	ctx, querySpan := tracer.Start(ctx, "devices.memory")
	defer querySpan.End()

	result, err := chRows(ctx, rch, stmt, func(scan func(...any) error) (DeviceMemoryRow, error) {
		var row DeviceMemoryRow
		var quantiles []float64
		err := scan(&row.DeviceManufacturer, &row.DeviceModel, &row.DeviceName, &quantiles, &row.SessionCount, &row.SampleCount)
		row.P50, row.P90, row.P95 = percentilesOf(quantiles)
		return row, err
	})
	if err != nil {
		return nil, false, false, err
	}
	rows, next, previous = trimDevicesPage(result, flt)
	return rows, next, previous, nil
}

func chRows[Row any](ctx context.Context, rch driver.Conn, stmt *sqlf.Stmt, scanRow func(scan func(...any) error) (Row, error)) ([]Row, error) {
	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []Row{}
	for rows.Next() {
		row, err := scanRow(rows.Scan)
		if err != nil {
			return nil, err
		}
		result = append(result, row)
	}
	return result, rows.Err()
}

// Device results remain cached for this duration, since new events are unlikely
// to change the ranking substantially during that time.
const devicesCacheTTL = 10 * time.Minute

var devicesCache = queryCache{name: "devices", version: 1}

// devicesCacheKey identifies a cached device result. Params contains the other
// query values.
type devicesCacheKey struct {
	Query      string
	TeamID     uuid.UUID
	AppID      uuid.UUID
	From       time.Time
	To         time.Time
	FilterExpr string
	Limit      int
	Offset     int
	Params     []any
}

// flt must use the bounds from alignCachedRange so the cache key matches the
// query's time range.
func newDevicesCacheKey(query string, flt *filter.Filter, params ...any) devicesCacheKey {
	return devicesCacheKey{
		Query:      query,
		TeamID:     flt.TeamID,
		AppID:      flt.AppID,
		From:       flt.From,
		To:         flt.To,
		FilterExpr: flt.FilterExpr,
		Limit:      flt.Limit,
		Offset:     flt.Offset,
		Params:     params,
	}
}

type devicesPageResult[Row any] struct {
	Rows     []Row
	Next     bool
	Previous bool
}

func cachedDevicesPage[Row any](ctx context.Context, vk valkey.Client, flt *filter.Filter, query string, page DevicesPage, params []any, run func(flt *filter.Filter) ([]Row, bool, bool, error)) (rows []Row, next, previous bool, err error) {
	flt = alignCachedRange(flt)
	key := newDevicesCacheKey(query, flt, append([]any{page}, params...)...)
	result, err := cachedQuery(ctx, vk, devicesCache, flt.AppID, query, key, devicesCacheTTL, func() (devicesPageResult[Row], error) {
		rows, next, previous, err := run(flt)
		return devicesPageResult[Row]{Rows: rows, Next: next, Previous: previous}, err
	})
	return result.Rows, result.Next, result.Previous, err
}

func (a App) GetDevicesSessionsCached(ctx context.Context, vk valkey.Client, rch driver.Conn, flt *filter.Filter, page DevicesPage) ([]DeviceSessionsRow, bool, bool, error) {
	return cachedDevicesPage(ctx, vk, flt, "sessions", page, nil, func(flt *filter.Filter) ([]DeviceSessionsRow, bool, bool, error) {
		return a.GetDevicesSessions(ctx, rch, flt, page)
	})
}

func (a App) GetDevicesErrorsCached(ctx context.Context, vk valkey.Client, rch driver.Conn, flt *filter.Filter, page DevicesPage) ([]DeviceErrorsRow, bool, bool, error) {
	return cachedDevicesPage(ctx, vk, flt, "errors", page, nil, func(flt *filter.Filter) ([]DeviceErrorsRow, bool, bool, error) {
		return a.GetDevicesErrors(ctx, rch, flt, page)
	})
}

func (a App) GetDevicesLaunchesCached(ctx context.Context, vk valkey.Client, rch driver.Conn, flt *filter.Filter, page DevicesPage, launchType string) ([]DeviceDurationRow, bool, bool, error) {
	return cachedDevicesPage(ctx, vk, flt, "launches", page, []any{launchType}, func(flt *filter.Filter) ([]DeviceDurationRow, bool, bool, error) {
		return a.GetDevicesLaunches(ctx, rch, flt, page, launchType)
	})
}

func (a App) GetDevicesSpansCached(ctx context.Context, vk valkey.Client, rch driver.Conn, flt *filter.Filter, page DevicesPage, spanName string) ([]DeviceDurationRow, bool, bool, error) {
	return cachedDevicesPage(ctx, vk, flt, "spans", page, []any{spanName}, func(flt *filter.Filter) ([]DeviceDurationRow, bool, bool, error) {
		return a.GetDevicesSpans(ctx, rch, flt, page, spanName)
	})
}

func (a App) GetDevicesMemoryCached(ctx context.Context, vk valkey.Client, rch driver.Conn, flt *filter.Filter, page DevicesPage) ([]DeviceMemoryRow, bool, bool, error) {
	return cachedDevicesPage(ctx, vk, flt, "memory", page, nil, func(flt *filter.Filter) ([]DeviceMemoryRow, bool, bool, error) {
		return a.GetDevicesMemory(ctx, rch, flt, page)
	})
}

func (a App) GetDevicesSessionsPlotCached(ctx context.Context, vk valkey.Client, rch driver.Conn, flt *filter.Filter) ([]DeviceSessionsPlotPoint, error) {
	flt = alignCachedRange(flt)
	key := newDevicesCacheKey("sessions_plot", flt, flt.Timezone, flt.PlotTimeGroup)
	return cachedQuery(ctx, vk, devicesCache, flt.AppID, "sessions_plot", key, devicesCacheTTL, func() ([]DeviceSessionsPlotPoint, error) {
		return a.GetDevicesSessionsPlot(ctx, rch, flt)
	})
}
