package event

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"net"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
)

// constants defining maximum character
// limits for various event fields.
const (
	maxTypeChars                              = 32
	maxExceptionDeviceLocaleChars             = 64
	maxAnrDeviceLocaleChars                   = 64
	maxAppExitReasonChars                     = 64
	maxAppExitImportanceChars                 = 32
	maxSeverityTextChars                      = 10
	maxGestureLongClickTargetChars            = 128
	maxGestureLongClickTargetNameChars        = 128
	maxGestureLongClickTargetIDChars          = 128
	maxGestureScrollTargetChars               = 128
	maxGestureScrollTargetNameChars           = 128
	maxGestureScrollTargetIDChars             = 128
	maxGestureScrollDirectionChars            = 8
	maxGestureClickTargetChars                = 128
	maxGestureClickTargetNameChars            = 128
	maxGestureClickTargetIDChars              = 128
	maxLifecycleActivityTypeChars             = 32
	maxLifecycleActivityClassNameChars        = 128
	maxLifecycleFragmentTypeChars             = 32
	maxLifecycleFragmentClassNameChars        = 128
	maxLifecycleAppTypeChars                  = 32
	maxColdLaunchLaunchedActivityChars        = 128
	maxWarmLaunchLaunchedActivityChars        = 128
	maxHotLaunchLaunchedActivityChars         = 128
	maxNetworkChangeNetworkTypeChars          = 16
	maxNetworkChangePreviousNetworkTypeChars  = 16
	maxNetworkChangeNetworkGeneration         = 8
	maxNetworkChangePreviousNetworkGeneration = 8
	maxNetworkChangeNetworkProvider           = 64
	maxHttpMethodChars                        = 16
	maxHttpClientChars                        = 32
	maxTrimMemoryLevelChars                   = 64
	maxNavigationToChars                      = 128
	maxNavigationFromChars                    = 128
	maxNavigationSourceChars                  = 128
)

const TypeANR = "anr"
const TypeException = "exception"
const TypeAppExit = "app_exit"
const TypeString = "string"
const TypeGestureLongClick = "gesture_long_click"
const TypeGestureClick = "gesture_click"
const TypeGestureScroll = "gesture_scroll"
const TypeLifecycleActivity = "lifecycle_activity"
const TypeLifecycleFragment = "lifecycle_fragment"
const TypeLifecycleApp = "lifecycle_app"
const TypeColdLaunch = "cold_launch"
const TypeWarmLaunch = "warm_launch"
const TypeHotLaunch = "hot_launch"
const TypeNetworkChange = "network_change"
const TypeHttp = "http"
const TypeMemoryUsage = "memory_usage"
const TypeLowMemory = "low_memory"
const TypeTrimMemory = "trim_memory"
const TypeCPUUsage = "cpu_usage"
const TypeNavigation = "navigation"

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

const LifecycleActivityTypeCreated = "created"
const LifecycleActivityTypeResumed = "resumed"
const LifecycleActivityTypePaused = "paused"
const LifecycleActivityTypeDestroyed = "destroyed"

const LifecycleFragmentTypeAttached = "attached"
const LifecycleFragmentTypeResumed = "resumed"
const LifecycleFragmentTypePaused = "paused"
const LifecycleFragmentTypeDetached = "detached"

const LifecycleAppTypeBackground = "background"
const LifecycleAppTypeForeground = "foreground"

// NominalColdLaunchThreshold defines the upper bound
// of a nominal cold launch duration.
const NominalColdLaunchThreshold = 30 * time.Second

// ValidLifecycleActivityTypes defines allowed
// `lifecycle_activity.type` values.
var ValidLifecycleActivityTypes = []string{
	LifecycleActivityTypeCreated,
	LifecycleActivityTypeResumed,
	LifecycleActivityTypePaused,
	LifecycleActivityTypeDestroyed,
}

// ValidLifecycleFragmentTypes defines allowed
// `lifecycle_fragment.type` values.
var ValidLifecycleFragmentTypes = []string{
	LifecycleFragmentTypeAttached,
	LifecycleFragmentTypeResumed,
	LifecycleFragmentTypePaused,
	LifecycleFragmentTypeDetached,
}

// ValidLifecycleAppTypes defines allowed
// `lifecycle_app.type` values.
var ValidLifecycleAppTypes = []string{
	LifecycleAppTypeBackground,
	LifecycleAppTypeForeground,
}

// ValidNetworkTypes defines allowed
// `network_change.network_type` values.
var ValidNetworkTypes = []string{
	NetworkTypeCellular,
	NetworkTypeWifi,
	NetworkTypeVpn,
	NetworkTypeNoNetwork,
	NetworkTypeUnknown,
}

// ValidNetworkGenerations defines allowed
// `network_change.network_generation` values.
var ValidNetworkGenerations = []string{
	NetworkGeneration2G,
	NetworkGeneration3G,
	NetworkGeneration4G,
	NetworkGeneration5G,
	NetworkGenerationUnknown,
}

// makeTitle appends the message to the type
// if message is present.
func makeTitle(t, m string) (typeMessage string) {
	typeMessage = t
	if m != "" {
		typeMessage += GenericPrefix + m
	}
	return
}

type ExceptionUnit struct {
	Type    string `json:"type" binding:"required"`
	Message string `json:"message"`
	Frames  Frames `json:"frames" binding:"required"`
}

type ExceptionUnits []ExceptionUnit

type Thread struct {
	Name   string `json:"name" binding:"required"`
	Frames Frames `json:"frames" binding:"required"`
}

type Threads []Thread

type ANR struct {
	Handled     bool           `json:"handled" binding:"required"`
	Exceptions  ExceptionUnits `json:"exceptions" binding:"required"`
	Threads     Threads        `json:"threads" binding:"required"`
	Fingerprint string         `json:"fingerprint"`
	Foreground  bool           `json:"foreground" binding:"required"`
}

type Exception struct {
	Handled     bool           `json:"handled" binding:"required"`
	Exceptions  ExceptionUnits `json:"exceptions" binding:"required"`
	Threads     Threads        `json:"threads" binding:"required"`
	Fingerprint string         `json:"fingerprint"`
	Foreground  bool           `json:"foreground" binding:"required"`
}

type AppExit struct {
	Reason      string `json:"reason" binding:"required"`
	Importance  string `json:"importance" binding:"required"`
	Trace       string `json:"trace"`
	ProcessName string `json:"process_name" binding:"required"`
	PID         string `json:"pid"`
}

type LogString struct {
	SeverityText string `json:"severity_text"`
	String       string `json:"string" binding:"required"`
}

type GestureLongClick struct {
	Target        string  `json:"target"`
	TargetID      string  `json:"target_id"`
	TouchDownTime uint32  `json:"touch_down_time"`
	TouchUpTime   uint32  `json:"touch_up_time"`
	Width         uint16  `json:"width"`
	Height        uint16  `json:"height"`
	X             float32 `json:"x" binding:"required"`
	Y             float32 `json:"y" binding:"required"`
}

type GestureScroll struct {
	Target        string  `json:"target"`
	TargetID      string  `json:"target_id"`
	TouchDownTime uint32  `json:"touch_down_time"`
	TouchUpTime   uint32  `json:"touch_up_time"`
	X             float32 `json:"x"`
	Y             float32 `json:"y"`
	EndX          float32 `json:"end_x"`
	EndY          float32 `json:"end_y"`
	Direction     string  `json:"direction"`
}

type GestureClick struct {
	Target        string  `json:"target"`
	TargetID      string  `json:"target_id"`
	TouchDownTime uint32  `json:"touch_down_time"`
	TouchUpTime   uint32  `json:"touch_up_time"`
	Width         uint16  `json:"width"`
	Height        uint16  `json:"height"`
	X             float32 `json:"x"`
	Y             float32 `json:"y"`
}

type LifecycleActivity struct {
	Type               string `json:"type" binding:"required"`
	ClassName          string `json:"class_name" binding:"required"`
	Intent             string `json:"intent"`
	SavedInstanceState bool   `json:"saved_instance_state"`
}

type LifecycleFragment struct {
	Type           string `json:"type" binding:"required"`
	ClassName      string `json:"class_name" binding:"required"`
	ParentActivity string `json:"parent_activity"`
	Tag            string `json:"tag"`
}

type LifecycleApp struct {
	Type string `json:"type" binding:"required"`
}

type ColdLaunch struct {
	ProcessStartUptime          uint32        `json:"process_start_uptime"`
	ProcessStartRequestedUptime uint32        `json:"process_start_requested_uptime"`
	ContentProviderAttachUptime uint32        `json:"content_provider_attach_uptime"`
	OnNextDrawUptime            uint32        `json:"on_next_draw_uptime" binding:"required"`
	LaunchedActivity            string        `json:"launched_activity" binding:"required"`
	HasSavedState               bool          `json:"has_saved_state" binding:"required"`
	IntentData                  string        `json:"intent_data"`
	Duration                    time.Duration `json:"duration"`
}

type WarmLaunch struct {
	AppVisibleUptime uint32        `json:"app_visible_uptime"`
	OnNextDrawUptime uint32        `json:"on_next_draw_uptime" binding:"required"`
	LaunchedActivity string        `json:"launched_activity" binding:"required"`
	HasSavedState    bool          `json:"has_saved_state" binding:"required"`
	IntentData       string        `json:"intent_data"`
	Duration         time.Duration `json:"duration"`
}

type HotLaunch struct {
	AppVisibleUptime uint32        `json:"app_visible_uptime"`
	OnNextDrawUptime uint32        `json:"on_next_draw_uptime" binding:"required"`
	LaunchedActivity string        `json:"launched_activity" binding:"required"`
	HasSavedState    bool          `json:"has_saved_state" binding:"required"`
	IntentData       string        `json:"intent_data"`
	Duration         time.Duration `json:"duration"`
}

type NetworkChange struct {
	NetworkType               string `json:"network_type" binding:"required"`
	PreviousNetworkType       string `json:"previous_network_type" binding:"required"`
	NetworkGeneration         string `json:"network_generation" binding:"required"`
	PreviousNetworkGeneration string `json:"previous_network_generation" binding:"required"`
	NetworkProvider           string `json:"network_provider" binding:"required"`
}

type Http struct {
	URL                string            `json:"url"`
	Method             string            `json:"method"`
	StatusCode         uint16            `json:"status_code"`
	StartTime          uint64            `json:"start_time"`
	EndTime            uint64            `json:"end_time"`
	RequestBody        string            `json:"request_body"`
	ResponseBody       string            `json:"response_body"`
	FailureReason      string            `json:"failure_reason"`
	FailureDescription string            `json:"failure_description"`
	RequestHeaders     map[string]string `json:"request_headers"`
	ResponseHeaders    map[string]string `json:"response_headers"`
	Client             string            `json:"client"`
}

type MemoryUsage struct {
	JavaMaxHeap     uint64 `json:"java_max_heap" binding:"required"`
	JavaTotalHeap   uint64 `json:"java_total_heap" binding:"required"`
	JavaFreeHeap    uint64 `json:"java_free_heap" binding:"required"`
	TotalPSS        uint64 `json:"total_pss" binding:"required"`
	RSS             uint64 `json:"rss"`
	NativeTotalHeap uint64 `json:"native_total_heap" binding:"required"`
	NativeFreeHeap  uint64 `json:"native_free_heap" binding:"required"`
	IntervalConfig  uint32 `json:"interval_config" binding:"required"`
}

type LowMemory struct {
	JavaMaxHeap     uint64 `json:"java_max_heap" binding:"required"`
	JavaTotalHeap   uint64 `json:"java_total_heap" binding:"required"`
	JavaFreeHeap    uint64 `json:"java_free_heap" binding:"required"`
	TotalPSS        uint64 `json:"total_pss" binding:"required"`
	RSS             uint64 `json:"rss"`
	NativeTotalHeap uint64 `json:"native_total_heap" binding:"required"`
	NativeFreeHeap  uint64 `json:"native_free_heap" binding:"required"`
}

type TrimMemory struct {
	Level string `json:"level" binding:"required"`
}

type CPUUsage struct {
	NumCores       uint8  `json:"num_cores" binding:"required"`
	ClockSpeed     uint32 `json:"clock_speed" binding:"required"`
	StartTime      uint64 `json:"start_time" binding:"required"`
	Uptime         uint64 `json:"uptime" binding:"required"`
	UTime          uint64 `json:"utime" binding:"required"`
	CUTime         uint64 `json:"cutime" binding:"required"`
	STime          uint64 `json:"stime" binding:"required"`
	CSTime         uint64 `json:"cstime" binding:"required"`
	IntervalConfig uint32 `json:"interval_config" binding:"required"`
}

type Navigation struct {
	From   string `json:"from"`
	To     string `json:"to" binding:"required"`
	Source string `json:"source"`
}

type EventField struct {
	ID                uuid.UUID          `json:"id"`
	IPv4              net.IP             `json:"inet_ipv4"`
	IPv6              net.IP             `json:"inet_ipv6"`
	CountryCode       string             `json:"inet_country_code"`
	AppID             uuid.UUID          `json:"app_id"`
	SessionID         uuid.UUID          `json:"session_id" binding:"required"`
	Timestamp         time.Time          `json:"timestamp" binding:"required"`
	Type              string             `json:"type" binding:"required"`
	UserTriggered     bool               `json:"user_triggered" binding:"required"`
	Attribute         Attribute          `json:"attribute" binding:"required"`
	Attachments       []Attachment       `json:"attachments" binding:"required"`
	ANR               *ANR               `json:"anr,omitempty"`
	Exception         *Exception         `json:"exception,omitempty"`
	AppExit           *AppExit           `json:"app_exit,omitempty"`
	LogString         *LogString         `json:"string,omitempty"`
	GestureLongClick  *GestureLongClick  `json:"gesture_long_click,omitempty"`
	GestureScroll     *GestureScroll     `json:"gesture_scroll,omitempty"`
	GestureClick      *GestureClick      `json:"gesture_click,omitempty"`
	LifecycleActivity *LifecycleActivity `json:"lifecycle_activity,omitempty"`
	LifecycleFragment *LifecycleFragment `json:"lifecycle_fragment,omitempty"`
	LifecycleApp      *LifecycleApp      `json:"lifecycle_app,omitempty"`
	ColdLaunch        *ColdLaunch        `json:"cold_launch,omitempty"`
	WarmLaunch        *WarmLaunch        `json:"warm_launch,omitempty"`
	HotLaunch         *HotLaunch         `json:"hot_launch,omitempty"`
	NetworkChange     *NetworkChange     `json:"network_change,omitempty"`
	Http              *Http              `json:"http,omitempty"`
	MemoryUsage       *MemoryUsage       `json:"memory_usage,omitempty"`
	LowMemory         *LowMemory         `json:"low_memory,omitempty"`
	TrimMemory        *TrimMemory        `json:"trim_memory,omitempty"`
	CPUUsage          *CPUUsage          `json:"cpu_usage,omitempty"`
	Navigation        *Navigation        `json:"navigation,omitempty"`
}

// Compute computes the most accurate cold launch timing
//
// Android reports varied process uptime values over
// varied api levels. Computes as a best effort case
// based on what values are available.
func (cl *ColdLaunch) Compute() {
	uptime := cl.ProcessStartRequestedUptime
	if uptime < 1 {
		uptime = cl.ProcessStartUptime
	}
	if uptime < 1 {
		uptime = cl.ContentProviderAttachUptime
	}

	onNextDrawUptime := cl.OnNextDrawUptime
	cl.Duration = time.Duration(onNextDrawUptime-uptime) * time.Millisecond

	if cl.Duration >= NominalColdLaunchThreshold {
		fmt.Printf(`anomaly in cold_launch duration compute. nominal threshold: < %v . actual value: %f\n`, NominalColdLaunchThreshold, cl.Duration.Seconds())
	}
}

// Compute computes the warm launch duration.
func (wl *WarmLaunch) Compute() {
	wl.Duration = time.Duration(wl.OnNextDrawUptime-wl.AppVisibleUptime) * time.Millisecond
}

// Compute computes the hot launch duration.
func (hl *HotLaunch) Compute() {
	hl.Duration = time.Duration(hl.OnNextDrawUptime-hl.AppVisibleUptime) * time.Millisecond
}

// IsException returns true for
// exception event.
func (e EventField) IsException() bool {
	return e.Type == TypeException
}

// IsUnhandledException returns true
// for unhandled exception event.
func (e EventField) IsUnhandledException() bool {
	return e.Type == TypeException && !e.Exception.Handled
}

// IsANR returns true for anr
// event.
func (e EventField) IsANR() bool {
	return e.Type == TypeANR
}

// IsAppExit returns true for app
// exit event.
func (e EventField) IsAppExit() bool {
	return e.Type == TypeAppExit
}

// IsSring returns true for string
// event.
func (e EventField) IsString() bool {
	return e.Type == TypeString
}

// IsGestureLongClick returns true for
// gesture long click event.
func (e EventField) IsGestureLongClick() bool {
	return e.Type == TypeGestureLongClick
}

// IsGestureScroll returns true for
// gesture scroll event.
func (e EventField) IsGestureScroll() bool {
	return e.Type == TypeGestureScroll
}

// IsGestureClick returns true for
// gesture click event.
func (e EventField) IsGestureClick() bool {
	return e.Type == TypeGestureClick
}

// IsLifecycleActivity returns true for
// lifecycle activity event.
func (e EventField) IsLifecycleActivity() bool {
	return e.Type == TypeLifecycleActivity
}

// IsLifecycleFragment returns true for
// lifecycle fragment event.
func (e EventField) IsLifecycleFragment() bool {
	return e.Type == TypeLifecycleFragment
}

// IsLifecycleApp returns true for
// lifecycle app event.
func (e EventField) IsLifecycleApp() bool {
	return e.Type == TypeLifecycleApp
}

// IsColdLaunch returns true for cold
// launch event.
func (e EventField) IsColdLaunch() bool {
	return e.Type == TypeColdLaunch
}

// IsWarmLaunch returns true for warm
// launch event.
func (e EventField) IsWarmLaunch() bool {
	return e.Type == TypeWarmLaunch
}

// IsHotLaunch returns true for hot
// launch event.
func (e EventField) IsHotLaunch() bool {
	return e.Type == TypeHotLaunch
}

// IsNetworkChange returns true for
// network change event.
func (e EventField) IsNetworkChange() bool {
	return e.Type == TypeNetworkChange
}

// IsHttp returns true for http event.
func (e EventField) IsHttp() bool {
	return e.Type == TypeHttp
}

// IsMemoryUsage returns true for
// memory usage event.
func (e EventField) IsMemoryUsage() bool {
	return e.Type == TypeMemoryUsage
}

// IsTrimMemory returns true for trim
// memory event.
func (e EventField) IsTrimMemory() bool {
	return e.Type == TypeTrimMemory
}

// IsCPUUsage returns true for cpu usage
// event.
func (e EventField) IsCPUUsage() bool {
	return e.Type == TypeCPUUsage
}

// IsLowMemory returns true for low
// memory event.
func (e EventField) IsLowMemory() bool {
	return e.Type == TypeLowMemory
}

// IsNavigation returns true for navigation
// event.
func (e EventField) IsNavigation() bool {
	return e.Type == TypeNavigation
}

// NeedsSymbolication returns true if the event needs
// symbolication, false otherwise.
func (e EventField) NeedsSymbolication() (result bool) {
	result = false

	if e.IsException() || e.IsANR() {
		result = true
		return
	}

	if e.IsAppExit() && len(e.AppExit.Trace) > 0 {
		result = true
		return
	}

	if e.IsLifecycleActivity() && len(e.LifecycleActivity.ClassName) > 0 {
		result = true
		return
	}

	if e.IsColdLaunch() && len(e.ColdLaunch.LaunchedActivity) > 0 {
		result = true
		return
	}

	if e.IsWarmLaunch() && len(e.WarmLaunch.LaunchedActivity) > 0 {
		result = true
		return
	}

	if e.IsHotLaunch() && len(e.HotLaunch.LaunchedActivity) > 0 {
		result = true
		return
	}

	if e.IsLifecycleFragment() {
		hasClassName := len(e.LifecycleFragment.ClassName) > 0
		hasParentActivity := len(e.LifecycleFragment.ParentActivity) > 0
		if hasClassName || hasParentActivity {
			result = true
			return
		}
	}

	return
}

// HasAttachments returns true if the event contains
// at least 1 attachment.
func (e EventField) HasAttachments() bool {
	return len(e.Attachments) > 0
}

// Validate validates the event for data
// integrity.
func (e *EventField) Validate() error {
	validTypes := []string{
		TypeANR, TypeException, TypeAppExit,
		TypeString, TypeGestureLongClick, TypeGestureScroll,
		TypeGestureClick, TypeLifecycleActivity, TypeLifecycleFragment,
		TypeLifecycleApp, TypeColdLaunch, TypeWarmLaunch,
		TypeHotLaunch, TypeNetworkChange, TypeHttp,
		TypeMemoryUsage, TypeLowMemory, TypeTrimMemory,
		TypeCPUUsage, TypeNavigation,
	}

	if !slices.Contains(validTypes, e.Type) {
		return fmt.Errorf(`%q is not a valid type`, `type`)
	}

	if e.ID == uuid.Nil {
		return fmt.Errorf(`%q must be a valid UUID`, `id`)
	}

	if e.AppID == uuid.Nil {
		return fmt.Errorf(`%q must be an app's valid UUID`, `app_id`)
	}

	if len(e.Type) > maxTypeChars {
		return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `type`, maxTypeChars)
	}

	if e.Timestamp.IsZero() {
		return fmt.Errorf(`%q must be a valid ISO 8601 timestamp`, `timestamp`)
	}

	if e.IsANR() {
		if len(e.ANR.Exceptions) < 1 || len(e.ANR.Threads) < 1 {
			return fmt.Errorf(`%q must contain at least one anr & thread`, `anr`)
		}
	}

	if e.IsException() {
		if len(e.Exception.Exceptions) < 1 || len(e.Exception.Threads) < 1 {
			return fmt.Errorf(`%q must contain at least one exception & thread`, `exception`)
		}
	}

	if e.IsAppExit() {
		if len(e.AppExit.Reason) < 1 || len(e.AppExit.Importance) < 1 || len(e.AppExit.ProcessName) < 1 {
			return fmt.Errorf(`%q, %q, %q must not be empty`, `app_exit.reason`, `app_exit.importance`, `app_exit.process_name`)
		}
		if len(e.AppExit.Reason) > maxAppExitReasonChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `app_exit.reason`, maxAppExitReasonChars)
		}
		if len(e.AppExit.Importance) > maxAppExitImportanceChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `app_exit.importance`, maxAppExitImportanceChars)
		}
	}

	if e.IsString() {
		if len(e.LogString.String) < 1 {
			return fmt.Errorf(`%q must not be empty`, `string`)
		}
		if len(e.LogString.SeverityText) > maxSeverityTextChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `string.severity_text`, maxSeverityTextChars)
		}
	}

	if e.IsGestureLongClick() {
		if e.GestureLongClick.X < 0 || e.GestureLongClick.Y < 0 {
			return fmt.Errorf(`%q and %q must contain valid x and y coordinate values`, `gesture_long_click.x`, `gesture_long_click.y`)
		}
		if len(e.GestureLongClick.Target) > maxGestureLongClickTargetChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `gesture_long_click.target`, maxGestureLongClickTargetChars)
		}
		if len(e.GestureLongClick.TargetID) > maxGestureLongClickTargetIDChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `gesture_long_click.target_id`, maxGestureLongClickTargetIDChars)
		}
	}

	if e.IsGestureScroll() {
		if e.GestureScroll.X < 0 || e.GestureScroll.Y < 0 {
			return fmt.Errorf(`%q and %q must contain valid x and y coordinates`, `gesture_scroll.x`, `gesture_scroll.y`)
		}
		if e.GestureScroll.EndX < 0 || e.GestureScroll.EndY < 0 {
			return fmt.Errorf(`%q and %q must contain valid x and y coordinates`, `gesture_scroll.end_x`, `gesture_scroll.end_y`)
		}
		if len(e.GestureScroll.Target) > maxGestureScrollTargetChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `gesture_scroll.target`, maxGestureScrollTargetChars)
		}
		if len(e.GestureScroll.TargetID) > maxGestureScrollTargetIDChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `gesture_scroll.target_id`, maxGestureScrollTargetIDChars)
		}
		if len(e.GestureScroll.Direction) > maxGestureScrollDirectionChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `gesture_scroll.direction`, maxGestureScrollDirectionChars)
		}
	}

	if e.IsGestureClick() {
		if e.GestureClick.X < 0 || e.GestureClick.Y < 0 {
			return fmt.Errorf(`%q and %q must contain valid x and y coordinates`, `gesture_click.x`, `gesture_click.y`)
		}
		if len(e.GestureClick.Target) > maxGestureClickTargetChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `gesture_click.target`, maxGestureClickTargetChars)
		}
		if len(e.GestureClick.TargetID) > maxGestureClickTargetIDChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `gesture_click.target_id`, maxGestureClickTargetIDChars)
		}
	}

	if e.IsLifecycleActivity() {
		if e.LifecycleActivity.Type == "" || e.LifecycleActivity.ClassName == "" {
			return fmt.Errorf(`%q & %q must not be empty`, `lifecycle_activity.type`, `lifecycle_activity.class_name`)
		}
		if len(e.LifecycleActivity.Type) > maxLifecycleActivityTypeChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `lifecycle_activity.type`, maxLifecycleActivityTypeChars)
		}
		if len(e.LifecycleActivity.ClassName) > maxLifecycleActivityClassNameChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `lifecycle_activity.class_name`, maxLifecycleActivityClassNameChars)
		}
		if !slices.Contains(ValidLifecycleActivityTypes, e.LifecycleActivity.Type) {
			return fmt.Errorf(`%q contains invalid lifecycle activity type`, `lifecycle_activity.type`)
		}
	}

	if e.IsLifecycleFragment() {
		if e.LifecycleFragment.Type == "" || e.LifecycleFragment.ClassName == "" {
			return fmt.Errorf(`%q and %q must not be empty`, `lifecycle_fragment.type`, `lifecycle_fragment.class_name`)
		}
		if len(e.LifecycleFragment.Type) > maxLifecycleFragmentTypeChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `lifecycle_fragment.type`, maxLifecycleFragmentTypeChars)
		}
		if len(e.LifecycleFragment.ClassName) > maxLifecycleFragmentClassNameChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `lifecycle_fragment.class_name`, maxLifecycleFragmentClassNameChars)
		}
		if len(e.LifecycleFragment.ParentActivity) > maxLifecycleFragmentClassNameChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `lifecycle_fragment.parent_activity`, maxLifecycleFragmentClassNameChars)
		}
		if !slices.Contains(ValidLifecycleFragmentTypes, e.LifecycleFragment.Type) {
			return fmt.Errorf(`%q contains invalid lifecycle fragment type`, `lifecycle_fragment.type`)
		}
	}

	if e.IsLifecycleApp() {
		if e.LifecycleApp.Type == "" {
			return fmt.Errorf(`%q must not be empty`, `lifecycle_app.type`)
		}
		if len(e.LifecycleApp.Type) > maxLifecycleAppTypeChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `lifecycle_app.type`, maxLifecycleAppTypeChars)
		}
		if !slices.Contains(ValidLifecycleAppTypes, e.LifecycleApp.Type) {
			return fmt.Errorf(`%q contains invalid lifecycle app type`, `lifecycle_app.type`)
		}
	}

	if e.IsColdLaunch() {
		if e.ColdLaunch.ProcessStartUptime <= 0 && e.ColdLaunch.ContentProviderAttachUptime <= 0 && e.ColdLaunch.ProcessStartRequestedUptime <= 0 {
			return fmt.Errorf(`one of %q, %q, or %q must be greater than 0`, `cold_launch.process_start_uptime`, `cold_launch.process_start_requested_uptime`, `cold_launch.content_provider_attach_uptime`)
		}
		if e.ColdLaunch.OnNextDrawUptime <= 0 {
			return fmt.Errorf(`%q must be greater than 0`, `cold_launch.on_next_draw_uptime`)
		}
		if e.ColdLaunch.LaunchedActivity == "" {
			return fmt.Errorf(`%q must not be empty`, `cold_launch.launched_activity`)
		}
		if len(e.ColdLaunch.LaunchedActivity) >= maxColdLaunchLaunchedActivityChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `cold_launch.launched_activity`, maxColdLaunchLaunchedActivityChars)
		}
	}

	if e.IsWarmLaunch() {
		if e.WarmLaunch.AppVisibleUptime <= 0 {
			return fmt.Errorf(`%q must be greater than 0`, `warm_launch.app_visible_uptime`)
		}
		if e.WarmLaunch.OnNextDrawUptime <= 0 {
			return fmt.Errorf(`%q must be greater than 0`, `warm_launch.on_next_draw_uptime`)
		}
		if e.WarmLaunch.LaunchedActivity == "" {
			return fmt.Errorf(`%q must not be empty`, `warm_launch.launched_activity`)
		}
		if len(e.WarmLaunch.LaunchedActivity) >= maxWarmLaunchLaunchedActivityChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `warm_launch.launched_activity`, maxWarmLaunchLaunchedActivityChars)
		}
	}

	if e.IsHotLaunch() {
		if e.HotLaunch.AppVisibleUptime <= 0 {
			return fmt.Errorf(`%q must be greater than 0`, `hot_launch.app_visible_uptime`)
		}
		if e.HotLaunch.OnNextDrawUptime <= 0 {
			return fmt.Errorf(`%q must be greater than 0`, `hot_launch.on_next_draw_uptime`)
		}
		if e.HotLaunch.LaunchedActivity == "" {
			return fmt.Errorf(`%q must not be empty`, `hot_launch.launched_activity`)
		}
		if len(e.HotLaunch.LaunchedActivity) >= maxHotLaunchLaunchedActivityChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `hot_launch.launched_activity`, maxHotLaunchLaunchedActivityChars)
		}
	}

	if e.IsNetworkChange() {
		if e.NetworkChange.NetworkType == "" {
			return fmt.Errorf(`%q must not be empty`, `network_change.network_type`)
		}
		if len(e.NetworkChange.NetworkType) >= maxNetworkChangeNetworkTypeChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `network_change.network_type`, maxNetworkChangeNetworkTypeChars)
		}
		if e.NetworkChange.PreviousNetworkType == "" {
			return fmt.Errorf(`%q must not be empty`, `network_change.previous_network_type`)
		}
		if len(e.NetworkChange.PreviousNetworkType) >= maxNetworkChangePreviousNetworkTypeChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `network_change.previous_network_type`, maxNetworkChangePreviousNetworkTypeChars)
		}
		if e.NetworkChange.NetworkGeneration == "" {
			return fmt.Errorf(`%q must not be empty`, `network_change.network_generation`)
		}
		if len(e.NetworkChange.NetworkGeneration) >= maxNetworkChangeNetworkGeneration {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `network_change.network_generation`, maxNetworkChangeNetworkGeneration)
		}
		if e.NetworkChange.PreviousNetworkGeneration == "" {
			return fmt.Errorf(`%q must not be empty`, `network_change.previous_network_generation`)
		}
		if len(e.NetworkChange.PreviousNetworkGeneration) >= maxNetworkChangePreviousNetworkGeneration {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `network_change.previous_network_generation`, maxNetworkChangePreviousNetworkGeneration)
		}
		if e.NetworkChange.NetworkProvider == "" {
			return fmt.Errorf(`%q must not be empty`, `network_change.network_provider`)
		}
		if len(e.NetworkChange.NetworkProvider) >= maxNetworkChangeNetworkProvider {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `network_change.network_provider`, maxNetworkChangeNetworkProvider)
		}
		if !slices.Contains(ValidNetworkTypes, e.NetworkChange.NetworkType) {
			return fmt.Errorf(`%q contains invalid network type`, `network_change.network_type`)
		}
		if !slices.Contains(ValidNetworkGenerations, e.NetworkChange.NetworkGeneration) {
			return fmt.Errorf(`%q contains invalid network geenration`, `network_change.network_generation`)
		}
		if !slices.Contains(ValidNetworkTypes, e.NetworkChange.PreviousNetworkType) {
			return fmt.Errorf(`%q contains invalid network type`, `network_change.previous_network_type`)
		}
		if !slices.Contains(ValidNetworkGenerations, e.NetworkChange.PreviousNetworkGeneration) {
			return fmt.Errorf(`%q contains invalid network geenration`, `network_change.previous_network_generation`)
		}
	}

	if e.IsHttp() {
		if e.Http.URL == "" {
			return fmt.Errorf(`%q must not be empty`, `http.url`)
		}
		if e.Http.Method == "" {
			return fmt.Errorf(`%q must not be empty`, `http.method`)
		}
		if len(e.Http.Method) > maxHttpMethodChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `http.method`, maxHttpMethodChars)
		}
		if len(e.Http.Client) > maxHttpClientChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `http.client`, maxHttpClientChars)
		}
	}

	if e.IsMemoryUsage() {
		if e.MemoryUsage.IntervalConfig <= 0 {
			return fmt.Errorf(`%q must be greater than 0`, `memory_usage.interval_config`)
		}
	}

	if e.IsTrimMemory() {
		if e.TrimMemory.Level == "" {
			return fmt.Errorf(`%q must not be empty`, `trim_memory.level`)
		}
		if len(e.TrimMemory.Level) > maxTrimMemoryLevelChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `trim_memory.level`, maxTrimMemoryLevelChars)
		}
	}

	if e.IsCPUUsage() {
		if e.CPUUsage.NumCores <= 0 {
			return fmt.Errorf(`%q must be greater than 0`, `cpu_usage.num_cores`)
		}
		if e.CPUUsage.ClockSpeed <= 0 {
			return fmt.Errorf(`%q must be greater than 0`, `cpu_usage.clock_speed`)
		}
		if e.CPUUsage.IntervalConfig <= 0 {
			return fmt.Errorf(`%q must be greater than 0`, `cpu_usage.interval_config`)
		}
	}

	if e.IsNavigation() {
		if len(e.Navigation.To) > maxNavigationToChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `navigation.to`, maxNavigationToChars)
		}
		if len(e.Navigation.From) > maxNavigationFromChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `navigation.from`, maxNavigationFromChars)
		}
		if len(e.Navigation.Source) > maxNavigationSourceChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `navigation.source`, maxNavigationSourceChars)
		}
	}

	return nil
}

// IsNested returns true in case of
// multiple nested exceptions.
func (e Exception) IsNested() bool {
	return len(e.Exceptions) > 1
}

// GetTitle provides the combined
// exception's type and message as
// a formatted string.
func (e Exception) GetTitle() string {
	return makeTitle(e.GetType(), e.GetMessage())
}

// GetType provides the type of
// the exception.
func (e Exception) GetType() string {
	return e.Exceptions[len(e.Exceptions)-1].Type
}

// GetMessage provides the message of
// the exception.
func (e Exception) GetMessage() string {
	return e.Exceptions[len(e.Exceptions)-1].Message
}

// GetFileName provides the file name of
// the exception.
func (e Exception) GetFileName() string {
	return e.Exceptions[len(e.Exceptions)-1].Frames[0].FileName
}

// GetLineNumber provides the line number of
// the exception.
func (e Exception) GetLineNumber() int {
	return e.Exceptions[len(e.Exceptions)-1].Frames[0].LineNum
}

// GetMethodName provides the method name of
// the Exception.
func (e Exception) GetMethodName() string {
	return e.Exceptions[len(e.Exceptions)-1].Frames[0].MethodName
}

// GetDisplayTitle provides a user friendly display
// name for the exception.
func (e Exception) GetDisplayTitle() string {
	return e.GetType() + "@" + e.GetFileName()
}

// Stacktrace writes a formatted stacktrace
// from the exception.
func (e Exception) Stacktrace() string {
	var b strings.Builder

	for i := len(e.Exceptions) - 1; i >= 0; i-- {
		firstException := i == len(e.Exceptions)-1
		lastException := i == 0
		exType := e.Exceptions[i].Type
		message := e.Exceptions[i].Message
		hasFrames := len(e.Exceptions[i].Frames) > 0

		title := makeTitle(exType, message)

		if firstException {
			b.WriteString(title)
		} else if e.IsNested() {
			prevType := e.Exceptions[i+1].Type
			prevMsg := e.Exceptions[i+1].Message
			title := makeTitle(prevType, prevMsg)
			b.WriteString("Caused by" + GenericPrefix + title)
		}

		if hasFrames {
			b.WriteString("\n")
		}

		for j := range e.Exceptions[i].Frames {
			lastFrame := j == len(e.Exceptions[i].Frames)-1
			frame := e.Exceptions[i].Frames[j].String()
			b.WriteString(FramePrefix + frame)
			if !lastFrame || !lastException {
				b.WriteString("\n")
			}
		}
	}

	return b.String()
}

// ComputeExceptionFingerprint computes a fingerprint
// from the exception data.
func (e *Exception) ComputeExceptionFingerprint() (err error) {
	if len(e.Exceptions) == 0 {
		return fmt.Errorf("error computing exception fingerprint: no exceptions found")
	}

	// Get the innermost exception
	innermostException := e.Exceptions[len(e.Exceptions)-1]

	// Get the exception type
	exceptionType := innermostException.Type

	// Initialize fingerprint data with the exception type
	fingerprintData := exceptionType

	// Get the method name and file name from the first frame of the innermost exception
	if len(innermostException.Frames) > 0 {
		methodName := innermostException.Frames[0].MethodName
		fileName := innermostException.Frames[0].FileName

		// Include any non-empty information
		if methodName != "" {
			fingerprintData += ":" + methodName
		}
		if fileName != "" {
			fingerprintData += ":" + fileName
		}
	}

	// Compute the fingerprint
	e.Fingerprint = computeFingerprint(fingerprintData)

	return nil
}

// IsNested returns true in case of
// multiple nested ANRs.
func (a ANR) IsNested() bool {
	return len(a.Exceptions) > 1
}

// GetTitle provides the combined
// anr's type and message as a
// formatted string.
func (a ANR) GetTitle() string {
	return makeTitle(a.GetType(), a.GetMessage())
}

// GetType provides the type of
// the ANR.
func (a ANR) GetType() string {
	return a.Exceptions[len(a.Exceptions)-1].Type
}

// GetMessage provides the message of
// the ANR.
func (a ANR) GetMessage() string {
	return a.Exceptions[len(a.Exceptions)-1].Message
}

// GetFileName provides the file name of
// the ANR.
func (a ANR) GetFileName() string {
	return a.Exceptions[len(a.Exceptions)-1].Frames[0].FileName
}

// GetLineNumber provides the line number of
// the ANR.
func (a ANR) GetLineNumber() int {
	return a.Exceptions[len(a.Exceptions)-1].Frames[0].LineNum
}

// GetMethodName provides the method name of
// the ANR.
func (a ANR) GetMethodName() string {
	return a.Exceptions[len(a.Exceptions)-1].Frames[0].MethodName
}

// GetDisplayTitle provides a user friendly display
// name for the ANR.
func (a ANR) GetDisplayTitle() string {
	return a.GetType() + "@" + a.GetFileName()
}

// Stacktrace writes a formatted stacktrace
// from the ANR.
func (a ANR) Stacktrace() string {
	var b strings.Builder

	for i := len(a.Exceptions) - 1; i >= 0; i-- {
		firstException := i == len(a.Exceptions)-1
		lastException := i == 0
		exType := a.Exceptions[i].Type
		message := a.Exceptions[i].Message
		hasFrames := len(a.Exceptions[i].Frames) > 0

		title := makeTitle(exType, message)

		if firstException {
			b.WriteString(title)
		} else if a.IsNested() {
			prevType := a.Exceptions[i+1].Type
			prevMsg := a.Exceptions[i+1].Message
			title := makeTitle(prevType, prevMsg)
			b.WriteString("Caused by" + GenericPrefix + title)
		}

		if hasFrames {
			b.WriteString("\n")
		}

		for j := range a.Exceptions[i].Frames {
			lastFrame := j == len(a.Exceptions[i].Frames)-1
			frame := a.Exceptions[i].Frames[j].String()
			b.WriteString(FramePrefix + frame)
			if !lastFrame || !lastException {
				b.WriteString("\n")
			}
		}
	}

	return b.String()
}

// ComputeANRFingerprint computes a fingerprint
// from the ANR data.
func (a *ANR) ComputeANRFingerprint() (err error) {
	if len(a.Exceptions) == 0 {
		return fmt.Errorf("error computing ANR fingerprint: no exceptions found")
	}

	// Get the innermost exception
	innermostException := a.Exceptions[len(a.Exceptions)-1]

	// Get the exception type
	exceptionType := innermostException.Type

	// Initialize fingerprint data with the exception type
	fingerprintData := exceptionType

	// Get the method name and file name from the first frame of the innermost exception
	if len(innermostException.Frames) > 0 {
		methodName := innermostException.Frames[0].MethodName
		fileName := innermostException.Frames[0].FileName

		// Include any non-empty information
		if methodName != "" {
			fingerprintData += ":" + methodName
		}
		if fileName != "" {
			fingerprintData += ":" + fileName
		}
	}

	// Compute the fingerprint
	a.Fingerprint = computeFingerprint(fingerprintData)

	return nil
}

func computeFingerprint(data string) string {
	hash := md5.Sum([]byte(data))
	return hex.EncodeToString(hash[:])
}
