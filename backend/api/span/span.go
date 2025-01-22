package span

import (
	"backend/api/filter"
	"backend/api/platform"
	"backend/api/server"
	"context"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

const NetworkGeneration2G = "2g"
const NetworkGeneration3G = "3g"
const NetworkGeneration4G = "4g"
const NetworkGeneration5G = "5g"
const NetworkGenerationUnknown = "unknown"

const NetworkTypeCellular = "cellular"
const NetworkTypeWifi = "wifi"
const NetworkTypeVpn = "vpn"
const NetworkTypeNoNetwork = "no_network"
const NetworkTypeUnknown = "unknown"

// ValidNetworkTypes defines allowed
// `network_type` values.
var ValidNetworkTypes = []string{
	NetworkTypeCellular,
	NetworkTypeWifi,
	NetworkTypeVpn,
	NetworkTypeNoNetwork,
	NetworkTypeUnknown,
}

// ValidNetworkGenerations defines allowed
// `network_generation` values.
var ValidNetworkGenerations = []string{
	NetworkGeneration2G,
	NetworkGeneration3G,
	NetworkGeneration4G,
	NetworkGeneration5G,
	NetworkGenerationUnknown,
}

const (
	maxSpanNameChars           = 64
	maxCheckpointNameChars     = 64
	maxNumberOfCheckpoints     = 100
	maxThreadNameChars         = 128
	maxUserIDChars             = 128
	maxDeviceNameChars         = 32
	maxDeviceModelChars        = 32
	maxDeviceManufacturerChars = 32
	maxOSNameChars             = 32
	maxOSVersionChars          = 32
	maxPlatformChars           = 32
	maxAppVersionChars         = 128
	maxAppBuildChars           = 32
	maxAppUniqueIDChars        = 128
	maxMeasureSDKVersion       = 16
	maxNetworkTypeChars        = 16
	maxNetworkGenerationChars  = 8
	maxNetworkProviderChars    = 64
	maxDeviceLocaleChars       = 64
)

type CheckPointField struct {
	Name      string    `json:"name" binding:"required"`
	Timestamp time.Time `json:"timestamp" binding:"required"`
}

type SpanAttributes struct {
	AppUniqueID              string    `json:"app_unique_id" binding:"required"`
	InstallationID           uuid.UUID `json:"installation_id" binding:"required"`
	UserID                   string    `json:"user_id"`
	MeasureSDKVersion        string    `json:"measure_sdk_version" binding:"required"`
	AppVersion               string    `json:"app_version" binding:"required"`
	AppBuild                 string    `json:"app_build" binding:"required"`
	OSName                   string    `json:"os_name" binding:"required"`
	OSVersion                string    `json:"os_version" binding:"required"`
	Platform                 string    `json:"platform" binding:"required"`
	ThreadName               string    `json:"thread_name"`
	CountryCode              string    `json:"inet_country_code"`
	NetworkType              string    `json:"network_type"`
	NetworkProvider          string    `json:"network_provider"`
	NetworkGeneration        string    `json:"network_generation"`
	DeviceName               string    `json:"device_name"`
	DeviceModel              string    `json:"device_model"`
	DeviceManufacturer       string    `json:"device_manufacturer"`
	DeviceLocale             string    `json:"device_locale"`
	LowPowerModeEnabled      bool      `json:"device_low_power_mode"`
	ThermalThrottlingEnabled bool      `json:"device_thermal_throttling_enabled"`
}

type SpanField struct {
	AppID       uuid.UUID         `json:"app_id" binding:"required"`
	SpanName    string            `json:"name" binding:"required"`
	SpanID      string            `json:"span_id" binding:"required"`
	ParentID    string            `json:"parent_id"`
	TraceID     string            `json:"trace_id" binding:"required"`
	SessionID   uuid.UUID         `json:"session_id" binding:"required"`
	Status      uint8             `json:"status" binding:"required"`
	StartTime   time.Time         `json:"start_time" binding:"required"`
	EndTime     time.Time         `json:"end_time" binding:"required"`
	CheckPoints []CheckPointField `json:"checkpoints"`
	Attributes  SpanAttributes    `json:"attributes"`
}

type RootSpanDisplay struct {
	AppID              uuid.UUID     `json:"app_id" binding:"required"`
	SpanName           string        `json:"span_name" binding:"required"`
	SpanID             string        `json:"span_id" binding:"required"`
	TraceID            string        `json:"trace_id" binding:"required"`
	Status             uint8         `json:"status" binding:"required"`
	StartTime          time.Time     `json:"start_time" binding:"required"`
	EndTime            time.Time     `json:"end_time" binding:"required"`
	Duration           time.Duration `json:"duration" binding:"required"`
	AppVersion         string        `json:"app_version" binding:"required"`
	AppBuild           string        `json:"app_build" binding:"required"`
	OSName             string        `json:"os_name" binding:"required"`
	OSVersion          string        `json:"os_version" binding:"required"`
	DeviceModel        string        `json:"device_model"`
	DeviceManufacturer string        `json:"device_manufacturer"`
}

type SpanDisplay struct {
	SpanName                 string            `json:"span_name" binding:"required"`
	SpanID                   string            `json:"span_id" binding:"required"`
	ParentID                 string            `json:"parent_id" binding:"required"`
	Status                   uint8             `json:"status" binding:"required"`
	StartTime                time.Time         `json:"start_time" binding:"required"`
	EndTime                  time.Time         `json:"end_time" binding:"required"`
	Duration                 time.Duration     `json:"duration" binding:"required"`
	ThreadName               string            `json:"thread_name"`
	LowPowerModeEnabled      bool              `json:"device_low_power_mode"`
	ThermalThrottlingEnabled bool              `json:"device_thermal_throttling_enabled"`
	CheckPoints              []CheckPointField `json:"checkpoints"`
}

type TraceDisplay struct {
	AppID              uuid.UUID     `json:"app_id" binding:"required"`
	TraceID            string        `json:"trace_id" binding:"required"`
	SessionID          uuid.UUID     `json:"session_id" binding:"required"`
	UserID             string        `json:"user_id"`
	StartTime          time.Time     `json:"start_time" binding:"required"`
	EndTime            time.Time     `json:"end_time" binding:"required"`
	Duration           time.Duration `json:"duration" binding:"required"`
	AppVersion         string        `json:"app_version"`
	OSVersion          string        `json:"os_version" binding:"required"`
	DeviceManufacturer string        `json:"device_manufacturer"`
	DeviceModel        string        `json:"device_model"`
	NetworkType        string        `json:"network_type"`
	Spans              []SpanDisplay `json:"spans"  binding:"required"`
}

type TraceSessionTimelineDisplay struct {
	TraceID    string        `json:"trace_id" binding:"required"`
	TraceName  string        `json:"trace_name" binding:"required"`
	ThreadName string        `json:"thread_name"`
	StartTime  time.Time     `json:"start_time" binding:"required"`
	EndTime    time.Time     `json:"end_time" binding:"required"`
	Duration   time.Duration `json:"duration" binding:"required"`
}

type SpanMetricsPlotInstance struct {
	Version  string   `json:"version"`
	DateTime string   `json:"datetime"`
	P50      *float64 `json:"p50"`
	P90      *float64 `json:"p90"`
	P95      *float64 `json:"p95"`
	P99      *float64 `json:"p99"`
}

// Validate validates the span for data
// integrity.
func (s *SpanField) Validate() error {

	if s.AppID == uuid.Nil {
		return fmt.Errorf(`%q must be an app's valid UUID`, `app_id`)
	}

	if s.SpanName == "" {
		return fmt.Errorf(`%q must not be empty`, `span_name`)
	}

	if len(s.SpanName) > maxSpanNameChars {
		return fmt.Errorf(`%q exceeds maximum allowed characters of %d`, `span_name`, maxSpanNameChars)
	}

	if s.SpanID == "" {
		return fmt.Errorf(`%q must not be empty`, `span_id`)
	}

	if s.TraceID == "" {
		return fmt.Errorf(`%q must not be empty`, `trace_id`)
	}

	if s.SessionID == uuid.Nil {
		return fmt.Errorf(`%q must be a valid UUID`, `session_id`)
	}

	if s.Status > 2 {
		return fmt.Errorf(`%q must be a valid status 0 (Unset), 1 (Ok) or 2 (Error)`, `status`)
	}

	if s.StartTime.IsZero() {
		return fmt.Errorf(`%q must be a valid ISO 8601 timestamp`, `start_time`)
	}

	if s.EndTime.IsZero() {
		return fmt.Errorf(`%q must be a valid ISO 8601 timestamp`, `end_time`)
	}

	if len(s.CheckPoints) > maxNumberOfCheckpoints {
		return fmt.Errorf(`%q exceeds maximum allowed length of %d`, `checkpoints`, maxNumberOfCheckpoints)
	}

	if len(s.CheckPoints) > 0 {
		for _, cp := range s.CheckPoints {
			if len(cp.Name) > maxCheckpointNameChars {
				return fmt.Errorf(`checkpoint name %v exceeds maximum allowed characters of %d`, cp.Name, maxNumberOfCheckpoints)
			}
		}
	}

	if s.Attributes.InstallationID == uuid.Nil {
		return fmt.Errorf(`%q must be a valid UUID`, `attribute.installation_id`)
	}

	if s.Attributes.MeasureSDKVersion == "" {
		return fmt.Errorf(`%q must not be empty`, `attribute.measure_sdk_version`)
	}

	if s.Attributes.AppVersion == "" {
		return fmt.Errorf(`%q must not be empty`, `attribute.app_version`)
	}

	if s.Attributes.AppBuild == "" {
		return fmt.Errorf(`%q must not be empty`, `attribute.app_build`)
	}

	if s.Attributes.AppUniqueID == "" {
		return fmt.Errorf(`%q must not be empty`, `attribute.app_unique_id`)
	}

	if len(s.Attributes.AppUniqueID) > maxAppUniqueIDChars {
		return fmt.Errorf(`%q exceeds maximum allowed characters of %d`, `attrubute.app_unique_id`, maxAppUniqueIDChars)
	}

	if len(s.Attributes.UserID) > maxUserIDChars {
		return fmt.Errorf(`%q exceeds maximum allowed characters of %d`, `user_id`, maxUserIDChars)
	}

	if len(s.Attributes.MeasureSDKVersion) > maxMeasureSDKVersion {
		return fmt.Errorf(`%q exceeds maximum allowed characters of %d`, `measure_sdk_version`, maxMeasureSDKVersion)
	}

	if s.EndTime.Before(s.StartTime) {
		return fmt.Errorf(`end_time must not be before start_time`)
	}

	if len(s.Attributes.AppVersion) > maxAppVersionChars {
		return fmt.Errorf(`%q exceeds maximum allowed characters of %d`, `app_version`, maxAppVersionChars)
	}

	if len(s.Attributes.AppBuild) > maxAppBuildChars {
		return fmt.Errorf(`%q exceeds maximum allowed characters of %d`, `app_build`, maxAppBuildChars)
	}

	if len(s.Attributes.OSName) > maxOSNameChars {
		return fmt.Errorf(`%q exceeds maximum allowed characters of %d`, `os_name`, maxOSNameChars)
	}

	if len(s.Attributes.OSVersion) > maxOSVersionChars {
		return fmt.Errorf(`%q exceeds maximum allowed characters of %d`, `os_version`, maxOSVersionChars)
	}

	if len(s.Attributes.Platform) > maxPlatformChars {
		return fmt.Errorf(`%q exceeds maximum allowed characters of %d`, `platform`, maxPlatformChars)
	}

	switch s.Attributes.Platform {
	case platform.Android, platform.IOS:
	default:
		return fmt.Errorf(`%q does not contain a valid platform value`, `attribute.platform`)
	}

	if len(s.Attributes.ThreadName) > maxThreadNameChars {
		return fmt.Errorf(`%q exceeds maximum allowed characters of %d`, `thread_name`, maxThreadNameChars)
	}

	if len(s.Attributes.NetworkType) > maxNetworkTypeChars {
		return fmt.Errorf(`%q exceeds maximum allowed characters of %d`, `network_type`, maxNetworkTypeChars)
	}

	if len(s.Attributes.NetworkProvider) > maxNetworkProviderChars {
		return fmt.Errorf(`%q exceeds maximum allowed characters of %d`, `network_provider`, maxNetworkProviderChars)
	}

	if len(s.Attributes.NetworkGeneration) > maxNetworkGenerationChars {
		return fmt.Errorf(`%q exceeds maximum allowed characters of %d`, `network_generation`, maxNetworkGenerationChars)
	}

	if !slices.Contains(ValidNetworkTypes, s.Attributes.NetworkType) {
		return fmt.Errorf(`%q contains invalid network type`, `network_type`)
	}

	if !slices.Contains(ValidNetworkGenerations, s.Attributes.NetworkGeneration) {
		return fmt.Errorf(`%q contains invalid network geenration`, `network_generation`)
	}

	if len(s.Attributes.DeviceName) > maxDeviceNameChars {
		return fmt.Errorf(`%q exceeds maximum allowed characters of %d`, `device_name`, maxDeviceNameChars)
	}

	if len(s.Attributes.DeviceModel) > maxDeviceModelChars {
		return fmt.Errorf(`%q exceeds maximum allowed characters of %d`, `device_model`, maxDeviceModelChars)
	}

	if len(s.Attributes.DeviceManufacturer) > maxDeviceManufacturerChars {
		return fmt.Errorf(`%q exceeds maximum allowed characters of %d`, `device_manufacturer`, maxDeviceManufacturerChars)
	}

	if len(s.Attributes.DeviceLocale) > maxDeviceLocaleChars {
		return fmt.Errorf(`%q exceeds maximum allowed characters of %d`, `device_locale`, maxDeviceLocaleChars)
	}

	return nil
}

// FetchRootSpanNames returns list of root span names for a given app id
func FetchRootSpanNames(ctx context.Context, appId uuid.UUID) (traceNames []string, err error) {
	stmt := sqlf.
		Select("distinct toString(span_name)").
		From("spans").
		Where("app_id = ?", appId).
		Where("parent_id = ''").
		OrderBy("start_time desc")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var traceName string

		if err = rows.Scan(&traceName); err != nil {
			fmt.Println(err)
			return
		}

		if err = rows.Err(); err != nil {
			return
		}

		traceNames = append(traceNames, traceName)
	}

	err = rows.Err()
	return

}

// FetchTracesForSessionId returns list of traces for a given app id and session id
func FetchTracesForSessionId(ctx context.Context, appId uuid.UUID, sessionID uuid.UUID) (sessionTraces []TraceSessionTimelineDisplay, err error) {
	stmt := sqlf.
		Select("toString(span_name)").
		Select("toString(trace_id)").
		Select("toString(attribute.thread_name)").
		Select("start_time").
		Select("end_time").
		From("spans").
		Clause("prewhere app_id = toUUID(?) and session_id = ? and parent_id = ''", appId, sessionID).
		OrderBy("start_time desc")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		sessionTrace := TraceSessionTimelineDisplay{}

		if err = rows.Scan(&sessionTrace.TraceName, &sessionTrace.TraceID, &sessionTrace.ThreadName, &sessionTrace.StartTime, &sessionTrace.EndTime); err != nil {
			fmt.Println(err)
			return
		}

		if err = rows.Err(); err != nil {
			return
		}

		sessionTrace.Duration = time.Duration(sessionTrace.EndTime.Sub(sessionTrace.StartTime).Milliseconds())

		sessionTraces = append(sessionTraces, sessionTrace)
	}

	err = rows.Err()

	return
}

// GetSpanInstancesWithFilter provides list of span instances that matches various
// filter criteria in a paginated fashion.
func GetSpanInstancesWithFilter(ctx context.Context, spanName string, af *filter.AppFilter) (rootSpans []RootSpanDisplay, next, previous bool, err error) {
	stmt := sqlf.
		Select("app_id").
		Select("toString(span_name)").
		Select("toString(span_id)").
		Select("toString(trace_id)").
		Select("status").
		Select("start_time").
		Select("end_time").
		Select("tupleElement(attribute.app_version, 1)").
		Select("tupleElement(attribute.app_version, 2)").
		Select("tupleElement(attribute.os_version, 1)").
		Select("tupleElement(attribute.os_version, 2)").
		Select("attribute.device_manufacturer").
		Select("attribute.device_model").
		From("spans").
		Clause("prewhere app_id = toUUID(?) and span_name = ? and start_time >= ? and end_time <= ?", af.AppID, spanName, af.From, af.To).
		OrderBy("start_time desc")

	if len(af.SpanStatuses) > 0 {
		stmt.Where("status").In(af.SpanStatuses)
	}

	if af.Limit > 0 {
		stmt.Limit(uint64(af.Limit) + 1)
	}

	if af.Offset >= 0 {
		stmt.Offset(uint64(af.Offset))
	}

	if af.HasVersions() {
		selectedVersions, err := af.VersionPairs()
		if err != nil {
			return rootSpans, next, previous, err
		}

		stmt.Where("attribute.app_version in (?)", selectedVersions.Parameterize())
	}

	if af.HasOSVersions() {
		selectedOSVersions, err := af.OSVersionPairs()
		if err != nil {
			return rootSpans, next, previous, err
		}

		stmt.Where("attribute.os_version in (?)", selectedOSVersions.Parameterize())
	}

	if af.HasCountries() {
		stmt.Where("attribute.country_code in ?", af.Countries)
	}

	if af.HasNetworkProviders() {
		stmt.Where("attribute.network_provider in ?", af.NetworkProviders)
	}

	if af.HasNetworkTypes() {
		stmt.Where("attribute.network_type in ?", af.NetworkTypes)
	}

	if af.HasNetworkGenerations() {
		stmt.Where("attribute.network_generation in ?", af.NetworkGenerations)
	}

	if af.HasDeviceLocales() {
		stmt.Where("attribute.device_locale in ?", af.Locales)
	}

	if af.HasDeviceManufacturers() {
		stmt.Where("attribute.device_manufacturer in ?", af.DeviceManufacturers)
	}

	if af.HasDeviceNames() {
		stmt.Where("attribute.device_name in ?", af.DeviceNames)
	}

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		rootSpan := RootSpanDisplay{}

		if err = rows.Scan(&rootSpan.AppID, &rootSpan.SpanName, &rootSpan.SpanID, &rootSpan.TraceID, &rootSpan.Status, &rootSpan.StartTime, &rootSpan.EndTime, &rootSpan.AppVersion, &rootSpan.AppBuild, &rootSpan.OSName, &rootSpan.OSVersion, &rootSpan.DeviceManufacturer, &rootSpan.DeviceModel); err != nil {
			fmt.Println(err)
			return
		}

		if err = rows.Err(); err != nil {
			return
		}

		rootSpan.Duration = time.Duration(rootSpan.EndTime.Sub(rootSpan.StartTime).Milliseconds())

		rootSpans = append(rootSpans, rootSpan)
	}

	err = rows.Err()

	resultLen := len(rootSpans)

	// Set pagination next & previous flags
	if resultLen > af.Limit {
		rootSpans = rootSpans[:resultLen-1]
		next = true
	}
	if af.Offset > 0 {
		previous = true
	}

	return
}

// GetSpanMetricsPlotWithFilter provides p50, p90, p95 and p99 duration metrics
// for the given span with the applied filtering criteria
func GetSpanMetricsPlotWithFilter(ctx context.Context, spanName string, af *filter.AppFilter) (spanMetricsPlotInstances []SpanMetricsPlotInstance, err error) {
	stmt := sqlf.From("span_metrics").
		Select("concat(tupleElement(app_version, 1), ' ', '(', tupleElement(app_version, 2), ')') app_version_fmt").
		Select("formatDateTime(timestamp, '%Y-%m-%d', ?) datetime", af.Timezone).
		Select("round(quantileMerge(0.50)(p50), 2) as p50").
		Select("round(quantileMerge(0.90)(p90), 2) as p90").
		Select("round(quantileMerge(0.95)(p95), 2) as p95").
		Select("round(quantileMerge(0.99)(p99), 2) as p99").
		Clause("prewhere app_id = toUUID(?) and span_name = ? and timestamp >= ? and timestamp <= ?", af.AppID, spanName, af.From, af.To)

	if len(af.SpanStatuses) > 0 {
		stmt.Where("status").In(af.SpanStatuses)
	}

	if af.HasVersions() {
		selectedVersions, err := af.VersionPairs()
		if err != nil {
			return nil, err
		}

		stmt.Where("app_version in (?)", selectedVersions.Parameterize())
	}

	if af.HasOSVersions() {
		selectedOSVersions, err := af.OSVersionPairs()
		if err != nil {
			return nil, err
		}

		stmt.Where("os_version in (?)", selectedOSVersions.Parameterize())
	}

	if af.HasCountries() {
		stmt.Where("country_code in ?", af.Countries)
	}

	if af.HasNetworkProviders() {
		stmt.Where("network_provider in ?", af.NetworkProviders)
	}

	if af.HasNetworkTypes() {
		stmt.Where("network_type in ?", af.NetworkTypes)
	}

	if af.HasNetworkGenerations() {
		stmt.Where("network_generation in ?", af.NetworkGenerations)
	}

	if af.HasDeviceLocales() {
		stmt.Where("device_locale in ?", af.Locales)
	}

	if af.HasDeviceManufacturers() {
		stmt.Where("device_manufacturer in ?", af.DeviceManufacturers)
	}

	if af.HasDeviceNames() {
		stmt.Where("device_name in ?", af.DeviceNames)
	}

	stmt.GroupBy("app_version, datetime")
	stmt.OrderBy("datetime, tupleElement(app_version, 2) desc")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var spanMetricsPlotInstance SpanMetricsPlotInstance
		if err = rows.Scan(&spanMetricsPlotInstance.Version, &spanMetricsPlotInstance.DateTime, &spanMetricsPlotInstance.P50, &spanMetricsPlotInstance.P90, &spanMetricsPlotInstance.P95, &spanMetricsPlotInstance.P99); err != nil {
			return
		}

		spanMetricsPlotInstances = append(spanMetricsPlotInstances, spanMetricsPlotInstance)
	}

	err = rows.Err()

	return
}

// GetTrace constructs and returns a trace for
// a given traceId
func GetTrace(ctx context.Context, traceId string) (trace TraceDisplay, err error) {
	stmt := sqlf.
		Select("app_id").
		Select("toString(trace_id)").
		Select("session_id").
		Select("attribute.user_id").
		Select("toString(span_id)").
		Select("toString(span_name)").
		Select("toString(parent_id)").
		Select("start_time").
		Select("end_time").
		Select("status").
		Select("checkpoints").
		Select("tupleElement(attribute.app_version, 1)").
		Select("tupleElement(attribute.app_version, 2)").
		Select("tupleElement(attribute.os_version, 1)").
		Select("tupleElement(attribute.os_version, 2)").
		Select("attribute.device_manufacturer").
		Select("attribute.device_model").
		Select("attribute.network_type").
		Select("toString(attribute.thread_name)").
		Select("attribute.device_low_power_mode").
		Select("attribute.device_thermal_throttling_enabled").
		From("spans").
		Where("trace_id = ?", traceId).
		OrderBy("start_time desc")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	spans := []SpanField{}

	for rows.Next() {
		var rawCheckpoints [][]interface{}
		span := SpanField{}

		if err = rows.Scan(&span.AppID, &span.TraceID, &span.SessionID, &span.Attributes.UserID, &span.SpanID, &span.SpanName, &span.ParentID, &span.StartTime, &span.EndTime, &span.Status, &rawCheckpoints, &span.Attributes.AppVersion, &span.Attributes.AppBuild, &span.Attributes.OSName, &span.Attributes.OSVersion, &span.Attributes.DeviceManufacturer, &span.Attributes.DeviceModel, &span.Attributes.NetworkType, &span.Attributes.ThreadName, &span.Attributes.LowPowerModeEnabled, &span.Attributes.ThermalThrottlingEnabled); err != nil {
			fmt.Println(err)
			return
		}

		if err = rows.Err(); err != nil {
			return
		}

		// Map rawCheckpoints into CheckPointField
		for _, cp := range rawCheckpoints {
			rawName, _ := cp[0].(string)
			name := strings.ReplaceAll(rawName, "\u0000", "")
			timestamp, _ := cp[1].(time.Time)
			span.CheckPoints = append(span.CheckPoints, CheckPointField{
				Name:      name,
				Timestamp: timestamp,
			})
		}

		spans = append(spans, span)
	}

	if len(spans) == 0 {
		return trace, fmt.Errorf("no spans found for traceId: %v", traceId)
	}

	spanDisplays := []SpanDisplay{}
	var minStartTime time.Time
	var maxEndTime time.Time

	for i, span := range spans {
		spanDisplay := SpanDisplay{
			span.SpanName,
			span.SpanID,
			span.ParentID,
			span.Status,
			span.StartTime,
			span.EndTime,
			time.Duration(span.EndTime.Sub(span.StartTime).Milliseconds()),
			span.Attributes.ThreadName,
			span.Attributes.LowPowerModeEnabled,
			span.Attributes.ThermalThrottlingEnabled,
			span.CheckPoints,
		}

		spanDisplays = append(spanDisplays, spanDisplay)

		// Initialize minStartTime and maxEndTime on the first iteration
		if i == 0 {
			minStartTime = span.StartTime
			maxEndTime = span.EndTime
		} else {
			// Update minStartTime and maxEndTime as necessary
			if span.StartTime.Before(minStartTime) {
				minStartTime = span.StartTime
			}
			if span.EndTime.After(maxEndTime) {
				maxEndTime = span.EndTime
			}
		}
	}

	trace.AppID = spans[0].AppID
	trace.TraceID = spans[0].TraceID
	trace.SessionID = spans[0].SessionID
	trace.UserID = spans[0].Attributes.UserID
	trace.StartTime = minStartTime
	trace.EndTime = maxEndTime
	trace.Duration = time.Duration(maxEndTime.Sub(minStartTime).Milliseconds())
	trace.AppVersion = spans[0].Attributes.AppVersion + "(" + spans[0].Attributes.AppBuild + ")"
	trace.OSVersion = spans[0].Attributes.OSName + " " + spans[0].Attributes.OSVersion
	trace.DeviceManufacturer = spans[0].Attributes.DeviceManufacturer
	trace.DeviceModel = spans[0].Attributes.DeviceModel
	trace.NetworkType = spans[0].Attributes.NetworkType
	trace.Spans = spanDisplays

	return
}
