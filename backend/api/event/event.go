package event

import (
	"backend/api/platform"
	"crypto/md5"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"regexp"
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
	maxLifecycleViewControllerTypeChars       = 32
	maxLifecycleViewControllerClassNameChars  = 256
	maxLifecycleSwiftUITypeChars              = 32
	maxLifecycleSwiftUIClassNameChars         = 128
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
	maxScreenViewNameChars                    = 128
	maxUserDefAttrsCount                      = 100
	maxUserDefAttrsKeyChars                   = 256
	maxUserDefAttrsValsChars                  = 256
	maxCustomNameChars                        = 64
	customNameKeyPattern                      = "^[a-zA-Z0-9_-]+$"
)

const TypeCustom = "custom"
const TypeANR = "anr"
const TypeException = "exception"
const TypeAppExit = "app_exit"
const TypeString = "string"
const TypeGestureLongClick = "gesture_long_click"
const TypeGestureClick = "gesture_click"
const TypeGestureScroll = "gesture_scroll"
const TypeLifecycleActivity = "lifecycle_activity"
const TypeLifecycleFragment = "lifecycle_fragment"
const TypeLifecycleViewController = "lifecycle_view_controller"
const TypeLifecycleSwiftUI = "lifecycle_swift_ui"
const TypeLifecycleApp = "lifecycle_app"
const TypeColdLaunch = "cold_launch"
const TypeWarmLaunch = "warm_launch"
const TypeHotLaunch = "hot_launch"
const TypeNetworkChange = "network_change"
const TypeHttp = "http"
const TypeMemoryUsage = "memory_usage"
const TypeMemoryUsageAbs = "memory_usage_absolute"
const TypeLowMemory = "low_memory"
const TypeTrimMemory = "trim_memory"
const TypeCPUUsage = "cpu_usage"
const TypeNavigation = "navigation"
const TypeScreenView = "screen_view"

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

const LifecycleViewControllerTypeLoadView = "loadView"
const LifecycleViewControllerTypeViewDidLoad = "viewDidLoad"
const LifecycleViewControllerTypeViewWillAppear = "viewWillAppear"
const LifecycleViewControllerTypeViewDidAppear = "viewDidAppear"
const LifecycleViewControllerTypeViewWillDisappear = "viewWillDisappear"
const LifecycleViewControllerTypeViewDidDisappear = "viewDidDisappear"
const LifecycleViewControllerTypeDidReceiveMemoryWarning = "didReceiveMemoryWarning"
const LifecycleViewControllerTypeInitWithDbName = "initWithDbName"
const LifecycleViewControllerTypeInitWithCoder = "initWithCoder"
const LifecycleViewControllerTypeVCDeinit = "vcDeinit"

const LifecycleSwiftUITypeOnAppear = "on_appear"
const LifecycleSwiftUITypeOnDisappear = "on_disappear"

const LifecycleAppTypeBackground = "background"
const LifecycleAppTypeForeground = "foreground"

// LifecycleAppTypeTerminated is used only for iOS
const LifecycleAppTypeTerminated = "terminated"

// NominalColdLaunchThreshold defines the upper bound
// of a nominal cold launch duration.
const NominalColdLaunchThreshold = 30 * time.Second

// NominalWarmLaunchThreshold defines the upper bound
// of a nominal warm launch duration.
const NominalWarmLaunchThreshold = 10 * time.Second

// androidValidTypes defines a whitelist for all
// valid android event types.
var androidValidTypes = []string{
	TypeANR, TypeException, TypeAppExit,
	TypeGestureLongClick, TypeGestureScroll, TypeGestureClick,
	TypeLifecycleActivity, TypeLifecycleFragment,
	TypeLifecycleViewController, TypeLifecycleSwiftUI,
	TypeLifecycleApp,
	TypeColdLaunch, TypeWarmLaunch, TypeHotLaunch,
	TypeNetworkChange, TypeHttp,
	TypeMemoryUsage, TypeMemoryUsageAbs, TypeLowMemory, TypeTrimMemory,
	TypeCPUUsage, TypeNavigation, TypeScreenView,
	TypeString,
	TypeCustom,
}

// iOSValidTypes defines a whitelist for all
// valid iOS event types.
var iOSValidTypes = []string{
	TypeException,
	TypeGestureLongClick, TypeGestureScroll, TypeGestureClick,
	TypeLifecycleViewController, TypeLifecycleSwiftUI,
	TypeLifecycleApp,
	TypeColdLaunch, TypeWarmLaunch, TypeHotLaunch,
	TypeNetworkChange, TypeHttp,
	TypeMemoryUsageAbs,
	TypeCPUUsage,
	TypeScreenView,
	TypeString,
	TypeCustom,
}

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

// ValidLifecycleViewControllerTypes defines allowed
// `lifecycle_view_controller.type` values.
var ValidLifecycleViewControllerTypes = []string{
	LifecycleViewControllerTypeLoadView,
	LifecycleViewControllerTypeViewDidLoad,
	LifecycleViewControllerTypeViewWillAppear,
	LifecycleViewControllerTypeViewDidAppear,
	LifecycleViewControllerTypeViewWillDisappear,
	LifecycleViewControllerTypeViewDidDisappear,
	LifecycleViewControllerTypeDidReceiveMemoryWarning,
	LifecycleViewControllerTypeInitWithDbName,
	LifecycleViewControllerTypeInitWithCoder,
	LifecycleViewControllerTypeVCDeinit,
}

// ValidLifecycleSwiftUITypes defines allowed
// `lifecycle_swift_ui.type` values.
var ValidLifecycleSwiftUITypes = []string{
	LifecycleSwiftUITypeOnAppear,
	LifecycleSwiftUITypeOnDisappear,
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

// getValidLifecycleAppTypes defines valid
// `lifecycle_app.type` values according
// to the platform.
func getValidLifecycleAppTypes(p string) (types []string) {
	switch p {
	case platform.Android:
		types = []string{
			LifecycleAppTypeBackground,
			LifecycleAppTypeForeground,
		}
	case platform.IOS:
		types = []string{
			LifecycleAppTypeBackground,
			LifecycleAppTypeForeground,
			LifecycleAppTypeTerminated,
		}
	}

	return types
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

// ExceptionUnitiOS represents iOS specific
// structure to work with iOS exceptions.
type ExceptionUnitiOS struct {
	// Signal is the BSD termination signal.
	Signal string `json:"signal" binding:"required"`
	// ThreadName is the name of the thread.
	ThreadName string `json:"thread_name" binding:"required"`
	// ThreadSequence is the order of the thread
	// in the iOS exception.
	ThreadSequence uint `json:"thread_sequence" binding:"required"`
	// OSBuildNumber is the operating system's
	// build number.
	OSBuildNumber string `json:"os_build_number" binding:"required"`
}

// ExceptionUnit represents a cross-platform
// structure to work with parts of an exception.
type ExceptionUnit struct {
	// Type is the type of the exception.
	Type string `json:"type" binding:"required"`
	// Message is the exception's message.
	Message string `json:"message"`
	// Frames is a collection of exception's frames.
	Frames Frames `json:"frames" binding:"required"`
	ExceptionUnitiOS
}

type ExceptionUnits []ExceptionUnit

// ThreadiOS represents iOS specific structure
// to work with iOS exceptions.
type ThreadiOS struct {
	Sequence uint `json:"sequence"`
}

// Thread represents a cross-platform
// structure to work with exception threads.
type Thread struct {
	// Name is the name of the thread.
	Name string `json:"name" binding:"required"`
	// Frames is the collection of stackframe objects.
	Frames Frames `json:"frames" binding:"required"`
	ThreadiOS
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

// FingerprintComputer describes the behavior
// to compute a unique fingerprint of any
// underlying structure.
type FingerprintComputer interface {
	ComputeFingerprint() error
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
	TouchDownTime uint64  `json:"touch_down_time"`
	TouchUpTime   uint64  `json:"touch_up_time"`
	Width         uint16  `json:"width"`
	Height        uint16  `json:"height"`
	X             float32 `json:"x" binding:"required"`
	Y             float32 `json:"y" binding:"required"`
}

type GestureScroll struct {
	Target        string  `json:"target"`
	TargetID      string  `json:"target_id"`
	TouchDownTime uint64  `json:"touch_down_time"`
	TouchUpTime   uint64  `json:"touch_up_time"`
	X             float32 `json:"x"`
	Y             float32 `json:"y"`
	EndX          float32 `json:"end_x"`
	EndY          float32 `json:"end_y"`
	Direction     string  `json:"direction"`
}

type GestureClick struct {
	Target        string  `json:"target"`
	TargetID      string  `json:"target_id"`
	TouchDownTime uint64  `json:"touch_down_time"`
	TouchUpTime   uint64  `json:"touch_up_time"`
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
	ParentFragment string `json:"parent_fragment"`
	Tag            string `json:"tag"`
}

type LifecycleViewController struct {
	Type      string `json:"type" binding:"required"`
	ClassName string `json:"class_name" binding:"required"`
}

type LifecycleSwiftUI struct {
	Type      string `json:"type" binding:"required"`
	ClassName string `json:"class_name" binding:"required"`
}

type LifecycleApp struct {
	Type string `json:"type" binding:"required"`
}

type ColdLaunch struct {
	ProcessStartUptime          uint64        `json:"process_start_uptime"`
	ProcessStartRequestedUptime uint64        `json:"process_start_requested_uptime"`
	ContentProviderAttachUptime uint64        `json:"content_provider_attach_uptime"`
	OnNextDrawUptime            uint64        `json:"on_next_draw_uptime" binding:"required"`
	LaunchedActivity            string        `json:"launched_activity" binding:"required"`
	HasSavedState               bool          `json:"has_saved_state" binding:"required"`
	IntentData                  string        `json:"intent_data"`
	Duration                    time.Duration `json:"duration"`
}

type WarmLaunch struct {
	AppVisibleUptime            uint64        `json:"app_visible_uptime"`
	ProcessStartUptime          uint64        `json:"process_start_uptime"`
	ProcessStartRequestedUptime uint64        `json:"process_start_requested_uptime"`
	ContentProviderAttachUptime uint64        `json:"content_provider_attach_uptime"`
	OnNextDrawUptime            uint64        `json:"on_next_draw_uptime" binding:"required"`
	LaunchedActivity            string        `json:"launched_activity" binding:"required"`
	HasSavedState               bool          `json:"has_saved_state" binding:"required"`
	IntentData                  string        `json:"intent_data"`
	Duration                    time.Duration `json:"duration"`
	IsLukewarm                  bool          `json:"is_lukewarm"`
}

type HotLaunch struct {
	AppVisibleUptime uint64        `json:"app_visible_uptime"`
	OnNextDrawUptime uint64        `json:"on_next_draw_uptime" binding:"required"`
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
	Interval        uint64 `json:"interval" binding:"required"`
}

type MemoryUsageAbs struct {
	MaxMemory  uint64 `json:"max_memory" binding:"required"`
	UsedMemory uint64 `json:"used_memory" binding:"required"`
	Interval   uint64 `json:"interval" binding:"required"`
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
	NumCores        uint8   `json:"num_cores" binding:"required"`
	ClockSpeed      uint32  `json:"clock_speed" binding:"required"`
	StartTime       uint64  `json:"start_time" binding:"required"`
	Uptime          uint64  `json:"uptime" binding:"required"`
	UTime           uint64  `json:"utime" binding:"required"`
	CUTime          uint64  `json:"cutime" binding:"required"`
	STime           uint64  `json:"stime" binding:"required"`
	CSTime          uint64  `json:"cstime" binding:"required"`
	Interval        uint64  `json:"interval" binding:"required"`
	PercentageUsage float64 `json:"percentage_usage" binding:"required"`
}

type Navigation struct {
	From   string `json:"from"`
	To     string `json:"to" binding:"required"`
	Source string `json:"source"`
}

type ScreenView struct {
	Name string `json:"name" binding:"required"`
}

type Custom struct {
	Name string `json:"name" binding:"required"`
}

type EventField struct {
	ID                      uuid.UUID                `json:"id"`
	IPv4                    net.IP                   `json:"inet_ipv4"`
	IPv6                    net.IP                   `json:"inet_ipv6"`
	CountryCode             string                   `json:"inet_country_code"`
	AppID                   uuid.UUID                `json:"app_id"`
	SessionID               uuid.UUID                `json:"session_id" binding:"required"`
	Timestamp               time.Time                `json:"timestamp" binding:"required"`
	Type                    string                   `json:"type" binding:"required"`
	UserTriggered           bool                     `json:"user_triggered" binding:"required"`
	Attribute               Attribute                `json:"attribute" binding:"required"`
	UserDefinedAttribute    UDAttribute              `json:"user_defined_attribute" binding:"required"`
	Attachments             []Attachment             `json:"attachments" binding:"required"`
	ANR                     *ANR                     `json:"anr,omitempty"`
	Exception               *Exception               `json:"exception,omitempty"`
	AppExit                 *AppExit                 `json:"app_exit,omitempty"`
	LogString               *LogString               `json:"string,omitempty"`
	GestureLongClick        *GestureLongClick        `json:"gesture_long_click,omitempty"`
	GestureScroll           *GestureScroll           `json:"gesture_scroll,omitempty"`
	GestureClick            *GestureClick            `json:"gesture_click,omitempty"`
	LifecycleActivity       *LifecycleActivity       `json:"lifecycle_activity,omitempty"`
	LifecycleFragment       *LifecycleFragment       `json:"lifecycle_fragment,omitempty"`
	LifecycleViewController *LifecycleViewController `json:"lifecycle_view_controller,omitempty"`
	LifecycleSwiftUI        *LifecycleSwiftUI        `json:"lifecycle_swift_ui,omitempty"`
	LifecycleApp            *LifecycleApp            `json:"lifecycle_app,omitempty"`
	ColdLaunch              *ColdLaunch              `json:"cold_launch,omitempty"`
	WarmLaunch              *WarmLaunch              `json:"warm_launch,omitempty"`
	HotLaunch               *HotLaunch               `json:"hot_launch,omitempty"`
	NetworkChange           *NetworkChange           `json:"network_change,omitempty"`
	Http                    *Http                    `json:"http,omitempty"`
	MemoryUsage             *MemoryUsage             `json:"memory_usage,omitempty"`
	MemoryUsageAbs          *MemoryUsageAbs          `json:"memory_usage_absolute,omitempty"`
	LowMemory               *LowMemory               `json:"low_memory,omitempty"`
	TrimMemory              *TrimMemory              `json:"trim_memory,omitempty"`
	CPUUsage                *CPUUsage                `json:"cpu_usage,omitempty"`
	Navigation              *Navigation              `json:"navigation,omitempty"`
	ScreenView              *ScreenView              `json:"screen_view,omitempty"`
	Custom                  *Custom                  `json:"custom,omitempty"`
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
}

// Compute computes the warm launch duration.
//
// Warm launch duration is only calculated for non-lukewarm
// launches that have a valid app visible uptime.
func (wl *WarmLaunch) Compute() {
	if wl.IsLukewarm {
		wl.Duration = 0
		return
	}

	if wl.AppVisibleUptime > 0 {
		wl.Duration = time.Duration(wl.OnNextDrawUptime-wl.AppVisibleUptime) * time.Millisecond
		return
	}

	// for non-lukewarm launches that do not
	// have valid app visible uptime
	wl.Duration = 0
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

// IsCustom returns true for custom
// event.
func (e EventField) IsCustom() bool {
	return e.Type == TypeCustom
}

// IsANR returns true for ANR
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

// IsLifecycleViewController returns true for
// lifecycle view controller event.
func (e EventField) IsLifecycleViewController() bool {
	return e.Type == TypeLifecycleViewController
}

// IsLifecycleSwiftUI returns true for lifecycle
// swift ui event.
func (e EventField) IsLifecycleSwiftUI() bool {
	return e.Type == TypeLifecycleSwiftUI
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

// IsMemoryUsageAbs returns true for
// memory usage absolute event.
func (e EventField) IsMemoryUsageAbs() bool {
	return e.Type == TypeMemoryUsageAbs
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

// IsScreenView returns true for screen
// view event.
func (e EventField) IsScreenView() bool {
	return e.Type == TypeScreenView
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
		hasParentFragment := len(e.LifecycleFragment.ParentFragment) > 0

		if hasClassName || hasParentActivity || hasParentFragment {
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
	switch e.Attribute.Platform {
	case platform.Android:
		if !slices.Contains(androidValidTypes, e.Type) {
			return fmt.Errorf(`%q is not a valid event type for Android`, e.Type)
		}
	case platform.IOS:
		if !slices.Contains(iOSValidTypes, e.Type) {
			return fmt.Errorf(`%q is not a valid event type for iOS`, e.Type)
		}
	default:
		return fmt.Errorf(`%q is not a valid platform value`, e.Attribute.Platform)
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
		if len(e.LifecycleFragment.ParentFragment) > maxLifecycleFragmentClassNameChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `lifecycle_fragment.parent_fragment`, maxLifecycleFragmentClassNameChars)
		}
		if !slices.Contains(ValidLifecycleFragmentTypes, e.LifecycleFragment.Type) {
			return fmt.Errorf(`%q contains invalid lifecycle fragment type`, `lifecycle_fragment.type`)
		}
	}

	if e.IsLifecycleViewController() {
		if e.LifecycleViewController.Type == "" || e.LifecycleViewController.ClassName == "" {
			return fmt.Errorf(`%q and %q must not be empty`, `lifecycle_view_controller.type`, `lifecycle_view_controller.class_name`)
		}
		if len(e.LifecycleViewController.Type) > maxLifecycleViewControllerTypeChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `lifecycle_view_controller.type`, maxLifecycleViewControllerTypeChars)
		}
		if len(e.LifecycleViewController.ClassName) > maxLifecycleViewControllerClassNameChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `lifecycle_view_controller.class_name`, maxLifecycleViewControllerClassNameChars)
		}
		if !slices.Contains(ValidLifecycleViewControllerTypes, e.LifecycleViewController.Type) {
			return fmt.Errorf(`%q contains invalid lifecycle view controller type %q`, `lifecycle_view_controller.type`, e.LifecycleViewController.Type)
		}
	}

	if e.IsLifecycleSwiftUI() {
		if e.LifecycleSwiftUI.Type == "" || e.LifecycleSwiftUI.ClassName == "" {
			return fmt.Errorf(`%q and %q must not be empty`, `lifecycle_swift_ui.type`, `lifecycle_swift_ui.class_name`)
		}
		if len(e.LifecycleSwiftUI.Type) > maxLifecycleSwiftUITypeChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `lifecycle_swift_ui.type`, maxLifecycleSwiftUITypeChars)
		}
		if len(e.LifecycleSwiftUI.ClassName) > maxLifecycleSwiftUIClassNameChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `lifecycle_swift_ui.class_name`, maxLifecycleSwiftUIClassNameChars)
		}
		if !slices.Contains(ValidLifecycleSwiftUITypes, e.LifecycleSwiftUI.Type) {
			return fmt.Errorf(`%q contains invalid lifecycle swift ui type %q`, `lifecycle_swift_ui.type`, e.LifecycleSwiftUI.Type)
		}
	}

	if e.IsLifecycleApp() {
		if e.LifecycleApp.Type == "" {
			return fmt.Errorf(`%q must not be empty`, `lifecycle_app.type`)
		}
		if len(e.LifecycleApp.Type) > maxLifecycleAppTypeChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `lifecycle_app.type`, maxLifecycleAppTypeChars)
		}

		validTypes := getValidLifecycleAppTypes(e.Attribute.Platform)

		if !slices.Contains(validTypes, e.LifecycleApp.Type) {
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

	if e.IsScreenView() {
		if len(e.ScreenView.Name) > maxScreenViewNameChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `screen_view.name`, maxScreenViewNameChars)
		}
	}

	if e.IsCustom() {
		if len(e.Custom.Name) > maxCustomNameChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `custom.name`, maxTypeChars)
		}

		re := regexp.MustCompile(customNameKeyPattern)
		if !re.MatchString(e.Custom.Name) {
			return fmt.Errorf("%q custom event name must match this regular expression pattern %q", `custom.name`, customNameKeyPattern)
		}
	}

	return nil
}

// GetPlatform determines the exception belongs
// to which platform.
func (e Exception) GetPlatform() (p string) {
	p = platform.Unknown
	if len(e.Exceptions) < 1 || len(e.Threads) < 1 {
		return p
	}

	// Might be possible to detect the platform
	// in a more robust manner
	//
	// FIXME: Revisit the heuristics for platform
	// determination
	if e.Exceptions[0].Signal != "" && e.Threads[0].Sequence != 0 {
		p = platform.IOS
	} else {
		p = platform.Android
	}

	return
}

// IsNested returns true in case of
// multiple nested exceptions.
func (e Exception) IsNested() bool {
	return len(e.Exceptions) > 1
}

// HasNoFrames returns true if the exception
// does not have any frame.
//
// This may happen
// for certain OutOfMemory stacktraces in
// Android.
func (e Exception) HasNoFrames() bool {
	return len(e.Exceptions[len(e.Exceptions)-1].Frames) == 0
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
	// some exception may have zero frames
	if e.HasNoFrames() {
		return ""
	}
	return e.Exceptions[len(e.Exceptions)-1].Frames[0].FileName
}

// GetLineNumber provides the line number of
// the exception.
func (e Exception) GetLineNumber() int {
	// some exception may have zero frames
	if e.HasNoFrames() {
		return 0
	}
	return e.Exceptions[len(e.Exceptions)-1].Frames[0].LineNum
}

// GetMethodName provides the method name of
// the Exception.
func (e Exception) GetMethodName() string {
	// some exception may have zero frames
	if e.HasNoFrames() {
		return ""
	}
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

// ComputeFingerprint computes a fingerprint
// for the exception.
func (e *Exception) ComputeFingerprint() (err error) {
	if len(e.Exceptions) == 0 {
		return errors.New("error computing exception fingerprint: no exceptions found")
	}

	// input holds the raw input to
	// compute the fingerprint
	input := ""

	// sep is the separator to separate
	// parts of the input
	sep := ":"

	switch e.GetPlatform() {
	case platform.Android:
		// get the innermost exception
		innermostException := e.Exceptions[len(e.Exceptions)-1]

		// initialize fingerprint data with the exception type
		input = innermostException.Type

		// get the method name and file name from the first frame of the innermost exception
		if len(innermostException.Frames) > 0 {
			methodName := innermostException.Frames[0].MethodName
			fileName := innermostException.Frames[0].FileName

			// Include any non-empty information
			if methodName != "" {
				input += sep + methodName
			}
			if fileName != "" {
				input += sep + fileName
			}
		}
	case platform.IOS:
		// get the first exception unit
		// FIXME: might need to use ThreadSequence here
		firstUnit := e.Exceptions[0]

		input = firstUnit.Type

		if len(firstUnit.Frames) < 1 {
			break
		}

		methodName := firstUnit.Frames[0].MethodName
		fileName := firstUnit.Frames[0].FileName

		if methodName != "" {
			input += sep + methodName
		}
		if fileName != "" {
			input += sep + fileName
		}
	default:
		return errors.New("failed to compute fingerprint for unknown platform")
	}

	// Compute the fingerprint
	// e.Fingerprint = computeFingerprint(input)
	hash := md5.Sum([]byte(input))
	e.Fingerprint = hex.EncodeToString(hash[:])

	return
}

// IsNested returns true in case of
// multiple nested ANRs.
func (a ANR) IsNested() bool {
	return len(a.Exceptions) > 1
}

// HasNoFrames returns true if the ANR
// does not have any frame.
//
// This may happen
// for certain OutOfMemory stacktraces in
// Android.
func (a ANR) HasNoFrames() bool {
	return len(a.Exceptions[len(a.Exceptions)-1].Frames) == 0
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
	if a.HasNoFrames() {
		return ""
	}
	return a.Exceptions[len(a.Exceptions)-1].Frames[0].FileName
}

// GetLineNumber provides the line number of
// the ANR.
func (a ANR) GetLineNumber() int {
	if a.HasNoFrames() {
		return 0
	}
	return a.Exceptions[len(a.Exceptions)-1].Frames[0].LineNum
}

// GetMethodName provides the method name of
// the ANR.
func (a ANR) GetMethodName() string {
	if a.HasNoFrames() {
		return ""
	}
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

// ComputeFingerprint computes a fingerprint
// from the ANR data.
func (a *ANR) ComputeFingerprint() (err error) {
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
	hash := md5.Sum([]byte(fingerprintData))
	a.Fingerprint = hex.EncodeToString(hash[:])

	return nil
}
