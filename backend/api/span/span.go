package span

import (
	"backend/api/config"
	"backend/api/event"
	"backend/api/opsys"
	"backend/api/server"
	"fmt"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
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

// ttidClassRE defines the regular expression
// to extact the class name from a TTID span's
// name.
var ttidClassRE = regexp.MustCompile(`^(?:Activity|Fragment)\s+TTID\s+([A-Za-z0-9.]+)`)

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
	SessionStartTime         *time.Time `json:"session_start_time"`
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
	UserDefinedAttribute     event.UDAttribute `json:"user_defined_attributes"`
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
	TraceID            string        `json:"trace_id" binding:"required"`
	TraceName          string        `json:"trace_name" binding:"required"`
	AppVersion         string        `json:"-"`
	AppBuild           string        `json:"-"`
	UserID             string        `json:"-"`
	ThreadName         string        `json:"thread_name"`
	DeviceManufacturer string        `json:"-"`
	DeviceModel        string        `json:"-"`
	NetworkType        string        `json:"-"`
	StartTime          time.Time     `json:"start_time" binding:"required"`
	EndTime            time.Time     `json:"end_time" binding:"required"`
	Duration           time.Duration `json:"duration" binding:"required"`
}

type SpanMetricsPlotInstance struct {
	Version  string   `json:"version"`
	DateTime string   `json:"datetime"`
	P50      *float64 `json:"p50"`
	P90      *float64 `json:"p90"`
	P95      *float64 `json:"p95"`
	P99      *float64 `json:"p99"`
}

type SpanField struct {
	AppID                uuid.UUID         `json:"app_id" binding:"required"`
	SpanName             string            `json:"name" binding:"required"`
	SpanID               string            `json:"span_id" binding:"required"`
	ParentID             string            `json:"parent_id"`
	TraceID              string            `json:"trace_id" binding:"required"`
	SessionID            uuid.UUID         `json:"session_id" binding:"required"`
	Status               uint8             `json:"status" binding:"required"`
	StartTime            time.Time         `json:"start_time" binding:"required"`
	EndTime              time.Time         `json:"end_time" binding:"required"`
	CheckPoints          []CheckPointField `json:"checkpoints"`
	Attributes           SpanAttributes    `json:"attributes"`
	UserDefinedAttribute event.UDAttribute `json:"user_defined_attribute" binding:"required"`
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

	// Don't allow batches that contain spans too far in the past or future
	//
	// Since, these timestamps affect the creation of partitions in the database
	// without any enforcement, we lose control on the number of partitions which leads to fragmented query performance.
	//
	// For testing, it might be useful to disable this check which can be controlled using the "INGEST_ENFORCE_TIME_WINDOW" environment variable.
	if server.Server.Config.IngestEnforceTimeWindow {
		now := time.Now()
		lower := now.Add(-config.MaxPastOffset)
		upper := now.Add(config.MaxFutureOffset)
		drift := s.StartTime.Sub(now)

		if s.StartTime.Before(lower) {
			return fmt.Errorf("%q is too far in the past: app=%s, drift=%s, max_allowed=%s", "startTime", s.Attributes.AppUniqueID, drift, config.MaxPastOffset)
		} else if s.StartTime.After(upper) {
			return fmt.Errorf("%q is too far in the future: app=%s, drift=%s, max_allowed=%s", "startTime", s.Attributes.AppUniqueID, drift, config.MaxFutureOffset)
		}
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

	switch opsys.ToFamily(s.Attributes.OSName) {
	case opsys.Android, opsys.AppleFamily:
	default:
		return fmt.Errorf(`%q does not contain a valid OS value`, `attribute.os_name`)
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

// SetTTIDClass sets the class name of the span
// matching the TTID span naming pattern.
func (s *SpanField) SetTTIDClass(c string) {
	index := strings.LastIndex(s.SpanName, " ")
	if index == -1 {
		return
	}

	s.SpanName = s.SpanName[:index+1] + c
}

// NeedsSymbolication returns true if the span needs
// symbolication, false otherwise.
func (s SpanField) NeedsSymbolication() (result bool) {
	result = false

	if s.SpanName == "" {
		return
	}

	switch s.Attributes.OSName {
	case opsys.Android:
		matches := ttidClassRE.FindStringSubmatch(s.SpanName)

		if len(matches) > 1 {
			result = true
		}
	}

	return
}

// GetTTIDClass provides the class name of the span
// matching the TTID span naming pattern.
func (s SpanField) GetTTIDClass() (class string) {
	matches := ttidClassRE.FindStringSubmatch(s.SpanName)
	if len(matches) < 2 {
		return
	}

	return matches[1]
}
