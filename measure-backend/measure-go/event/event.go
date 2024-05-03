package event

import (
	"encoding/json"
	"fmt"
	"measure-backend/measure-go/chrono"
	"measure-backend/measure-go/text"
	"net"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/go-dedup/simhash"
	"github.com/google/uuid"
)

// maximum character limits for event fields
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
	maxRouteChars                             = 128
)

const FramePrefix = "\tat "
const GenericPrefix = ": "

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

// NominalColdLaunchThreshold defines the upper bound
// of a nominal cold launch duration.
const NominalColdLaunchThreshold = 30 * time.Second

type Frame struct {
	LineNum    int    `json:"line_num"`
	ColNum     int    `json:"col_num"`
	ModuleName string `json:"module_name"`
	FileName   string `json:"file_name"`
	ClassName  string `json:"class_name"`
	MethodName string `json:"method_name"`
}

func (f Frame) String() string {
	className := f.ClassName
	methodName := f.MethodName
	fileName := f.FileName
	var lineNum = ""

	if f.LineNum != 0 {
		lineNum = strconv.Itoa(f.LineNum)
	}

	codeInfo := text.JoinNonEmptyStrings(".", className, methodName)
	fileInfo := text.JoinNonEmptyStrings(":", fileName, lineNum)

	if fileInfo != "" {
		fileInfo = fmt.Sprintf(`(%s)`, fileInfo)
	}

	return fmt.Sprintf(`%s%s`, codeInfo, fileInfo)
}

type Frames []Frame

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

func (e Exception) Stacktrace() string {
	var b strings.Builder

	b.WriteString(e.GetType() + "\n")

	for i := range e.Exceptions {
		for j := range e.Exceptions[i].Frames {
			frame := e.Exceptions[i].Frames[j].String()
			b.WriteString(FramePrefix + frame + "\n")
		}
	}

	return b.String()
}

func (e ANR) Stacktrace() string {
	var b strings.Builder

	b.WriteString(e.GetType() + "\n")

	for i := range e.Exceptions {
		for j := range e.Exceptions[i].Frames {
			frame := e.Exceptions[i].Frames[j].String()
			b.WriteString(FramePrefix + frame + "\n")
		}
	}

	return b.String()
}

type AppExit struct {
	Reason      string `json:"reason" binding:"required"`
	Importance  string `json:"importance" binding:"required"`
	Trace       string `json:"trace"`
	ProcessName string `json:"process_name" binding:"required"`
	PID         string `json:"pid" binding:"required"`
}

type LogString struct {
	SeverityText string `json:"severity_text" binding:"required"`
	String       string `json:"string" binding:"required"`
}

type GestureLongClick struct {
	Target        string  `json:"target"`
	TargetID      string  `json:"target_id"`
	TouchDownTime uint32  `json:"touch_down_time"`
	TouchUpTime   uint32  `json:"touch_up_time"`
	Width         uint16  `json:"width"`
	Height        uint16  `json:"height"`
	X             float32 `json:"x"`
	Y             float32 `json:"y"`
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

type WarmLaunch struct {
	AppVisibleUptime uint32        `json:"app_visible_uptime"`
	OnNextDrawUptime uint32        `json:"on_next_draw_uptime" binding:"required"`
	LaunchedActivity string        `json:"launched_activity" binding:"required"`
	HasSavedState    bool          `json:"has_saved_state" binding:"required"`
	IntentData       string        `json:"intent_data"`
	Duration         time.Duration `json:"duration"`
}

// Compute computes the warm launch duration.
func (wl *WarmLaunch) Compute() {
	wl.Duration = time.Duration(wl.OnNextDrawUptime-wl.AppVisibleUptime) * time.Millisecond
}

type HotLaunch struct {
	AppVisibleUptime uint32        `json:"app_visible_uptime"`
	OnNextDrawUptime uint32        `json:"on_next_draw_uptime" binding:"required"`
	LaunchedActivity string        `json:"launched_activity" binding:"required"`
	HasSavedState    bool          `json:"has_saved_state" binding:"required"`
	IntentData       string        `json:"intent_data"`
	Duration         time.Duration `json:"duration"`
}

// Compute computes the hot launch duration.
func (hl *HotLaunch) Compute() {
	hl.Duration = time.Duration(hl.OnNextDrawUptime-hl.AppVisibleUptime) * time.Millisecond
}

type NetworkChange struct {
	NetworkType               string `json:"network_type" binding:"required"`
	PreviousNetworkType       string `json:"previous_network_type"`
	NetworkGeneration         string `json:"network_generation"`
	PreviousNetworkGeneration string `json:"previous_network_generation"`
	NetworkProvider           string `json:"network_provider"`
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
	Route string `json:"route" binding:"required"`
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

func (e EventField) IsException() bool {
	return e.Type == TypeException
}

func (e EventField) IsUnhandledException() bool {
	return e.Type == TypeException && !e.Exception.Handled
}

func (e EventField) IsANR() bool {
	return e.Type == TypeANR
}

func (e EventField) IsAppExit() bool {
	return e.Type == TypeAppExit
}

func (e EventField) IsString() bool {
	return e.Type == TypeString
}

func (e EventField) IsGestureLongClick() bool {
	return e.Type == TypeGestureLongClick
}

func (e EventField) IsGestureScroll() bool {
	return e.Type == TypeGestureScroll
}

func (e EventField) IsGestureClick() bool {
	return e.Type == TypeGestureClick
}

func (e EventField) IsLifecycleActivity() bool {
	return e.Type == TypeLifecycleActivity
}

func (e EventField) IsLifecycleFragment() bool {
	return e.Type == TypeLifecycleFragment
}

func (e EventField) IsLifecycleApp() bool {
	return e.Type == TypeLifecycleApp
}

func (e EventField) IsColdLaunch() bool {
	return e.Type == TypeColdLaunch
}

func (e EventField) IsWarmLaunch() bool {
	return e.Type == TypeWarmLaunch
}

func (e EventField) IsHotLaunch() bool {
	return e.Type == TypeHotLaunch
}

func (e EventField) IsNetworkChange() bool {
	return e.Type == TypeNetworkChange
}

func (e EventField) IsHttp() bool {
	return e.Type == TypeHttp
}

func (e EventField) IsMemoryUsage() bool {
	return e.Type == TypeMemoryUsage
}

func (e EventField) IsTrimMemory() bool {
	return e.Type == TypeTrimMemory
}

func (e EventField) IsCPUUsage() bool {
	return e.Type == TypeCPUUsage
}

func (e EventField) IsLowMemory() bool {
	return e.Type == TypeLowMemory
}

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

type EventException struct {
	ID         uuid.UUID       `json:"id"`
	SessionID  uuid.UUID       `json:"session_id"`
	Timestamp  chrono.ISOTime  `json:"timestamp"`
	Type       string          `json:"type"`
	Attribute  Attribute       `json:"attribute"`
	Exception  Exception       `json:"-"`
	Exceptions []ExceptionView `json:"exceptions"`
	Threads    []ThreadView    `json:"threads"`
}

type ExceptionView struct {
	Type       string `json:"type"`
	Message    string `json:"message"`
	Location   string `json:"location"`
	Stacktrace string `json:"stacktrace"`
}

type ThreadView struct {
	Name   string   `json:"name"`
	Frames []string `json:"frames"`
}

func (e *EventException) ComputeView() {
	var ev ExceptionView
	ev.Type = e.Exception.GetType()
	ev.Message = e.Exception.GetMessage()
	ev.Location = e.Exception.GetLocation()
	ev.Stacktrace = e.Exception.Stacktrace()
	e.Exceptions = append(e.Exceptions, ev)

	for i := range e.Exception.Threads {
		var tv ThreadView
		tv.Name = e.Exception.Threads[i].Name
		for j := range e.Exception.Threads[i].Frames {
			tv.Frames = append(tv.Frames, e.Exception.Threads[i].Frames[j].String())
		}
		e.Threads = append(e.Threads, tv)
	}
}

type EventANR struct {
	ID         uuid.UUID         `json:"id"`
	SessionID  uuid.UUID         `json:"session_id"`
	Timestamp  chrono.ISOTime    `json:"timestamp"`
	Type       string            `json:"type"`
	ThreadName string            `json:"thread_name"`
	Resource   Resource          `json:"resource"`
	ANR        ANR               `json:"-"`
	ANRs       []ANRView         `json:"anrs"`
	Threads    []ThreadView      `json:"threads"`
	Attributes map[string]string `json:"attributes"`
}

type ANRView struct {
	Type       string `json:"type"`
	Message    string `json:"message"`
	Location   string `json:"location"`
	Stacktrace string `json:"stacktrace"`
}

func (e *EventANR) ComputeView() {
	var av ANRView
	av.Type = e.ANR.GetType()
	av.Message = e.ANR.GetMessage()
	av.Location = e.ANR.GetLocation()
	av.Stacktrace = e.ANR.Stacktrace()
	e.ANRs = append(e.ANRs, av)

	for i := range e.ANR.Threads {
		var tv ThreadView
		tv.Name = e.ANR.Threads[i].Name
		for j := range e.ANR.Threads[i].Frames {
			tv.Frames = append(tv.Frames, e.ANR.Threads[i].Frames[j].String())
		}
		e.Threads = append(e.Threads, tv)
	}
}

func (e *EventField) ComputeExceptionFingerprint() error {
	if !e.IsException() {
		return nil
	}

	if e.Exception.Handled {
		return nil
	}

	marshalledException, err := json.Marshal(e.Exception)
	if err != nil {
		return err
	}

	sh := simhash.NewSimhash()
	e.Exception.Fingerprint = fmt.Sprintf("%x", sh.GetSimhash(sh.NewWordFeatureSet(marshalledException)))

	return nil
}

func (e *EventField) ComputeANRFingerprint() error {
	if !e.IsANR() {
		return nil
	}

	marshalledANR, err := json.Marshal(e.ANR)
	if err != nil {
		return err
	}

	sh := simhash.NewSimhash()
	e.ANR.Fingerprint = fmt.Sprintf("%x", sh.GetSimhash(sh.NewWordFeatureSet(marshalledANR)))
	return nil
}

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
	}

	if e.IsLifecycleApp() {
		if e.LifecycleApp.Type == "" {
			return fmt.Errorf(`%q must not be empty`, `lifecycle_app.type`)
		}
		if len(e.LifecycleApp.Type) > maxLifecycleAppTypeChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `lifecycle_app.type`, maxLifecycleAppTypeChars)
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
		if len(e.NetworkChange.PreviousNetworkType) >= maxNetworkChangePreviousNetworkTypeChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `network_change.previous_network_type`, maxNetworkChangePreviousNetworkTypeChars)
		}
		if len(e.NetworkChange.NetworkGeneration) >= maxNetworkChangeNetworkGeneration {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `network_change.network_generation`, maxNetworkChangeNetworkGeneration)
		}
		if len(e.NetworkChange.PreviousNetworkGeneration) >= maxNetworkChangePreviousNetworkGeneration {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `network_change.previous_network_generation`, maxNetworkChangePreviousNetworkGeneration)
		}
		if len(e.NetworkChange.NetworkProvider) >= maxNetworkChangeNetworkProvider {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `network_change.network_provider`, maxNetworkChangeNetworkProvider)
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
		if e.Navigation.Route == "" {
			return fmt.Errorf(`%q must not be empty`, `navigation.route`)
		}
		if len(e.Navigation.Route) > maxRouteChars {
			return fmt.Errorf(`%q exceeds maximum allowed characters of (%d)`, `navigation.route`, maxRouteChars)
		}
	}

	return nil
}

func (e Exception) GetType() string {
	return e.Exceptions[len(e.Exceptions)-1].Type
}

func (e Exception) GetMessage() string {
	return e.Exceptions[len(e.Exceptions)-1].Message
}

func (e Exception) GetLocation() string {
	frame := e.Exceptions[len(e.Exceptions)-1].Frames[0]
	return frame.String()
}

func (a ANR) GetType() string {
	return a.Exceptions[len(a.Exceptions)-1].Type
}

func (a ANR) GetMessage() string {
	return a.Exceptions[len(a.Exceptions)-1].Message
}

func (a ANR) GetLocation() string {
	frame := a.Exceptions[len(a.Exceptions)-1].Frames[0]
	return frame.String()
}
