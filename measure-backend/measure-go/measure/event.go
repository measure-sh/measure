package measure

import (
	"context"
	"encoding/json"
	"fmt"
	"measure-backend/measure-go/chrono"
	"measure-backend/measure-go/event"
	"measure-backend/measure-go/inet"
	"measure-backend/measure-go/server"
	"measure-backend/measure-go/symbol"
	"mime/multipart"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/ipinfo/go/v2/ipinfo"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
)

// maxBatchSize is the maximum allowed payload
// size of event request in bytes.
var maxBatchSize = 20 * 1024 * 1024

type attachment struct {
	id       uuid.UUID
	name     string
	location string
	header   *multipart.FileHeader
	uploaded bool
}

type eventreq struct {
	appId        uuid.UUID
	symbolicate  map[uuid.UUID]int
	exceptionIds []int
	anrIds       []int
	size         int64
	events       []event.EventField
	attachments  []attachment
	transaction  *pgx.Tx
}

// uploadAttachments prepares and uploads each attachment.
func (e *eventreq) uploadAttachments() error {
	for i := range e.attachments {
		attachment := event.Attachment{
			ID:   e.attachments[i].id,
			Name: e.attachments[i].header.Filename,
			Key:  e.attachments[i].id.String(),
		}

		file, err := e.attachments[i].header.Open()
		if err != nil {
			return err
		}

		attachment.Reader = file

		output, err := attachment.Upload()
		if err != nil {
			return err
		}

		e.attachments[i].uploaded = true
		e.attachments[i].location = output.Location
	}

	return nil
}

// bumpSize increases the payload size of
// events in bytes.
func (e *eventreq) bumpSize(n int64) {
	e.size = e.size + n
}

// read parses and validates the event request payload for
// event and attachments.
func (e *eventreq) read(c *gin.Context, appId uuid.UUID) error {
	form, err := c.MultipartForm()
	if err != nil {
		return err
	}

	events := form.Value["event"]
	if len(events) < 1 {
		return fmt.Errorf(`payload must contain at least 1 event`)
	}

	for i := range events {
		if events[i] == "" {
			return fmt.Errorf(`any event field must not be empty`)
		}
		var event event.EventField
		bytes := []byte(events[i])
		if err := json.Unmarshal(bytes, &event); err != nil {
			return err
		}
		e.bumpSize(int64(len(bytes)))
		event.AppID = appId

		if event.NeedsSymbolication() {
			e.symbolicate[event.ID] = i
		}

		if event.IsUnhandledException() {
			e.exceptionIds = append(e.exceptionIds, i)
		}

		if event.IsANR() {
			e.anrIds = append(e.anrIds, i)
		}

		// compute launch timings
		if event.IsColdLaunch() {
			event.ColdLaunch.Compute()
		}
		if event.IsWarmLaunch() {
			event.WarmLaunch.Compute()
		}
		if event.IsHotLaunch() {
			event.HotLaunch.Compute()
		}

		e.events = append(e.events, event)
	}

	for key, headers := range form.File {
		id, ok := strings.CutPrefix(key, "blob-")
		if !ok {
			continue
		}
		blobId, err := uuid.Parse(id)
		if err != nil {
			return err
		}
		if len(headers) < 1 {
			return fmt.Errorf(`blob attachments must not be empty`)
		}
		header := headers[0]
		if header == nil {
			continue
		}
		e.bumpSize(header.Size)
		e.attachments = append(e.attachments, attachment{
			id:     blobId,
			name:   header.Filename,
			header: header,
		})
	}

	return nil
}

// infuseInet looks up the country code for the IP
// and infuses the country code and IP info to each event.
func (e *eventreq) infuseInet(rawIP string) error {
	ip := net.ParseIP(rawIP)
	country, err := inet.LookupCountry(rawIP)
	if err != nil {
		return err
	}

	bogon, err := ipinfo.GetIPBogon(ip)
	if err != nil {
		return err
	}

	v4 := inet.Isv4(ip)

	for i := range e.events {
		if v4 {
			e.events[i].IPv4 = ip
		} else {
			e.events[i].IPv6 = ip
		}

		if bogon {
			e.events[i].CountryCode = "bogon"
		} else if *country != "" {
			e.events[i].CountryCode = *country
		} else {
			e.events[i].CountryCode = "not available"
		}
	}

	return nil
}

// hasUnhandledExceptions returns true if event payload
// contains unhandled exceptions.
func (e eventreq) hasUnhandledExceptions() bool {
	return len(e.exceptionIds) > 0
}

// hasANRs returns true if event payload contains
// ANRs.
func (e eventreq) hasANRs() bool {
	return len(e.anrIds) > 0
}

// hasAttachments returns true if payload // contains attachments to be processed.
func (e eventreq) hasAttachments() bool {
	return len(e.attachments) > 0
}

// getUnhandledExceptions returns unhandled excpetions
// from the event payload.
func (e eventreq) getUnhandledExceptions() (events []event.EventField) {
	if !e.hasUnhandledExceptions() {
		return
	}
	for i := range e.exceptionIds {
		events = append(events, e.events[i])
	}
	return
}

// getANRs returns ANRs from the event payload.
func (e eventreq) getANRs() (events []event.EventField) {
	if !e.hasANRs() {
		return
	}
	for i := range e.anrIds {
		events = append(events, e.events[i])
	}
	return
}

// bucketUnhandledExceptions groups unhandled exceptions
// based on similarity.
func (e eventreq) bucketUnhandledExceptions(tx *pgx.Tx) error {
	exceptions := e.getUnhandledExceptions()

	type EventGroup struct {
		eventId     uuid.UUID
		exception   event.Exception
		fingerprint uint64
	}

	var groups []EventGroup

	for _, event := range exceptions {
		if event.Exception.Fingerprint == "" {
			msg := fmt.Sprintf("fingerprint for event %q is empty, cannot bucket", event.ID)
			fmt.Println(msg)
			continue
		}

		fingerprint, err := strconv.ParseUint(event.Exception.Fingerprint, 16, 64)
		if err != nil {
			msg := fmt.Sprintf("failed to parse fingerprint as integer for event %q", event.ID)
			fmt.Println(msg, err)
			return err
		}

		groups = append(groups, EventGroup{
			eventId:     event.ID,
			exception:   *event.Exception,
			fingerprint: fingerprint,
		})
	}

	app := App{
		ID: &e.appId,
	}

	ctx := context.Background()

	for _, group := range groups {
		appExceptionGroups, err := app.GetExceptionGroups(nil)
		if err != nil {
			return err
		}

		if len(appExceptionGroups) < 1 {
			// insert new exception group
			return NewExceptionGroup(e.appId, group.exception.GetType(), fmt.Sprintf("%x", group.fingerprint), []uuid.UUID{group.eventId}).Insert(ctx, tx)
		}

		index, err := ClosestExceptionGroup(appExceptionGroups, group.fingerprint)
		if err != nil {
			return err
		}
		if index < 0 {
			// when no group matches exists, create new exception group
			NewExceptionGroup(e.appId, group.exception.GetType(), fmt.Sprintf("%x", group.fingerprint), []uuid.UUID{group.eventId}).Insert(ctx, tx)
			continue
		}
		matchedGroup := appExceptionGroups[index]

		if matchedGroup.EventExists(group.eventId) {
			continue
		}

		if err := matchedGroup.AppendEventId(ctx, group.eventId, tx); err != nil {
			return err
		}
	}

	return nil
}

// bucketANRs groups ANRs based on similarity.
func (e eventreq) bucketANRs(tx *pgx.Tx) error {
	anrs := e.getANRs()

	type EventGroup struct {
		eventId     uuid.UUID
		anr         event.ANR
		fingerprint uint64
	}

	var groups []EventGroup

	for _, event := range anrs {
		if event.ANR.Fingerprint == "" {
			msg := fmt.Sprintf("fingerprint for anr event %q is empty, cannot bucket", event.ID)
			fmt.Println(msg)
			continue
		}

		fingerprint, err := strconv.ParseUint(event.ANR.Fingerprint, 16, 64)
		if err != nil {
			msg := fmt.Sprintf("failed to parse fingerprint as integer for anr event %q", event.ID)
			fmt.Println(msg, err)
			return err
		}

		groups = append(groups, EventGroup{
			eventId:     event.ID,
			anr:         *event.ANR,
			fingerprint: fingerprint,
		})
	}

	app := App{
		ID: &e.appId,
	}

	ctx := context.Background()

	for _, group := range groups {
		appANRGroups, err := app.GetANRGroups(nil)
		if err != nil {
			return err
		}

		if len(appANRGroups) < 1 {
			// insert new anr group
			return NewANRGroup(e.appId, group.anr.GetType(), fmt.Sprintf("%x", group.fingerprint), []uuid.UUID{group.eventId}).Insert(ctx, tx)
		}

		index, err := ClosestANRGroup(appANRGroups, group.fingerprint)
		if err != nil {
			return err
		}
		if index < 0 {
			// when no group matches exists, create new anr group
			NewANRGroup(e.appId, group.anr.GetType(), fmt.Sprintf("%x", group.fingerprint), []uuid.UUID{group.eventId}).Insert(ctx, tx)
			continue
		}
		matchedGroup := appANRGroups[index]

		if matchedGroup.EventExists(group.eventId) {
			continue
		}

		if err := matchedGroup.AppendEventId(ctx, group.eventId, tx); err != nil {
			return err
		}
	}

	return nil
}

// needsSymbolication returns true if payload
// contains events that should be symbolicated.
func (e eventreq) needsSymbolication() bool {
	return len(e.symbolicate) > 0
}

// validate validates the integrity of each event
// and corresponding attachments.
func (e eventreq) validate() error {
	if len(e.events) < 1 {
		return fmt.Errorf(`payload must contain at least 1 event`)
	}

	for i := range e.events {
		if err := e.events[i].Validate(); err != nil {
			return err
		}
		if err := e.events[i].Attribute.Validate(); err != nil {
			return err
		}

		if e.hasAttachments() {
			for j := range e.events[i].Attachments {
				if err := e.events[i].Attachments[j].Validate(); err != nil {
					return err
				}
			}
		}
	}

	if e.size >= int64(maxBatchSize) {
		return fmt.Errorf(`payload cannot exceed maximum allowed size of %d`, maxBatchSize)
	}

	return nil
}

// ingest writes the events to database.
func (e eventreq) ingest(ctx context.Context) error {
	stmt := sqlf.InsertInto(`default.events`)
	defer stmt.Close()

	for i := range e.events {
		anrExceptions := "[]"
		anrThreads := "[]"
		exceptionExceptions := "[]"
		exceptionThreads := "[]"
		attachments := "[]"

		if e.events[i].IsANR() {
			marshalledExceptions, err := json.Marshal(e.events[i].ANR.Exceptions)
			if err != nil {
				return err
			}
			anrExceptions = string(marshalledExceptions)
			marshalledThreads, err := json.Marshal(e.events[i].ANR.Threads)
			if err != nil {
				return err
			}
			anrThreads = string(marshalledThreads)
			if err := e.events[i].ComputeANRFingerprint(); err != nil {
				return err
			}
		}
		if e.events[i].IsException() {
			marshalledExceptions, err := json.Marshal(e.events[i].Exception.Exceptions)
			if err != nil {
				return err
			}
			exceptionExceptions = string(marshalledExceptions)

			marshalledThreads, err := json.Marshal(e.events[i].Exception.Threads)
			if err != nil {
				return err
			}
			exceptionThreads = string(marshalledThreads)
			if err := e.events[i].ComputeExceptionFingerprint(); err != nil {
				return err
			}
		}

		if e.events[i].HasAttachments() {
			marshalledAttachments, err := json.Marshal(e.events[i].Attachments)
			if err != nil {
				return err
			}
			attachments = string(marshalledAttachments)
		}

		stmt.NewRow().
			Set(`id`, e.events[i].ID).
			Set(`type`, e.events[i].Type).
			Set(`session_id`, e.events[i].SessionID).
			Set(`app_id`, e.events[i].AppID).
			Set(`inet.ipv4`, e.events[i].IPv4).
			Set(`inet.ipv6`, e.events[i].IPv6).
			Set(`inet.country_code`, e.events[i].CountryCode).
			Set(`timestamp`, e.events[i].Timestamp.Format(chrono.NanoTimeFormat)).

			// attribute
			Set(`attribute.installation_id`, e.events[i].Attribute.InstallationID).
			Set(`attribute.app_version`, e.events[i].Attribute.AppVersion).
			Set(`attribute.app_build`, e.events[i].Attribute.AppBuild).
			Set(`attribute.app_unique_id`, e.events[i].Attribute.AppUniqueID).
			Set(`attribute.platform`, e.events[i].Attribute.Platform).
			Set(`attribute.measure_sdk_version`, e.events[i].Attribute.MeasureSDKVersion).
			Set(`attribute.thread_name`, e.events[i].Attribute.ThreadName).
			Set(`attribute.user_id`, e.events[i].Attribute.UserID).
			Set(`attribute.device_name`, e.events[i].Attribute.DeviceName).
			Set(`attribute.device_model`, e.events[i].Attribute.DeviceModel).
			Set(`attribute.device_manufacturer`, e.events[i].Attribute.DeviceManufacturer).
			Set(`attribute.device_type`, e.events[i].Attribute.DeviceType).
			Set(`attribute.device_is_foldable`, e.events[i].Attribute.DeviceIsFoldable).
			Set(`attribute.device_is_physical`, e.events[i].Attribute.DeviceIsPhysical).
			Set(`attribute.device_density_dpi`, e.events[i].Attribute.DeviceDensityDPI).
			Set(`attribute.device_width_px`, e.events[i].Attribute.DeviceWidthPX).
			Set(`attribute.device_height_px`, e.events[i].Attribute.DeviceHeightPX).
			Set(`attribute.device_density`, e.events[i].Attribute.DeviceDensity).
			Set(`attribute.device_locale`, e.events[i].Attribute.DeviceLocale).
			Set(`attribute.os_name`, e.events[i].Attribute.OSName).
			Set(`attribute.os_version`, e.events[i].Attribute.OSVersion).
			Set(`attribute.network_type`, e.events[i].Attribute.NetworkType).
			Set(`attribute.network_generation`, e.events[i].Attribute.NetworkGeneration).
			Set(`attribute.network_provider`, e.events[i].Attribute.NetworkProvider).

			// anr
			Set(`anr.handled`, e.events[i].ANR.Handled).
			Set(`anr.fingerprint`, e.events[i].ANR.Fingerprint).
			Set(`anr.exceptions`, anrExceptions).
			Set(`anr.threads`, anrThreads).
			Set(`anr.foreground`, e.events[i].ANR.Foreground).

			// exception
			Set(`exception.handled`, e.events[i].Exception.Handled).
			Set(`exception.fingerprint`, e.events[i].Exception.Fingerprint).
			Set(`exception.exceptions`, exceptionExceptions).
			Set(`exception.threads`, exceptionThreads).
			Set(`exception.foreground`, e.events[i].Exception.Foreground).

			// app exit
			Set(`app_exit.reason`, e.events[i].AppExit.Reason).
			Set(`app_exit.importance`, e.events[i].AppExit.Importance).
			Set(`app_exit.trace`, e.events[i].AppExit.Trace).
			Set(`app_exit.process_name`, e.events[i].AppExit.ProcessName).
			Set(`app_exit.pid`, e.events[i].AppExit.PID).

			// string
			Set(`string.severity_text`, e.events[i].LogString.SeverityText).
			Set(`string.string`, e.events[i].LogString.String).

			// gesture long click
			Set(`gesture_long_click.target`, e.events[i].GestureLongClick.Target).
			Set(`gesture_long_click.target_id`, e.events[i].GestureLongClick.TargetID).
			Set(`gesture_long_click.touch_down_time`, e.events[i].GestureLongClick.TouchDownTime).
			Set(`gesture_long_click.touch_up_time`, e.events[i].GestureLongClick.TouchUpTime).
			Set(`gesture_long_click.width`, e.events[i].GestureLongClick.Width).
			Set(`gesture_long_click.height`, e.events[i].GestureLongClick.Height).
			Set(`gesture_long_click.x`, e.events[i].GestureLongClick.X).
			Set(`gesture_long_click.y`, e.events[i].GestureLongClick.Y).

			// gesture click
			Set(`gesture_click.target`, e.events[i].GestureClick.Target).
			Set(`gesture_click.target_id`, e.events[i].GestureClick.TargetID).
			Set(`gesture_click.touch_down_time`, e.events[i].GestureClick.TouchDownTime).
			Set(`gesture_click.touch_up_time`, e.events[i].GestureClick.TouchUpTime).
			Set(`gesture_click.width`, e.events[i].GestureClick.Width).
			Set(`gesture_click.height`, e.events[i].GestureClick.Height).
			Set(`gesture_click.x`, e.events[i].GestureClick.X).
			Set(`gesture_click.y`, e.events[i].GestureClick.Y).

			// gesture scroll
			Set(`gesture_scroll.target`, e.events[i].GestureScroll.Target).
			Set(`gesture_scroll.target_id`, e.events[i].GestureScroll.TargetID).
			Set(`gesture_scroll.touch_down_time`, e.events[i].GestureScroll.TouchDownTime).
			Set(`gesture_scroll.touch_up_time`, e.events[i].GestureScroll.TouchUpTime).
			Set(`gesture_scroll.x`, e.events[i].GestureScroll.X).
			Set(`gesture_scroll.y`, e.events[i].GestureScroll.Y).
			Set(`gesture_scroll.end_x`, e.events[i].GestureScroll.EndX).
			Set(`gesture_scroll.end_y`, e.events[i].GestureScroll.EndY).
			Set(`gesture_scroll.direction`, e.events[i].GestureScroll.Direction).

			// lifecycle activity
			Set(`lifecycle_activity.type`, e.events[i].LifecycleActivity.Type).
			Set(`lifecycle_activity.class_name`, e.events[i].LifecycleActivity.ClassName).
			Set(`lifecycle_activity.intent`, e.events[i].LifecycleActivity.Intent).
			Set(`lifecycle_activity.saved_instance_state`, e.events[i].LifecycleActivity.SavedInstanceState).

			// lifecycle fragment
			Set(`lifecycle_fragment.type`, e.events[i].LifecycleFragment.Type).
			Set(`lifecycle_fragment.class_name`, e.events[i].LifecycleFragment.ClassName).
			Set(`lifecycle_fragment.parent_activity`, e.events[i].LifecycleFragment.ParentActivity).
			Set(`lifecycle_fragment.tag`, e.events[i].LifecycleFragment.Tag).

			// lifecycle app
			Set(`lifecycle_app.type`, e.events[i].LifecycleApp.Type).

			// cold launch
			Set(`cold_launch.process_start_uptime`, e.events[i].ColdLaunch.ProcessStartUptime).
			Set(`cold_launch.process_start_requested_uptime`, e.events[i].ColdLaunch.ProcessStartRequestedUptime).
			Set(`cold_launch.content_provider_attach_uptime`, e.events[i].ColdLaunch.ContentProviderAttachUptime).
			Set(`cold_launch.on_next_draw_uptime`, e.events[i].ColdLaunch.OnNextDrawUptime).
			Set(`cold_launch.launched_activity`, e.events[i].ColdLaunch.LaunchedActivity).
			Set(`cold_launch.has_saved_state`, e.events[i].ColdLaunch.HasSavedState).
			Set(`cold_launch.intent_data`, e.events[i].ColdLaunch.IntentData).
			Set(`cold_launch.duration`, e.events[i].ColdLaunch.Duration.Milliseconds()).

			// warm launch
			Set(`warm_launch.app_visible_uptime`, e.events[i].WarmLaunch.AppVisibleUptime).
			Set(`warm_launch.on_next_draw_uptime`, e.events[i].WarmLaunch.OnNextDrawUptime).
			Set(`warm_launch.launched_activity`, e.events[i].WarmLaunch.LaunchedActivity).
			Set(`warm_launch.has_saved_state`, e.events[i].WarmLaunch.HasSavedState).
			Set(`warm_launch.intent_data`, e.events[i].WarmLaunch.IntentData).
			Set(`warm_launch.duration`, e.events[i].WarmLaunch.Duration.Milliseconds()).

			// hot launch
			Set(`hot_launch.app_visible_uptime`, e.events[i].HotLaunch.AppVisibleUptime).
			Set(`hot_launch.on_next_draw_uptime`, e.events[i].HotLaunch.OnNextDrawUptime).
			Set(`hot_launch.launched_activity`, e.events[i].HotLaunch.LaunchedActivity).
			Set(`hot_launch.has_saved_state`, e.events[i].HotLaunch.HasSavedState).
			Set(`hot_launch.intent_data`, e.events[i].HotLaunch.IntentData).
			Set(`hot_launch.duration`, e.events[i].HotLaunch.Duration.Milliseconds()).

			// network change
			Set(`network_change.network_type`, e.events[i].NetworkChange.NetworkType).
			Set(`network_change.previous_network_type`, e.events[i].NetworkChange.PreviousNetworkType).
			Set(`network_change.network_generation`, e.events[i].NetworkChange.NetworkGeneration).
			Set(`network_change.previous_network_generation`, e.events[i].NetworkChange.PreviousNetworkGeneration).

			// http
			Set(`http.url`, e.events[i].Http.URL).
			Set(`http.method`, e.events[i].Http.Method).
			Set(`http.status_code`, e.events[i].Http.StatusCode).
			Set(`http.start_time`, e.events[i].Http.StartTime).
			Set(`http.end_time`, e.events[i].Http.EndTime).
			Set(`http_request_headers`, e.events[i].Http.RequestHeaders).
			Set(`http_response_headers`, e.events[i].Http.ResponseHeaders).
			Set(`http.request_body`, e.events[i].Http.RequestBody).
			Set(`http.response_body`, e.events[i].Http.ResponseBody).
			Set(`http.failure_reason`, e.events[i].Http.FailureReason).
			Set(`http.failure_description`, e.events[i].Http.FailureDescription).
			Set(`http.client`, e.events[i].Http.Client).

			// memory usage
			Set(`memory_usage.java_max_heap`, e.events[i].MemoryUsage.JavaMaxHeap).
			Set(`memory_usage.java_total_heap`, e.events[i].MemoryUsage.JavaTotalHeap).
			Set(`memory_usage.java_free_heap`, e.events[i].MemoryUsage.JavaFreeHeap).
			Set(`memory_usage.total_pss`, e.events[i].MemoryUsage.TotalPSS).
			Set(`memory_usage.rss`, e.events[i].MemoryUsage.RSS).
			Set(`memory_usage.native_total_heap`, e.events[i].MemoryUsage.NativeTotalHeap).
			Set(`memory_usage.native_free_heap`, e.events[i].MemoryUsage.NativeFreeHeap).
			Set(`memory_usage.interval_config`, e.events[i].MemoryUsage.IntervalConfig).

			// low memory
			Set(`low_memory.java_max_heap`, e.events[i].LowMemory.JavaMaxHeap).
			Set(`low_memory.java_total_heap`, e.events[i].MemoryUsage.JavaTotalHeap).
			Set(`low_memory.java_free_heap`, e.events[i].LowMemory.JavaFreeHeap).
			Set(`low_memory.total_pss`, e.events[i].LowMemory.TotalPSS).
			Set(`low_memory.rss`, e.events[i].LowMemory.RSS).
			Set(`low_memory.native_total_heap`, e.events[i].LowMemory.NativeTotalHeap).
			Set(`low_memory.native_free_heap`, e.events[i].LowMemory.NativeFreeHeap).

			// trim memory
			Set(`trim_memory.level`, e.events[i].TrimMemory.Level).

			// cpu usage
			Set(`cpu_usage.num_cores`, e.events[i].CPUUsage.NumCores).
			Set(`cpu_usage.clock_speed`, e.events[i].CPUUsage.ClockSpeed).
			Set(`cpu_usage.uptime`, e.events[i].CPUUsage.Uptime).
			Set(`cpu_usage.utime`, e.events[i].CPUUsage.UTime).
			Set(`cpu_usage.cutime`, e.events[i].CPUUsage.CUTime).
			Set(`cpu_usage.stime`, e.events[i].CPUUsage.STime).
			Set(`cpu_usage.cstime`, e.events[i].CPUUsage.CSTime).
			Set(`cpu_usage.interval_config`, e.events[i].CPUUsage.IntervalConfig).

			// navigation
			Set(`navigation.route`, e.events[i].Navigation.Route).

			// attachments
			Set(`attachments`, attachments)
	}

	return server.Server.ChPool.AsyncInsert(ctx, stmt.String(), false, stmt.Args()...)
}

// lookupCountry looks up the country code for the IP
// and infuses the country code and IP info to each event.
func lookCountry(events []event.EventField, rawIP string) error {
	ip := net.ParseIP(rawIP)
	country, err := inet.LookupCountry(rawIP)
	if err != nil {
		return err
	}

	bogon, err := ipinfo.GetIPBogon(ip)
	if err != nil {
		return err
	}

	v4 := inet.Isv4(ip)

	for i := range events {
		if v4 {
			events[i].IPv4 = ip
		} else {
			events[i].IPv6 = ip
		}

		if bogon {
			events[i].CountryCode = "bogon"
		} else if *country != "" {
			events[i].CountryCode = *country
		} else {
			events[i].CountryCode = "not available"
		}
	}

	return nil
}

func PutEvent(c *gin.Context) {
	type payload struct {
		Events []event.EventField `json:"events" binding:"required"`
	}

	var p payload
	if err := c.ShouldBindJSON(&p); err != nil {
		msg := `failed to decode events payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err := lookCountry(p.Events, c.ClientIP()); err != nil {
		msg := fmt.Sprintf(`could not process request, failed to lookup country info for IP %q`, c.ClientIP())
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	for _, event := range p.Events {
		fmt.Printf("%+v\n", event)
	}

	c.JSON(http.StatusNotImplemented, gin.H{"ok": "ok"})
}

func PutEventMulti(c *gin.Context) {
	appId, err := uuid.Parse(c.GetString("appId"))
	if err != nil {
		msg := `error parsing app's uuid`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	ctx := c.Request.Context()

	app, err := SelectApp(ctx, appId)
	if err != nil {
		msg := `failed to lookup app`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	msg := `failed to parse events payload`
	eventReq := eventreq{
		appId:       appId,
		symbolicate: make(map[uuid.UUID]int),
	}

	if err := eventReq.read(c, appId); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := eventReq.validate(); err != nil {
		msg := `failed to validate events payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := eventReq.infuseInet(c.ClientIP()); err != nil {
		msg := fmt.Sprintf(`failed to lookup country info for IP: %q`, c.ClientIP())
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if eventReq.needsSymbolication() {
		// symbolicate
		symbolicator, err := symbol.NewSymbolicator(&symbol.Options{
			Origin: os.Getenv("SYMBOLICATOR_ORIGIN"),
			Store:  server.Server.PgPool,
		})
		if err != nil {
			msg := `failed to initialize symbolicator`
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}

		batches := symbolicator.Batch(eventReq.events)
		fmt.Println("batches", batches)
		ctx := context.Background()

		for i := range batches {
			if err := symbolicator.Symbolicate(ctx, batches[i]); err != nil {
				msg := `failed to symbolicate batch`
				fmt.Println(msg, err)
				c.JSON(http.StatusInternalServerError, gin.H{
					"error":   msg,
					"details": err.Error(),
				})
				return
			}
			fmt.Println("symbolicated batch events", batches[i].Events)

			// handle symbolication errors
			if len(batches[i].Errs) > 0 {
				for _, err := range batches[i].Errs {
					fmt.Println("symbolication err: ", err.Error())
				}
			}

			// rewrite symbolicated events
			for j := range batches[i].Events {
				eventId := batches[i].Events[j].ID
				idx, exists := eventReq.symbolicate[eventId]
				if !exists {
					continue
				}
				eventReq.events[idx] = batches[i].Events[j]
				delete(eventReq.symbolicate, eventId)
			}
		}
	}

	if eventReq.hasAttachments() {
		if err := eventReq.uploadAttachments(); err != nil {
			msg := `failed to upload attachments`
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})
			return
		}
	}

	tx, err := server.Server.PgPool.Begin(ctx)
	if err != nil {
		msg := `failed to ingest events, failed to acquire transaction`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	eventReq.transaction = &tx
	defer tx.Rollback(ctx)

	if err := eventReq.ingest(ctx); err != nil {
		msg := `failed to ingest events`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if err := eventReq.bucketUnhandledExceptions(&tx); err != nil {
		msg := `failed to bucket unhandled exceptions`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if err := eventReq.bucketANRs(&tx); err != nil {
		msg := `failed to bucket anrs`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if !app.Onboarded {
		firstEvent := eventReq.events[0]
		uniqueID := firstEvent.Attribute.AppUniqueID
		platform := firstEvent.Attribute.Platform
		version := firstEvent.Attribute.AppVersion

		if err := app.Onboard(tx, uniqueID, platform, version); err != nil {
			msg := `failed to onboard app`
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		msg := `failed to ingest events`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	fmt.Println("events", eventReq.events)
	fmt.Println("event req", eventReq.attachments)
	fmt.Println("size", eventReq.size)
	fmt.Println("has attachments", eventReq.hasAttachments())
	fmt.Println("needs symbolication", eventReq.needsSymbolication())
	c.JSON(http.StatusAccepted, gin.H{"events": eventReq.events})
}
