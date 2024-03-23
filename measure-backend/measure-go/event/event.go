package event

import (
	"encoding/json"
	"fmt"
	"measure-backend/measure-go/chrono"
	"measure-backend/measure-go/text"
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
	maxThreadNameChars                        = 64
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
	maxAttrCount                              = 10
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
	ThreadName        string         `json:"thread_name" binding:"required"`
	Handled           bool           `json:"handled" binding:"required"`
	Exceptions        ExceptionUnits `json:"exceptions" binding:"required"`
	Threads           Threads        `json:"threads" binding:"required"`
	NetworkType       string         `json:"network_type"`
	NetworkGeneration string         `json:"network_generation"`
	NetworkProvider   string         `json:"network_provider"`
	DeviceLocale      string         `json:"device_locale"`
	Fingerprint       string         `json:"fingerprint"`
	Foreground        bool           `json:"foreground" binding:"required"`
}

type Exception struct {
	ThreadName        string         `json:"thread_name" binding:"required"`
	Handled           bool           `json:"handled" binding:"required"`
	Exceptions        ExceptionUnits `json:"exceptions" binding:"required"`
	Threads           Threads        `json:"threads" binding:"required"`
	NetworkType       string         `json:"network_type"`
	NetworkGeneration string         `json:"network_generation"`
	NetworkProvider   string         `json:"network_provider"`
	DeviceLocale      string         `json:"device_locale"`
	Fingerprint       string         `json:"fingerprint"`
	Foreground        bool           `json:"foreground" binding:"required"`
}

func (e *Exception) Trim() {
	e.ThreadName = text.TrimFixedString(e.ThreadName)
	e.NetworkType = text.TrimFixedString(e.NetworkType)
	e.NetworkGeneration = text.TrimFixedString(e.NetworkGeneration)
	e.NetworkProvider = text.TrimFixedString(e.NetworkProvider)
	e.DeviceLocale = text.TrimFixedString(e.DeviceLocale)
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

func (a *ANR) Trim() {
	a.ThreadName = text.TrimFixedString(a.ThreadName)
	a.NetworkType = text.TrimFixedString(a.NetworkType)
	a.NetworkGeneration = text.TrimFixedString(a.NetworkGeneration)
	a.NetworkProvider = text.TrimFixedString(a.NetworkProvider)
	a.DeviceLocale = text.TrimFixedString(a.DeviceLocale)
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

// Trim removes null bytes from the app
// exit event's string fields.
func (ae *AppExit) Trim() {
	ae.Reason = text.TrimFixedString(ae.Reason)
	ae.Importance = text.TrimFixedString(ae.Importance)
}

type LogString struct {
	SeverityText string `json:"severity_text" binding:"required"`
	String       string `json:"string" binding:"required"`
}

// Trim removes null bytes from the log
// event's string fields.
func (ls *LogString) Trim() {
	ls.SeverityText = text.TrimFixedString(ls.SeverityText)
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

// Trim removes null bytes from the long
// click event's string fields.
func (glc *GestureLongClick) Trim() {
	glc.Target = text.TrimFixedString(glc.Target)
	glc.TargetID = text.TrimFixedString(glc.TargetID)
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

// Trim removes null bytes from the scroll
// event's string fields.
func (gs *GestureScroll) Trim() {
	gs.Target = text.TrimFixedString(gs.Target)
	gs.TargetID = text.TrimFixedString(gs.TargetID)
	gs.Direction = text.TrimFixedString(gs.Direction)
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

// Trim removes null bytes from the click
// event's string fields.
func (gc *GestureClick) Trim() {
	gc.Target = text.TrimFixedString(gc.Target)
	gc.TargetID = text.TrimFixedString(gc.TargetID)
}

type LifecycleActivity struct {
	Type               string `json:"type" binding:"required"`
	ClassName          string `json:"class_name" binding:"required"`
	Intent             string `json:"intent"`
	SavedInstanceState bool   `json:"saved_instance_state"`
}

// Trim removes null bytes from the lifecycle
// activity event's string fields.
func (la *LifecycleActivity) Trim() {
	la.Type = text.TrimFixedString(la.Type)
	la.ClassName = text.TrimFixedString(la.ClassName)
}

type LifecycleFragment struct {
	Type           string `json:"type" binding:"required"`
	ClassName      string `json:"class_name" binding:"required"`
	ParentActivity string `json:"parent_activity"`
	Tag            string `json:"tag"`
}

// Trim removes null bytes from the lifecycle
// fragment event's string fields.
func (lf *LifecycleFragment) Trim() {
	lf.Type = text.TrimFixedString(lf.Type)
	lf.ClassName = text.TrimFixedString(lf.ClassName)
}

type LifecycleApp struct {
	Type string `json:"type" binding:"required"`
}

// Trim removes null bytes from the lifecycle
// app event's string fields.
func (la *LifecycleApp) Trim() {
	la.Type = text.TrimFixedString(la.Type)
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

// Trim removes null bytes from the
// http event's string fields.
func (h *Http) Trim() {
	h.Method = text.TrimFixedString(h.Method)
	h.Client = text.TrimFixedString(h.Client)
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

// Trim removes null bytes from the trim
// memory event's string fields.
func (tm *TrimMemory) Trim() {
	tm.Level = text.TrimFixedString(tm.Level)
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

// Trim removes null bytes from the
// navigation event's string fields.
func (n *Navigation) Trim() {
	n.Route = text.TrimFixedString(n.Route)
}

type EventField struct {
	ID                uuid.UUID         `json:"id"`
	Timestamp         time.Time         `json:"timestamp" binding:"required"`
	Type              string            `json:"type" binding:"required"`
	ThreadName        string            `json:"thread_name" binding:"required"`
	Resource          Resource          `json:"resource"`
	ANR               ANR               `json:"anr,omitempty"`
	Exception         Exception         `json:"exception,omitempty"`
	AppExit           AppExit           `json:"app_exit,omitempty"`
	LogString         LogString         `json:"string,omitempty"`
	GestureLongClick  GestureLongClick  `json:"gesture_long_click,omitempty"`
	GestureScroll     GestureScroll     `json:"gesture_scroll,omitempty"`
	GestureClick      GestureClick      `json:"gesture_click,omitempty"`
	LifecycleActivity LifecycleActivity `json:"lifecycle_activity,omitempty"`
	LifecycleFragment LifecycleFragment `json:"lifecycle_fragment,omitempty"`
	LifecycleApp      LifecycleApp      `json:"lifecycle_app,omitempty"`
	ColdLaunch        ColdLaunch        `json:"cold_launch,omitempty"`
	WarmLaunch        WarmLaunch        `json:"warm_launch,omitempty"`
	HotLaunch         HotLaunch         `json:"hot_launch,omitempty"`
	NetworkChange     NetworkChange     `json:"network_change,omitempty"`
	Http              Http              `json:"http,omitempty"`
	MemoryUsage       MemoryUsage       `json:"memory_usage,omitempty"`
	LowMemory         LowMemory         `json:"low_memory,omitempty"`
	TrimMemory        TrimMemory        `json:"trim_memory,omitempty"`
	CPUUsage          CPUUsage          `json:"cpu_usage,omitempty"`
	Navigation        Navigation        `json:"navigation,omitempty"`
	Attributes        map[string]string `json:"attributes"`
}

func (e *EventField) IsException() bool {
	return e.Type == TypeException
}

func (e *EventField) IsUnhandledException() bool {
	return e.Type == TypeException && !e.Exception.Handled
}

func (e *EventField) IsANR() bool {
	return e.Type == TypeANR
}

func (e *EventField) IsAppExit() bool {
	return e.Type == TypeAppExit
}

func (e *EventField) IsString() bool {
	return e.Type == TypeString
}

func (e *EventField) IsGestureLongClick() bool {
	return e.Type == TypeGestureLongClick
}

func (e *EventField) IsGestureScroll() bool {
	return e.Type == TypeGestureScroll
}

func (e *EventField) IsGestureClick() bool {
	return e.Type == TypeGestureClick
}

func (e *EventField) IsLifecycleActivity() bool {
	return e.Type == TypeLifecycleActivity
}

func (e *EventField) IsLifecycleFragment() bool {
	return e.Type == TypeLifecycleFragment
}

func (e *EventField) IsLifecycleApp() bool {
	return e.Type == TypeLifecycleApp
}

func (e *EventField) IsColdLaunch() bool {
	return e.Type == TypeColdLaunch
}

func (e *EventField) IsWarmLaunch() bool {
	return e.Type == TypeWarmLaunch
}

func (e *EventField) IsHotLaunch() bool {
	return e.Type == TypeHotLaunch
}

func (e *EventField) IsNetworkChange() bool {
	return e.Type == TypeNetworkChange
}

func (e *EventField) IsHttp() bool {
	return e.Type == TypeHttp
}

func (e *EventField) IsMemoryUsage() bool {
	return e.Type == TypeMemoryUsage
}

func (e *EventField) IsTrimMemory() bool {
	return e.Type == TypeTrimMemory
}

func (e *EventField) IsCPUUsage() bool {
	return e.Type == TypeCPUUsage
}

// check if LowMemory event is present
func (e *EventField) IsLowMemory() bool {
	return e.Type == TypeLowMemory
}

func (e *EventField) IsNavigation() bool {
	return e.Type == TypeNavigation
}

func (e *EventField) Trim() {
	e.ThreadName = text.TrimFixedString(e.ThreadName)
	e.Type = text.TrimFixedString(e.Type)
	e.Resource.Trim()
	if e.IsException() {
		e.Exception.Trim()
	}
}

type EventException struct {
	ID         uuid.UUID         `json:"id"`
	SessionID  uuid.UUID         `json:"session_id"`
	Timestamp  chrono.ISOTime    `json:"timestamp"`
	Type       string            `json:"type"`
	ThreadName string            `json:"thread_name"`
	Resource   Resource          `json:"resource"`
	Exception  Exception         `json:"-"`
	Exceptions []ExceptionView   `json:"exceptions"`
	Threads    []ThreadView      `json:"threads"`
	Attributes map[string]string `json:"attributes"`
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

func (e *EventException) Trim() {
	e.ThreadName = text.TrimFixedString(e.ThreadName)
	e.Type = text.TrimFixedString(e.Type)
	e.Resource.Trim()
	e.Exception.Trim()
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

func (e *EventANR) Trim() {
	e.ThreadName = text.TrimFixedString(e.ThreadName)
	e.Type = text.TrimFixedString(e.Type)
	e.Resource.Trim()
	e.ANR.Trim()
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
	validTypes := []string{TypeANR, TypeException, TypeAppExit, TypeString, TypeGestureLongClick, TypeGestureScroll, TypeGestureClick, TypeLifecycleActivity, TypeLifecycleFragment, TypeLifecycleApp, TypeColdLaunch, TypeWarmLaunch, TypeHotLaunch, TypeNetworkChange, TypeHttp, TypeMemoryUsage, TypeLowMemory, TypeTrimMemory, TypeCPUUsage, TypeNavigation}
	if !slices.Contains(validTypes, e.Type) {
		return fmt.Errorf(`"events[].type" is not a valid type`)
	}
	if e.Timestamp.IsZero() {
		return fmt.Errorf(`events[].timestamp is invalid. Must be a valid ISO 8601 timestamp`)
	}
	if e.ThreadName == "" {
		return fmt.Errorf(`events[].thread_name is invalid`)
	}
	// validate all required fields of each type
	if e.IsANR() {
		if len(e.ANR.Exceptions) < 1 || len(e.ANR.Threads) < 1 || e.ANR.ThreadName == "" {
			return fmt.Errorf(`anr event is invalid`)
		}
	}

	if e.IsException() {
		if len(e.Exception.Exceptions) < 1 || len(e.Exception.Threads) < 1 || e.Exception.ThreadName == "" {
			return fmt.Errorf(`exception event is invalid`)
		}
	}

	if e.IsAppExit() {
		if len(e.AppExit.Reason) < 1 || len(e.AppExit.Importance) < 1 || len(e.AppExit.ProcessName) < 1 {
			return fmt.Errorf(`app_exit event is invalid`)
		}
	}

	if e.IsString() {
		if len(e.LogString.String) < 1 {
			return fmt.Errorf(`string event is invalid`)
		}
	}

	if e.IsGestureLongClick() {
		if e.GestureLongClick.X < 0 || e.GestureLongClick.Y < 0 {
			return fmt.Errorf(`gesture_long_click event is invalid`)
		}
	}

	if e.IsGestureScroll() {
		if e.GestureScroll.X < 0 || e.GestureScroll.Y < 0 {
			return fmt.Errorf(`gesture_scroll event is invalid`)
		}
	}

	if e.IsGestureClick() {
		if e.GestureClick.X < 0 || e.GestureClick.Y < 0 {
			return fmt.Errorf(`gesture_click event is invalid`)
		}
	}

	if e.IsLifecycleActivity() {
		if e.LifecycleActivity.Type == "" || e.LifecycleActivity.ClassName == "" {
			return fmt.Errorf(`lifecycle_activity event is invalid`)
		}
	}

	if e.IsLifecycleFragment() {
		if e.LifecycleFragment.Type == "" || e.LifecycleFragment.ClassName == "" {
			return fmt.Errorf(`lifecycle_fragment event is invalid`)
		}
	}

	if e.IsLifecycleApp() {
		if e.LifecycleApp.Type == "" {
			return fmt.Errorf(`lifecycle_app event is invalid`)
		}
	}

	if e.IsColdLaunch() {
		if e.ColdLaunch.ProcessStartUptime <= 0 && e.ColdLaunch.ContentProviderAttachUptime <= 0 && e.ColdLaunch.ProcessStartRequestedUptime <= 0 {
			return fmt.Errorf(`one of cold_launch.process_start_uptime, cold_launch.process_start_requested_uptime, cold_launch.content_provider_attach_uptime must be greater than 0`)
		}
		if e.ColdLaunch.OnNextDrawUptime <= 0 {
			return fmt.Errorf(`cold_launch.on_next_draw_uptime must be greater than 0`)
		}
		if e.ColdLaunch.LaunchedActivity == "" {
			return fmt.Errorf(`cold_launch.launched_activity must not be empty`)
		}
	}

	if e.IsWarmLaunch() {
		if e.WarmLaunch.AppVisibleUptime <= 0 {
			return fmt.Errorf(`warm_launch.app_visible_uptime must be greater than 0`)
		}
		if e.WarmLaunch.OnNextDrawUptime <= 0 {
			return fmt.Errorf(`warm_launch.on_next_draw_uptime must be greater than 0`)
		}
		if e.WarmLaunch.LaunchedActivity == "" {
			return fmt.Errorf(`warm_launch.launched_activity must not be empty`)
		}
	}

	if e.IsHotLaunch() {
		if e.HotLaunch.AppVisibleUptime <= 0 {
			return fmt.Errorf(`hot_launch.app_visible_uptime must be greater than 0`)
		}
		if e.HotLaunch.OnNextDrawUptime <= 0 {
			return fmt.Errorf(`hot_launch.on_next_draw_uptime must be greater than 0`)
		}
		if e.HotLaunch.LaunchedActivity == "" {
			return fmt.Errorf(`hot_launch.launched_activity must not be empty`)
		}
	}

	if e.IsNetworkChange() {
		if e.NetworkChange.NetworkType == "" {
			return fmt.Errorf(`network_change.network_type must not be empty`)
		}
	}

	if e.IsHttp() {
		if e.Http.URL == "" {
			return fmt.Errorf(`http.url must not be empty`)
		}
		if e.Http.Method == "" {
			return fmt.Errorf(`http.method must not be empty`)
		}
	}

	if e.IsMemoryUsage() {
		if e.MemoryUsage.IntervalConfig <= 0 {
			return fmt.Errorf(`memory_usage.interval_config must be greater than 0`)
		}
	}

	if e.IsTrimMemory() {
		if e.TrimMemory.Level == "" {
			return fmt.Errorf(`trim_memory.level must not be empty`)
		}
	}

	if e.IsCPUUsage() {
		if e.CPUUsage.NumCores <= 0 {
			return fmt.Errorf(`cpu_usage.num_cores must be greater than 0`)
		}
		if e.CPUUsage.ClockSpeed <= 0 {
			return fmt.Errorf(`cpu_usage.clock_speed must be greater than 0`)
		}
		if e.CPUUsage.IntervalConfig <= 0 {
			return fmt.Errorf(`cpu_usage.interval_config must be greater than 0`)
		}
	}

	if e.IsNavigation() {
		if e.Navigation.Route == "" {
			return fmt.Errorf(`navigation.route must not be empty`)
		}
	}

	if len(e.Type) > maxTypeChars {
		return fmt.Errorf(`"events[].type" exceeds maximum allowed characters of (%d)`, maxTypeChars)
	}
	if len(e.ThreadName) > maxThreadNameChars {
		return fmt.Errorf(`"events[].thread_name" exceeds maximum allowed characters of (%d)`, maxThreadNameChars)
	}
	if len(e.ANR.ThreadName) > maxThreadNameChars {
		return fmt.Errorf(`"events[].anr.thread_name" exceeds maximum allowed characters of (%d)`, maxThreadNameChars)
	}
	if len(e.Exception.ThreadName) > maxThreadNameChars {
		return fmt.Errorf(`"events[].exception.thread_name" exceeds maximum allowed characters of (%d)`, maxThreadNameChars)
	}
	if len(e.AppExit.Reason) > maxAppExitReasonChars {
		return fmt.Errorf(`"events[].app_exit.reason" exceeds maximum allowed characters of (%d)`, maxAppExitReasonChars)
	}
	if len(e.AppExit.Importance) > maxAppExitImportanceChars {
		return fmt.Errorf(`"events[].app_exit.importance exceeds maximum allowed characters of (%d)`, maxAppExitImportanceChars)
	}
	if len(e.LogString.SeverityText) > maxSeverityTextChars {
		return fmt.Errorf(`"events[].string.severity_text" exceeds maximum allowed characters of (%d)`, maxSeverityTextChars)
	}
	if len(e.GestureLongClick.Target) > maxGestureLongClickTargetChars {
		return fmt.Errorf(`"events[].gesture_long_click.target" exceeds maximum allowed characters of (%d)`, maxGestureLongClickTargetChars)
	}
	if len(e.GestureLongClick.TargetID) > maxGestureLongClickTargetIDChars {
		return fmt.Errorf(`"events[].gesture_long_click.target_id" exceeds maximum allowed characters of (%d)`, maxGestureLongClickTargetIDChars)
	}
	if len(e.GestureClick.Target) > maxGestureClickTargetChars {
		return fmt.Errorf(`"events[].gesture_click.target" exceeds maximum allowed characters of (%d)`, maxGestureClickTargetChars)
	}
	if len(e.GestureClick.TargetID) > maxGestureClickTargetIDChars {
		return fmt.Errorf(`"events[].gesture_click.target_id" exceeds maximum allowed characters of (%d)`, maxGestureClickTargetIDChars)
	}
	if len(e.GestureScroll.Target) > maxGestureScrollTargetChars {
		return fmt.Errorf(`"events[].gesture_scroll.target" exceeds maximum allowed characters of (%d)`, maxGestureScrollTargetChars)
	}
	if len(e.GestureScroll.TargetID) > maxGestureScrollTargetIDChars {
		return fmt.Errorf(`"events[].gesture_scroll.target_id" exceeds maximum allowed characters of (%d)`, maxGestureScrollTargetIDChars)
	}
	if len(e.GestureScroll.Direction) > maxGestureScrollDirectionChars {
		return fmt.Errorf(`"events[].gesture_scroll.direction" exceeds maximum allowed characters of (%d)`, maxGestureScrollDirectionChars)
	}
	if len(e.LifecycleActivity.Type) > maxLifecycleActivityTypeChars {
		return fmt.Errorf(`"events[].lifecycle_activity.type" exceeds maximum allowed characters of (%d)`, maxLifecycleActivityTypeChars)
	}
	if len(e.LifecycleActivity.ClassName) > maxLifecycleActivityClassNameChars {
		return fmt.Errorf(`"events[].lifecycle_activity.class_name" exceeds maximum allowed characters of (%d)`, maxLifecycleActivityClassNameChars)
	}
	if len(e.LifecycleFragment.Type) > maxLifecycleFragmentTypeChars {
		return fmt.Errorf(`"events[].lifecycle_fragment.type" exceeds maximum allowed characters of (%d)`, maxLifecycleFragmentTypeChars)
	}
	if len(e.LifecycleFragment.ClassName) > maxLifecycleFragmentClassNameChars {
		return fmt.Errorf(`"events[].lifecycle_fragment.class_name" exceeds maximum allowed characters of (%d)`, maxLifecycleFragmentClassNameChars)
	}
	if len(e.LifecycleApp.Type) > maxLifecycleAppTypeChars {
		return fmt.Errorf(`"events[].lifecycle_app.type" exceeds maximum allowed characters of (%d)`, maxLifecycleAppTypeChars)
	}
	if len(e.ColdLaunch.LaunchedActivity) == maxColdLaunchLaunchedActivityChars {
		return fmt.Errorf(`events[].cold_launch.launched_activity exceeds maximum allowed characters of (%d)`, maxColdLaunchLaunchedActivityChars)
	}
	if len(e.WarmLaunch.LaunchedActivity) == maxWarmLaunchLaunchedActivityChars {
		return fmt.Errorf(`events[].warm_launch.launched_activity exceeds maximum allowed characters of (%d)`, maxWarmLaunchLaunchedActivityChars)
	}
	if len(e.HotLaunch.LaunchedActivity) == maxHotLaunchLaunchedActivityChars {
		return fmt.Errorf(`events[].hot_launch.launched_activity exceeds maximum allowed characters of (%d)`, maxHotLaunchLaunchedActivityChars)
	}
	if len(e.NetworkChange.NetworkType) == maxNetworkChangeNetworkTypeChars {
		return fmt.Errorf(`events[].network_change.network_type exceeds maximum allowed characters of (%d)`, maxNetworkChangeNetworkTypeChars)
	}
	if len(e.NetworkChange.PreviousNetworkType) == maxNetworkChangePreviousNetworkTypeChars {
		return fmt.Errorf(`events[].network_change.previous_network_type exceeds maximum allowed characters of (%d)`, maxNetworkChangePreviousNetworkTypeChars)
	}
	if len(e.NetworkChange.NetworkGeneration) == maxNetworkChangeNetworkGeneration {
		return fmt.Errorf(`events[].network_change.network_generation exceeds maximum allowed characters of (%d)`, maxNetworkChangeNetworkGeneration)
	}
	if len(e.NetworkChange.PreviousNetworkGeneration) == maxNetworkChangePreviousNetworkGeneration {
		return fmt.Errorf(`events[].network_change.previous_network_generation exceeds maximum allowed characters of (%d)`, maxNetworkChangePreviousNetworkGeneration)
	}
	if len(e.NetworkChange.NetworkProvider) == maxNetworkChangeNetworkProvider {
		return fmt.Errorf(`events[].network_change.network_provider exceeds maximum allowed characters of (%d)`, maxNetworkChangeNetworkProvider)
	}
	if len(e.ANR.DeviceLocale) > maxAnrDeviceLocaleChars {
		return fmt.Errorf(`"events[].anr.device_locale" exceeds maximum allowed characters of (%d)`, maxAnrDeviceLocaleChars)
	}
	if len(e.Exception.DeviceLocale) > maxExceptionDeviceLocaleChars {
		return fmt.Errorf(`"events[].exception.device_locale" exceeds maximum allowed characters of (%d)`, maxExceptionDeviceLocaleChars)
	}
	if len(e.Http.Method) > maxHttpMethodChars {
		return fmt.Errorf(`"events[].http.method" exceeds maximum allowed characters of (%d)`, maxHttpMethodChars)
	}
	if len(e.Http.Client) > maxHttpClientChars {
		return fmt.Errorf(`"events[].http.client" exceeds maximum allowed characters of (%d)`, maxHttpClientChars)
	}
	if len(e.TrimMemory.Level) > maxTrimMemoryLevelChars {
		return fmt.Errorf(`"events[].trim_memo̦ry.level" exceeds maximum allowed characters of (%d)`, maxTrimMemoryLevelChars)
	}
	if len(e.Attributes) > maxAttrCount {
		return fmt.Errorf(`"events[].attributes" exceeds maximum count of (%d)`, maxAttrCount)
	}
	if len(e.Navigation.Route) > maxRouteChars {
		return fmt.Errorf(`"events[].navigation.route" exceeds maximum allowed characters of (%d)`, maxRouteChars)
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
