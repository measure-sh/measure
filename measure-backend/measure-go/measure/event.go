package measure

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"measure-backend/measure-go/chrono"
	"measure-backend/measure-go/event"
	"measure-backend/measure-go/filter"
	"measure-backend/measure-go/group"
	"measure-backend/measure-go/inet"
	"measure-backend/measure-go/server"
	"measure-backend/measure-go/symbol"
	"mime/multipart"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"slices"
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
	key      string
	location string
	header   *multipart.FileHeader
	uploaded bool
}

type eventreq struct {
	id                     uuid.UUID
	appId                  uuid.UUID
	symbolicate            map[uuid.UUID]int
	exceptionIds           []int
	anrIds                 []int
	size                   int64
	symbolicationAttempted int
	events                 []event.EventField
	attachments            map[uuid.UUID]*attachment
}

// uploadAttachments prepares and uploads each attachment.
func (e *eventreq) uploadAttachments() error {
	for id, attachment := range e.attachments {
		ext := filepath.Ext(attachment.header.Filename)
		key := attachment.id.String() + ext

		eventAttachment := event.Attachment{
			ID:   id,
			Name: attachment.header.Filename,
			Key:  key,
		}

		file, err := attachment.header.Open()
		if err != nil {
			return err
		}

		eventAttachment.Reader = file

		output, err := eventAttachment.Upload()
		if err != nil {
			return err
		}

		attachment.uploaded = true
		attachment.key = key
		attachment.location = output.Location
	}

	return nil
}

// bumpSize increases the payload size of
// events in bytes.
func (e *eventreq) bumpSize(n int64) {
	e.size = e.size + n
}

// bumpSymbolication increases count of symbolication
// attempted by 1.
func (e *eventreq) bumpSymbolication() {
	e.symbolicationAttempted = e.symbolicationAttempted + 1
}

// read parses and validates the event request payload for
// events and attachments.
func (e *eventreq) read(c *gin.Context, appId uuid.UUID) error {
	reqIdKey := `msr-req-id`
	reqIdVal := c.Request.Header.Get(reqIdKey)
	if reqIdVal == "" {
		return fmt.Errorf("no %q header value found", reqIdKey)
	}

	reqId, err := uuid.Parse(reqIdVal)
	if err != nil {
		return fmt.Errorf("%q value is not a valid UUID", reqIdKey)
	}

	e.id = reqId

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
		e.attachments[blobId] = &attachment{
			id:     blobId,
			name:   header.Filename,
			header: header,
		}
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

// seen checks if the event request has been
// processed already or not.
func (e eventreq) seen(ctx context.Context) (seen bool, err error) {
	stmt := sqlf.PostgreSQL.
		From(`public.event_reqs`).
		Select("1").
		Where("id = ? and app_id = ?", e.id, e.appId)

	defer stmt.Close()

	if err = server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(nil); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return
	}

	seen = true

	return
}

// save saves the processed event request to persistent
// storage.
func (e eventreq) save(ctx context.Context, tx *pgx.Tx) (err error) {
	stmt := sqlf.PostgreSQL.
		InsertInto(`public.event_reqs`).
		Set(`id`, e.id).
		Set(`app_id`, e.appId).
		Set(`event_count`, len(e.events)).
		Set(`attachment_count`, len(e.attachments)).
		Set(`session_count`, e.sessionCount()).
		Set(`bytes_in`, e.size).
		Set(`symbolication_attempts_count`, e.symbolicationAttempted)

	defer stmt.Close()

	_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)

	return
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

// hasAttachments returns true if payload
// contains attachments to be processed.
func (e eventreq) hasAttachments() bool {
	return len(e.attachments) > 0
}

// getSymbolicationEvents extracts events from
// the event request that should be symbolicated.
func (e eventreq) getSymbolicationEvents() (events []event.EventField) {
	if !e.needsSymbolication() {
		return
	}

	for _, v := range e.symbolicate {
		events = append(events, e.events[v])
	}

	return
}

// getUnhandledExceptions returns unhandled excpetions
// from the event payload.
func (e eventreq) getUnhandledExceptions() (events []event.EventField) {
	if !e.hasUnhandledExceptions() {
		return
	}
	for _, v := range e.exceptionIds {
		events = append(events, e.events[v])
	}
	return
}

// getANRs returns ANRs from the event payload.
func (e eventreq) getANRs() (events []event.EventField) {
	if !e.hasANRs() {
		return
	}
	for _, v := range e.anrIds {
		events = append(events, e.events[v])
	}
	return
}

// bucketUnhandledExceptions groups unhandled exceptions
// based on similarity.
func (e eventreq) bucketUnhandledExceptions(ctx context.Context, tx *pgx.Tx) (err error) {
	events := e.getUnhandledExceptions()

	app := App{
		ID: &e.appId,
	}

	for i := range events {
		if events[i].Exception.Fingerprint == "" {
			msg := fmt.Sprintf("no fingerprint found for event %q, cannot bucket exception", events[i].ID)
			fmt.Println(msg)
			continue
		}

		exceptionGroups, err := app.GetExceptionGroups(ctx, nil)
		if err != nil {
			return err
		}

		fingerprint, err := strconv.ParseUint(events[i].Exception.Fingerprint, 16, 64)
		if err != nil {
			return err
		}

		matchedGroup, err := group.ClosestExceptionGroup(exceptionGroups, fingerprint)
		if err != nil {
			return err
		}

		if matchedGroup == nil {
			exceptionGroup := group.NewExceptionGroup(events[i].AppID, events[i].Exception.GetType(), events[i].Exception.Fingerprint, []uuid.UUID{events[i].ID}, events[i].Timestamp)

			if err := exceptionGroup.Insert(ctx, tx); err != nil {
				return err
			}

			matchedGroup = exceptionGroup
		}

		if !matchedGroup.EventExists(events[i].ID) {
			if err := matchedGroup.AppendEvent(ctx, &events[i], tx); err != nil {
				return err
			}
		}
	}

	return
}

// bucketANRs groups ANRs based on similarity.
func (e eventreq) bucketANRs(ctx context.Context, tx *pgx.Tx) (err error) {
	events := e.getANRs()

	app := App{
		ID: &e.appId,
	}

	for i := range events {
		if events[i].ANR.Fingerprint == "" {
			msg := fmt.Sprintf("no fingerprint found for event %q, cannot bucket ANR", events[i].ID)
			fmt.Println(msg)
			continue
		}

		anrGroups, err := app.GetANRGroups(ctx, nil)
		if err != nil {
			return err
		}

		fingerprint, err := strconv.ParseUint(events[i].ANR.Fingerprint, 16, 64)
		if err != nil {
			return err
		}

		matchedGroup, err := group.ClosestANRGroup(anrGroups, fingerprint)
		if err != nil {
			return err
		}

		if matchedGroup == nil {
			anrGroup := group.NewANRGroup(events[i].AppID, events[i].ANR.GetType(), events[i].ANR.Fingerprint, []uuid.UUID{events[i].ID}, events[i].Timestamp)

			if err := anrGroup.Insert(ctx, tx); err != nil {
				return err
			}

			matchedGroup = anrGroup
		}

		if !matchedGroup.EventExists(events[i].ID) {
			if err := matchedGroup.AppendEvent(ctx, &events[i], tx); err != nil {
				return err
			}
		}
	}

	return
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
			if err := e.events[i].ANR.ComputeANRFingerprint(); err != nil {
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
			if err := e.events[i].Exception.ComputeExceptionFingerprint(); err != nil {
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

		row := stmt.NewRow().
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

			// attachments
			Set(`attachments`, attachments)

		// anr
		if e.events[i].IsANR() {
			row.
				Set(`anr.handled`, e.events[i].ANR.Handled).
				Set(`anr.fingerprint`, e.events[i].ANR.Fingerprint).
				Set(`anr.exceptions`, anrExceptions).
				Set(`anr.threads`, anrThreads).
				Set(`anr.foreground`, e.events[i].ANR.Foreground)
		} else {
			row.
				Set(`anr.handled`, nil).
				Set(`anr.fingerprint`, nil).
				Set(`anr.exceptions`, nil).
				Set(`anr.threads`, nil).
				Set(`anr.foreground`, nil)
		}

		// exception
		if e.events[i].IsException() {
			row.
				Set(`exception.handled`, e.events[i].Exception.Handled).
				Set(`exception.fingerprint`, e.events[i].Exception.Fingerprint).
				Set(`exception.exceptions`, exceptionExceptions).
				Set(`exception.threads`, exceptionThreads).
				Set(`exception.foreground`, e.events[i].Exception.Foreground)
		} else {
			row.
				Set(`exception.handled`, nil).
				Set(`exception.fingerprint`, nil).
				Set(`exception.exceptions`, nil).
				Set(`exception.threads`, nil).
				Set(`exception.foreground`, nil)
		}

		// app exit
		if e.events[i].IsAppExit() {
			row.
				Set(`app_exit.reason`, e.events[i].AppExit.Reason).
				Set(`app_exit.importance`, e.events[i].AppExit.Importance).
				Set(`app_exit.trace`, e.events[i].AppExit.Trace).
				Set(`app_exit.process_name`, e.events[i].AppExit.ProcessName).
				Set(`app_exit.pid`, e.events[i].AppExit.PID)
		} else {
			row.
				Set(`app_exit.reason`, nil).
				Set(`app_exit.importance`, nil).
				Set(`app_exit.trace`, nil).
				Set(`app_exit.process_name`, nil).
				Set(`app_exit.pid`, nil)
		}

		// string
		if e.events[i].IsString() {
			row.
				Set(`string.severity_text`, e.events[i].LogString.SeverityText).
				Set(`string.string`, e.events[i].LogString.String)
		} else {
			row.
				Set(`string.severity_text`, nil).
				Set(`string.string`, nil)
		}

		// gesture long click
		if e.events[i].IsGestureLongClick() {
			row.
				Set(`gesture_long_click.target`, e.events[i].GestureLongClick.Target).
				Set(`gesture_long_click.target_id`, e.events[i].GestureLongClick.TargetID).
				Set(`gesture_long_click.touch_down_time`, e.events[i].GestureLongClick.TouchDownTime).
				Set(`gesture_long_click.touch_up_time`, e.events[i].GestureLongClick.TouchUpTime).
				Set(`gesture_long_click.width`, e.events[i].GestureLongClick.Width).
				Set(`gesture_long_click.height`, e.events[i].GestureLongClick.Height).
				Set(`gesture_long_click.x`, e.events[i].GestureLongClick.X).
				Set(`gesture_long_click.y`, e.events[i].GestureLongClick.Y)
		} else {
			row.
				Set(`gesture_long_click.target`, nil).
				Set(`gesture_long_click.target_id`, nil).
				Set(`gesture_long_click.touch_down_time`, nil).
				Set(`gesture_long_click.touch_up_time`, nil).
				Set(`gesture_long_click.width`, nil).
				Set(`gesture_long_click.height`, nil).
				Set(`gesture_long_click.x`, nil).
				Set(`gesture_long_click.y`, nil)
		}

		// gesture click
		if e.events[i].IsGestureClick() {
			row.
				Set(`gesture_click.target`, e.events[i].GestureClick.Target).
				Set(`gesture_click.target_id`, e.events[i].GestureClick.TargetID).
				Set(`gesture_click.touch_down_time`, e.events[i].GestureClick.TouchDownTime).
				Set(`gesture_click.touch_up_time`, e.events[i].GestureClick.TouchUpTime).
				Set(`gesture_click.width`, e.events[i].GestureClick.Width).
				Set(`gesture_click.height`, e.events[i].GestureClick.Height).
				Set(`gesture_click.x`, e.events[i].GestureClick.X).
				Set(`gesture_click.y`, e.events[i].GestureClick.Y)
		} else {
			row.
				Set(`gesture_click.target`, nil).
				Set(`gesture_click.target_id`, nil).
				Set(`gesture_click.touch_down_time`, nil).
				Set(`gesture_click.touch_up_time`, nil).
				Set(`gesture_click.width`, nil).
				Set(`gesture_click.height`, nil).
				Set(`gesture_click.x`, nil).
				Set(`gesture_click.y`, nil)
		}

		// gesture scroll
		if e.events[i].IsGestureScroll() {
			row.
				Set(`gesture_scroll.target`, e.events[i].GestureScroll.Target).
				Set(`gesture_scroll.target_id`, e.events[i].GestureScroll.TargetID).
				Set(`gesture_scroll.touch_down_time`, e.events[i].GestureScroll.TouchDownTime).
				Set(`gesture_scroll.touch_up_time`, e.events[i].GestureScroll.TouchUpTime).
				Set(`gesture_scroll.x`, e.events[i].GestureScroll.X).
				Set(`gesture_scroll.y`, e.events[i].GestureScroll.Y).
				Set(`gesture_scroll.end_x`, e.events[i].GestureScroll.EndX).
				Set(`gesture_scroll.end_y`, e.events[i].GestureScroll.EndY).
				Set(`gesture_scroll.direction`, e.events[i].GestureScroll.Direction)
		} else {
			row.
				Set(`gesture_scroll.target`, nil).
				Set(`gesture_scroll.target_id`, nil).
				Set(`gesture_scroll.touch_down_time`, nil).
				Set(`gesture_scroll.touch_up_time`, nil).
				Set(`gesture_scroll.x`, nil).
				Set(`gesture_scroll.y`, nil).
				Set(`gesture_scroll.end_x`, nil).
				Set(`gesture_scroll.end_y`, nil).
				Set(`gesture_scroll.direction`, nil)
		}

		// lifecycle activity
		if e.events[i].IsLifecycleActivity() {
			row.
				Set(`lifecycle_activity.type`, e.events[i].LifecycleActivity.Type).
				Set(`lifecycle_activity.class_name`, e.events[i].LifecycleActivity.ClassName).
				Set(`lifecycle_activity.intent`, e.events[i].LifecycleActivity.Intent).
				Set(`lifecycle_activity.saved_instance_state`, e.events[i].LifecycleActivity.SavedInstanceState)
		} else {
			row.
				Set(`lifecycle_activity.type`, nil).
				Set(`lifecycle_activity.class_name`, nil).
				Set(`lifecycle_activity.intent`, nil).
				Set(`lifecycle_activity.saved_instance_state`, nil)
		}

		// lifecycle fragment
		if e.events[i].IsLifecycleFragment() {
			row.
				Set(`lifecycle_fragment.type`, e.events[i].LifecycleFragment.Type).
				Set(`lifecycle_fragment.class_name`, e.events[i].LifecycleFragment.ClassName).
				Set(`lifecycle_fragment.parent_activity`, e.events[i].LifecycleFragment.ParentActivity).
				Set(`lifecycle_fragment.tag`, e.events[i].LifecycleFragment.Tag)
		} else {
			row.
				Set(`lifecycle_fragment.type`, nil).
				Set(`lifecycle_fragment.class_name`, nil).
				Set(`lifecycle_fragment.parent_activity`, nil).
				Set(`lifecycle_fragment.tag`, nil)
		}

		// lifecycle app
		if e.events[i].IsLifecycleApp() {
			row.
				Set(`lifecycle_app.type`, e.events[i].LifecycleApp.Type)
		} else {
			row.
				Set(`lifecycle_app.type`, nil)
		}

		// cold launch
		if e.events[i].IsColdLaunch() {
			row.
				Set(`cold_launch.process_start_uptime`, e.events[i].ColdLaunch.ProcessStartUptime).
				Set(`cold_launch.process_start_requested_uptime`, e.events[i].ColdLaunch.ProcessStartRequestedUptime).
				Set(`cold_launch.content_provider_attach_uptime`, e.events[i].ColdLaunch.ContentProviderAttachUptime).
				Set(`cold_launch.on_next_draw_uptime`, e.events[i].ColdLaunch.OnNextDrawUptime).
				Set(`cold_launch.launched_activity`, e.events[i].ColdLaunch.LaunchedActivity).
				Set(`cold_launch.has_saved_state`, e.events[i].ColdLaunch.HasSavedState).
				Set(`cold_launch.intent_data`, e.events[i].ColdLaunch.IntentData).
				Set(`cold_launch.duration`, e.events[i].ColdLaunch.Duration.Milliseconds())
		} else {
			row.
				Set(`cold_launch.process_start_uptime`, nil).
				Set(`cold_launch.process_start_requested_uptime`, nil).
				Set(`cold_launch.content_provider_attach_uptime`, nil).
				Set(`cold_launch.on_next_draw_uptime`, nil).
				Set(`cold_launch.launched_activity`, nil).
				Set(`cold_launch.has_saved_state`, nil).
				Set(`cold_launch.intent_data`, nil).
				Set(`cold_launch.duration`, nil)

		}

		// warm launch
		if e.events[i].IsWarmLaunch() {
			row.
				Set(`warm_launch.app_visible_uptime`, e.events[i].WarmLaunch.AppVisibleUptime).
				Set(`warm_launch.on_next_draw_uptime`, e.events[i].WarmLaunch.OnNextDrawUptime).
				Set(`warm_launch.launched_activity`, e.events[i].WarmLaunch.LaunchedActivity).
				Set(`warm_launch.has_saved_state`, e.events[i].WarmLaunch.HasSavedState).
				Set(`warm_launch.intent_data`, e.events[i].WarmLaunch.IntentData).
				Set(`warm_launch.duration`, e.events[i].WarmLaunch.Duration.Milliseconds())
		} else {
			row.
				Set(`warm_launch.app_visible_uptime`, nil).
				Set(`warm_launch.on_next_draw_uptime`, nil).
				Set(`warm_launch.launched_activity`, nil).
				Set(`warm_launch.has_saved_state`, nil).
				Set(`warm_launch.intent_data`, nil).
				Set(`warm_launch.duration`, nil)
		}

		// hot launch
		if e.events[i].IsHotLaunch() {
			row.
				Set(`hot_launch.app_visible_uptime`, e.events[i].HotLaunch.AppVisibleUptime).
				Set(`hot_launch.on_next_draw_uptime`, e.events[i].HotLaunch.OnNextDrawUptime).
				Set(`hot_launch.launched_activity`, e.events[i].HotLaunch.LaunchedActivity).
				Set(`hot_launch.has_saved_state`, e.events[i].HotLaunch.HasSavedState).
				Set(`hot_launch.intent_data`, e.events[i].HotLaunch.IntentData).
				Set(`hot_launch.duration`, e.events[i].HotLaunch.Duration.Milliseconds())
		} else {
			row.
				Set(`hot_launch.app_visible_uptime`, nil).
				Set(`hot_launch.on_next_draw_uptime`, nil).
				Set(`hot_launch.launched_activity`, nil).
				Set(`hot_launch.has_saved_state`, nil).
				Set(`hot_launch.intent_data`, nil).
				Set(`hot_launch.duration`, nil)
		}

		// network change
		if e.events[i].IsNetworkChange() {
			row.
				Set(`network_change.network_type`, e.events[i].NetworkChange.NetworkType).
				Set(`network_change.previous_network_type`, e.events[i].NetworkChange.PreviousNetworkType).
				Set(`network_change.network_generation`, e.events[i].NetworkChange.NetworkGeneration).
				Set(`network_change.previous_network_generation`, e.events[i].NetworkChange.PreviousNetworkGeneration)
		} else {
			row.
				Set(`network_change.network_type`, nil).
				Set(`network_change.previous_network_type`, nil).
				Set(`network_change.network_generation`, nil).
				Set(`network_change.previous_network_generation`, nil)
		}

		// http
		if e.events[i].IsHttp() {
			row.
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
				Set(`http.client`, e.events[i].Http.Client)
		} else {
			row.
				Set(`http.url`, nil).
				Set(`http.method`, nil).
				Set(`http.status_code`, nil).
				Set(`http.start_time`, nil).
				Set(`http.end_time`, nil).
				Set(`http_request_headers`, nil).
				Set(`http_response_headers`, nil).
				Set(`http.request_body`, nil).
				Set(`http.response_body`, nil).
				Set(`http.failure_reason`, nil).
				Set(`http.failure_description`, nil).
				Set(`http.client`, nil)

		}

		// memory usage
		if e.events[i].IsMemoryUsage() {
			row.
				Set(`memory_usage.java_max_heap`, e.events[i].MemoryUsage.JavaMaxHeap).
				Set(`memory_usage.java_total_heap`, e.events[i].MemoryUsage.JavaTotalHeap).
				Set(`memory_usage.java_free_heap`, e.events[i].MemoryUsage.JavaFreeHeap).
				Set(`memory_usage.total_pss`, e.events[i].MemoryUsage.TotalPSS).
				Set(`memory_usage.rss`, e.events[i].MemoryUsage.RSS).
				Set(`memory_usage.native_total_heap`, e.events[i].MemoryUsage.NativeTotalHeap).
				Set(`memory_usage.native_free_heap`, e.events[i].MemoryUsage.NativeFreeHeap).
				Set(`memory_usage.interval_config`, e.events[i].MemoryUsage.IntervalConfig)
		} else {
			row.
				Set(`memory_usage.java_max_heap`, nil).
				Set(`memory_usage.java_total_heap`, nil).
				Set(`memory_usage.java_free_heap`, nil).
				Set(`memory_usage.total_pss`, nil).
				Set(`memory_usage.rss`, nil).
				Set(`memory_usage.native_total_heap`, nil).
				Set(`memory_usage.native_free_heap`, nil).
				Set(`memory_usage.interval_config`, nil)
		}

		// low memory
		if e.events[i].IsLowMemory() {
			row.
				Set(`low_memory.java_max_heap`, e.events[i].LowMemory.JavaMaxHeap).
				Set(`low_memory.java_total_heap`, e.events[i].MemoryUsage.JavaTotalHeap).
				Set(`low_memory.java_free_heap`, e.events[i].LowMemory.JavaFreeHeap).
				Set(`low_memory.total_pss`, e.events[i].LowMemory.TotalPSS).
				Set(`low_memory.rss`, e.events[i].LowMemory.RSS).
				Set(`low_memory.native_total_heap`, e.events[i].LowMemory.NativeTotalHeap).
				Set(`low_memory.native_free_heap`, e.events[i].LowMemory.NativeFreeHeap)
		} else {
			row.
				Set(`low_memory.java_max_heap`, nil).
				Set(`low_memory.java_total_heap`, nil).
				Set(`low_memory.java_free_heap`, nil).
				Set(`low_memory.total_pss`, nil).
				Set(`low_memory.rss`, nil).
				Set(`low_memory.native_total_heap`, nil).
				Set(`low_memory.native_free_heap`, nil)
		}

		// trim memory
		if e.events[i].IsTrimMemory() {
			row.
				Set(`trim_memory.level`, e.events[i].TrimMemory.Level)
		} else {
			row.
				Set(`trim_memory.level`, nil)
		}

		// cpu usage
		if e.events[i].IsCPUUsage() {
			row.
				Set(`cpu_usage.num_cores`, e.events[i].CPUUsage.NumCores).
				Set(`cpu_usage.clock_speed`, e.events[i].CPUUsage.ClockSpeed).
				Set(`cpu_usage.uptime`, e.events[i].CPUUsage.Uptime).
				Set(`cpu_usage.utime`, e.events[i].CPUUsage.UTime).
				Set(`cpu_usage.cutime`, e.events[i].CPUUsage.CUTime).
				Set(`cpu_usage.stime`, e.events[i].CPUUsage.STime).
				Set(`cpu_usage.cstime`, e.events[i].CPUUsage.CSTime).
				Set(`cpu_usage.interval_config`, e.events[i].CPUUsage.IntervalConfig)
		} else {
			row.
				Set(`cpu_usage.num_cores`, nil).
				Set(`cpu_usage.clock_speed`, nil).
				Set(`cpu_usage.uptime`, nil).
				Set(`cpu_usage.utime`, nil).
				Set(`cpu_usage.cutime`, nil).
				Set(`cpu_usage.stime`, nil).
				Set(`cpu_usage.cstime`, nil).
				Set(`cpu_usage.interval_config`, nil)

		}

		// navigation
		if e.events[i].IsNavigation() {
			row.
				Set(`navigation.to`, e.events[i].Navigation.To).
				Set(`navigation.from`, e.events[i].Navigation.From).
				Set(`navigation.source`, e.events[i].Navigation.Source)
		} else {
			row.
				Set(`navigation.to`, nil).
				Set(`navigation.from`, nil).
				Set(`navigation.source`, nil)
		}

	}

	return server.Server.ChPool.AsyncInsert(ctx, stmt.String(), false, stmt.Args()...)
}

// sessionCount counts and provides the number of
// sessions in event request.
func (e eventreq) sessionCount() (count int) {
	sessions := []uuid.UUID{}

	for i := range e.events {
		if !slices.Contains(sessions, e.events[i].SessionID) {
			sessions = append(sessions, e.events[i].SessionID)
		}
	}

	return len(sessions)
}

// GetExceptionsWithFilter returns a slice of EventException for the given slice of
// event id and matching AppFilter. Also computes the next, previous pagination meta
// values.
func GetExceptionsWithFilter(ctx context.Context, eventIds []uuid.UUID, af *filter.AppFilter) (events []event.EventException, next bool, previous bool, err error) {
	var edgecount int
	var countStmt *sqlf.Stmt
	var exceptions string
	var threads string
	var attachments string

	limit := af.ExtendLimit()
	forward := af.HasPositiveLimit()
	next = false
	previous = false
	timeformat := "2006-01-02T15:04:05.000"
	abs := af.LimitAbs()
	op := "<"
	if !forward {
		op = ">"
	}

	if !af.HasKeyset() && !forward {
		next = true
		return
	}

	if af.HasKeyset() {
		args := []any{}
		op := ">"
		if !forward {
			op = "<"
		}

		var ids []uuid.UUID
		countStmt = sqlf.Select("id").
			From("default.events").
			Where("`id` in (?)", nil).
			Where("`timestamp` "+op+" ? or (`timestamp` = ? and `id` "+op+" ?)", nil, nil, nil).
			OrderBy("`timestamp` desc", "`id` desc").
			Limit(nil)
		defer countStmt.Close()

		timestamp := af.KeyTimestamp.Format(timeformat)
		args = append(args, eventIds, timestamp, timestamp, af.KeyID)

		if len(af.Versions) > 0 {
			countStmt.Where("`attribute.app_version` in (?)", nil)
			args = append(args, af.Versions)
		}

		if len(af.VersionCodes) > 0 {
			countStmt.Where("`attribute.app_build` in (?)", nil)
			args = append(args, af.VersionCodes)
		}

		if len(af.Countries) > 0 {
			countStmt.Where("`inet.country_code` in (?)", nil)
			args = append(args, af.Countries)
		}

		if len(af.DeviceNames) > 0 {
			countStmt.Where("`attribute.device_name` in (?)", nil)
			args = append(args, af.DeviceNames)
		}

		if len(af.DeviceManufacturers) > 0 {
			countStmt.Where("`attribute.device_manufacturer` in (?)", nil)
			args = append(args, af.DeviceManufacturers)
		}

		if len(af.Locales) > 0 {
			countStmt.Where("`attribute.device_locale` in (?)", nil)
			args = append(args, af.Locales)
		}

		if len(af.NetworkProviders) > 0 {
			countStmt.Where("`attribute.network_provider` in (?)", nil)
			args = append(args, af.NetworkProviders)
		}

		if len(af.NetworkTypes) > 0 {
			countStmt.Where("`attribute.network_type` in (?)", nil)
			args = append(args, af.NetworkTypes)
		}

		if len(af.NetworkGenerations) > 0 {
			countStmt.Where("`attribute.network_generation` in (?)", nil)
			args = append(args, af.NetworkGenerations)
		}

		if af.HasTimeRange() {
			countStmt.Where("`timestamp` >= ? and `timestamp` <= ?", nil, nil)
			args = append(args, af.From, af.To)
		}

		// add limit
		args = append(args, 1)

		rows, err := server.Server.ChPool.Query(ctx, countStmt.String(), args...)
		if err != nil {
			return nil, next, previous, err
		}

		for rows.Next() {
			var id uuid.UUID
			rows.Scan(&id)
			ids = append(ids, id)
		}
		edgecount = len(ids)
	}

	cols := []string{
		`id`,
		`session_id`,
		`toString(type)`,
		`timestamp`,
		`attribute.installation_id`,
		`toString(attribute.device_name)`,
		`toString(attribute.device_model)`,
		`toString(attribute.device_manufacturer)`,
		`toString(attribute.device_type)`,
		`attribute.device_is_foldable`,
		`attribute.device_is_physical`,
		`attribute.device_density_dpi`,
		`attribute.device_width_px`,
		`attribute.device_height_px`,
		`attribute.device_density`,
		`toString(attribute.device_locale)`,
		`toString(attribute.os_name)`,
		`toString(attribute.os_version)`,
		`toString(attribute.platform)`,
		`toString(attribute.thread_name)`,
		`toString(attribute.user_id)`,
		`toString(attribute.app_version)`,
		`toString(attribute.app_build)`,
		`toString(attribute.app_unique_id)`,
		`toString(attribute.measure_sdk_version)`,
		`toString(attribute.network_type)`,
		`toString(attribute.network_generation)`,
		`toString(attribute.network_provider)`,
		`exception.handled`,
		`exception.fingerprint`,
		`exception.exceptions`,
		`exception.threads`,
		`attachments`,
	}

	stmt := sqlf.From(`default.events`)
	defer stmt.Close()

	for i := range cols {
		stmt.Select(cols[i], nil)
	}

	stmt.Where("`id` in (?)", nil)

	if forward {
		stmt.OrderBy("`timestamp` desc", "`id` desc")
	} else {
		stmt.OrderBy("`timestamp`", "`id`")
	}
	stmt.Limit(nil)
	args := []any{eventIds}

	if len(af.Versions) > 0 {
		stmt.Where("`attribute.app_version` in (?)", nil)
		args = append(args, af.Versions)
	}

	if len(af.VersionCodes) > 0 {
		stmt.Where("`attribute.app_build` in (?)", nil)
		args = append(args, af.VersionCodes)
	}

	if len(af.Countries) > 0 {
		stmt.Where("`inet.country_code` in (?)", nil)
		args = append(args, af.Countries)
	}

	if len(af.DeviceNames) > 0 {
		stmt.Where("`attribute.device_name` in (?)", nil)
		args = append(args, af.DeviceNames)
	}

	if len(af.DeviceManufacturers) > 0 {
		stmt.Where("`attribute.device_manufacturer` in (?)", nil)
		args = append(args, af.DeviceManufacturers)
	}

	if len(af.Locales) > 0 {
		stmt.Where("`attribute.device_locale` in (?)", nil)
		args = append(args, af.Locales)
	}

	if len(af.NetworkProviders) > 0 {
		stmt.Where("`attribute.network_provider` in (?)", nil)
		args = append(args, af.NetworkProviders)
	}

	if len(af.NetworkTypes) > 0 {
		stmt.Where("`attribute.network_type` in (?)", nil)
		args = append(args, af.NetworkTypes)
	}

	if len(af.NetworkGenerations) > 0 {
		stmt.Where("`attribute.network_generation` in (?)", nil)
		args = append(args, af.NetworkGenerations)
	}

	if af.HasTimeRange() {
		stmt.Where("`timestamp` >= ? and `timestamp` <= ?", nil, nil)
		args = append(args, af.From, af.To)
	}

	if af.HasKeyset() {
		stmt.Where("`timestamp` "+op+" ? or (`timestamp` = ? and `id` "+op+" ?)", nil, nil, nil)
		timestamp := af.KeyTimestamp.Format(timeformat)
		args = append(args, timestamp, timestamp, af.KeyID)
	}

	args = append(args, limit)

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), args...)
	if err != nil {
		return
	}

	for rows.Next() {
		var e event.EventException
		fields := []any{
			&e.ID,
			&e.SessionID,
			&e.Type,
			&e.Timestamp,
			&e.Attribute.InstallationID,
			&e.Attribute.DeviceName,
			&e.Attribute.DeviceModel,
			&e.Attribute.DeviceManufacturer,
			&e.Attribute.DeviceType,
			&e.Attribute.DeviceIsFoldable,
			&e.Attribute.DeviceIsPhysical,
			&e.Attribute.DeviceDensityDPI,
			&e.Attribute.DeviceWidthPX,
			&e.Attribute.DeviceHeightPX,
			&e.Attribute.DeviceDensity,
			&e.Attribute.DeviceLocale,
			&e.Attribute.OSName,
			&e.Attribute.OSVersion,
			&e.Attribute.Platform,
			&e.Attribute.ThreadName,
			&e.Attribute.UserID,
			&e.Attribute.AppVersion,
			&e.Attribute.AppBuild,
			&e.Attribute.AppUniqueID,
			&e.Attribute.MeasureSDKVersion,
			&e.Attribute.NetworkType,
			&e.Attribute.NetworkGeneration,
			&e.Attribute.NetworkProvider,
			&e.Exception.Handled,
			&e.Exception.Fingerprint,
			&exceptions,
			&threads,
			&attachments,
		}

		if err := rows.Scan(fields...); err != nil {
			return nil, next, previous, err
		}

		if err := json.Unmarshal([]byte(exceptions), &e.Exception.Exceptions); err != nil {
			return nil, next, previous, err
		}
		if err := json.Unmarshal([]byte(threads), &e.Exception.Threads); err != nil {
			return nil, next, previous, err
		}
		if err := json.Unmarshal([]byte(attachments), &e.Attachments); err != nil {
			return nil, next, previous, err
		}

		e.ComputeView()
		events = append(events, e)
	}

	length := len(events)

	if forward {
		if length > abs {
			next = true
			events = events[:length-1]
		}
		if edgecount > -1 && af.HasKeyset() {
			previous = true
		}
	} else {
		// reverse
		for i, j := 0, len(events)-1; i < j; i, j = i+1, j-1 {
			events[i], events[j] = events[j], events[i]
		}
		if length > abs {
			previous = true
			events = events[1:]
		}
		if edgecount > -1 {
			next = true
		}
	}

	return
}

// GetExceptionPlotInstances queries aggregated exception
// instances and crash free sessions by datetime and filters.
func GetExceptionPlotInstances(ctx context.Context, af *filter.AppFilter) (issueInstances []event.IssueInstance, err error) {
	base := sqlf.
		From("default.events").
		Select("formatDateTime(timestamp, '%Y-%m-%d') as datetime").
		Select("concat(toString(attribute.app_version), '', '(', toString(attribute.app_build), ')') as app_version").
		Select("type").
		Select("session_id").
		Select("attribute.app_version").
		Select("attribute.app_build").
		Select("timestamp").
		Select("exception.handled").
		Where("app_id = ?", af.AppID).
		Where("timestamp >= ? and timestamp <= ?", af.From, af.To)

	if len(af.Versions) > 0 {
		base = base.Where("attribute.app_version in ?", af.Versions)
	}

	if len(af.VersionCodes) > 0 {
		base = base.Where("attribute.app_build in ?", af.VersionCodes)
	}

	stmt := sqlf.
		With("base_exceptions", base).
		From("base_exceptions").
		Select("datetime").
		Select("app_version").
		Select("count(if(type = 'exception' and exception.handled = false, 1, NULL)) as total_exceptions").
		Select("round((1 - (exception_sessions / total_sessions)) * 100, 2) as crash_free_sessions").
		Select("count(distinct session_id) as total_sessions").
		Select("count(distinct if(type = 'exception' and exception.handled = false, session_id, NULL)) as exception_sessions").
		GroupBy("app_version, datetime").
		OrderBy("app_version, datetime")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var instance event.IssueInstance
		var ignore1, ignore2 uint64
		if err := rows.Scan(&instance.DateTime, &instance.Version, &instance.Instances, &instance.IssueFreeSessions, &ignore1, &ignore2); err != nil {
			return nil, err
		}

		if *instance.Instances > 0 {
			issueInstances = append(issueInstances, instance)
		}
	}

	if rows.Err() != nil {
		return
	}

	return
}

// GetANRsWithFilter returns a slice of EventANR for the given slice of
// event id and matching AppFilter.
func GetANRsWithFilter(ctx context.Context, eventIds []uuid.UUID, af *filter.AppFilter) (events []event.EventANR, next bool, previous bool, err error) {
	var edgecount int
	var countStmt *sqlf.Stmt
	var exceptions string
	var threads string
	var attachments string

	limit := af.ExtendLimit()
	forward := af.HasPositiveLimit()
	next = false
	previous = false
	timeformat := "2006-01-02T15:04:05.000"
	abs := af.LimitAbs()
	op := "<"
	if !forward {
		op = ">"
	}

	if !af.HasKeyset() && !forward {
		next = true
		return
	}

	if af.HasKeyset() {
		args := []any{}
		op := ">"
		if !forward {
			op = "<"
		}

		var ids []uuid.UUID
		countStmt = sqlf.Select("id").
			From("default.events").
			Where("`id` in (?)", nil).
			Where("`timestamp` "+op+" ? or (`timestamp` = ? and `id` "+op+" ?)", nil, nil, nil).
			OrderBy("`timestamp` desc", "`id` desc").
			Limit(nil)
		defer countStmt.Close()

		timestamp := af.KeyTimestamp.Format(timeformat)

		args = append(args, eventIds, timestamp, timestamp, af.KeyID)

		if len(af.Versions) > 0 {
			countStmt.Where("`attribute.app_version` in (?)", nil)
			args = append(args, af.Versions)
		}

		if len(af.VersionCodes) > 0 {
			countStmt.Where("`attribute.app_build` in (?)", nil)
			args = append(args, af.VersionCodes)
		}

		if len(af.Countries) > 0 {
			countStmt.Where("`inet.country_code` in (?)", nil)
			args = append(args, af.Countries)
		}

		if len(af.DeviceNames) > 0 {
			countStmt.Where("`attribute.device_name` in (?)", nil)
			args = append(args, af.DeviceNames)
		}

		if len(af.DeviceManufacturers) > 0 {
			countStmt.Where("`attribute.device_manufacturer` in (?)", nil)
			args = append(args, af.DeviceManufacturers)
		}

		if len(af.Locales) > 0 {
			countStmt.Where("`attribute.device_locale` in (?)", nil)
			args = append(args, af.Locales)
		}

		if len(af.NetworkProviders) > 0 {
			countStmt.Where("`attribute.network_provider` in (?)", nil)
			args = append(args, af.NetworkProviders)
		}

		if len(af.NetworkTypes) > 0 {
			countStmt.Where("`attribute.network_type` in (?)", nil)
			args = append(args, af.NetworkTypes)
		}

		if len(af.NetworkGenerations) > 0 {
			countStmt.Where("`attribute.network_generation` in (?)", nil)
			args = append(args, af.NetworkGenerations)
		}

		if af.HasTimeRange() {
			countStmt.Where("`timestamp` >= ? and `timestamp` <= ?", nil, nil)
			args = append(args, af.From, af.To)
		}

		// add limit
		args = append(args, 1)

		rows, err := server.Server.ChPool.Query(ctx, countStmt.String(), args...)
		if err != nil {
			return nil, next, previous, err
		}
		for rows.Next() {
			var id uuid.UUID
			rows.Scan(&id)
			ids = append(ids, id)
		}
		edgecount = len(ids)
	}

	cols := []string{
		`id`,
		`session_id`,
		`toString(type)`,
		`timestamp`,
		`attribute.installation_id`,
		`toString(attribute.device_name)`,
		`toString(attribute.device_model)`,
		`toString(attribute.device_manufacturer)`,
		`toString(attribute.device_type)`,
		`attribute.device_is_foldable`,
		`attribute.device_is_physical`,
		`attribute.device_density_dpi`,
		`attribute.device_width_px`,
		`attribute.device_height_px`,
		`attribute.device_density`,
		`toString(attribute.device_locale)`,
		`toString(attribute.os_name)`,
		`toString(attribute.os_version)`,
		`toString(attribute.platform)`,
		`toString(attribute.thread_name)`,
		`toString(attribute.user_id)`,
		`toString(attribute.app_version)`,
		`toString(attribute.app_build)`,
		`toString(attribute.app_unique_id)`,
		`toString(attribute.measure_sdk_version)`,
		`toString(attribute.network_type)`,
		`toString(attribute.network_generation)`,
		`toString(attribute.network_provider)`,
		`anr.handled`,
		`anr.fingerprint`,
		`anr.exceptions`,
		`anr.threads`,
		`attachments`,
	}

	stmt := sqlf.From(`default.events`)
	defer stmt.Close()

	for i := range cols {
		stmt.Select(cols[i], nil)
	}

	stmt.Where("`id` in (?)", nil)

	if forward {
		stmt.OrderBy("`timestamp` desc", "`id` desc")
	} else {
		stmt.OrderBy("`timestamp`", "`id`")
	}
	stmt.Limit(nil)
	args := []any{eventIds}

	if len(af.Versions) > 0 {
		stmt.Where("`attribute.app_version` in (?)", nil)
		args = append(args, af.Versions)
	}

	if len(af.VersionCodes) > 0 {
		stmt.Where("`attribute.app_build` in (?)", nil)
		args = append(args, af.VersionCodes)
	}

	if len(af.Countries) > 0 {
		stmt.Where("`inet.country_code` in (?)", nil)
		args = append(args, af.Countries)
	}

	if len(af.DeviceNames) > 0 {
		stmt.Where("`attribute.device_name` in (?)", nil)
		args = append(args, af.DeviceNames)
	}

	if len(af.DeviceManufacturers) > 0 {
		stmt.Where("`attribute.device_manufacturer` in (?)", nil)
		args = append(args, af.DeviceManufacturers)
	}

	if len(af.Locales) > 0 {
		stmt.Where("`attribute.device_locale` in (?)", nil)
		args = append(args, af.Locales)
	}

	if len(af.NetworkProviders) > 0 {
		stmt.Where("`attribute.network_provider` in (?)", nil)
		args = append(args, af.NetworkProviders)
	}

	if len(af.NetworkTypes) > 0 {
		stmt.Where("`attribute.network_type` in (?)", nil)
		args = append(args, af.NetworkTypes)
	}

	if len(af.NetworkGenerations) > 0 {
		stmt.Where("`attribute.network_generation` in (?)", nil)
		args = append(args, af.NetworkGenerations)
	}

	if af.HasTimeRange() {
		stmt.Where("`timestamp` >= ? and `timestamp` <= ?", nil, nil)
		args = append(args, af.From, af.To)
	}

	if af.HasKeyset() {
		stmt.Where("`timestamp` "+op+" ? or (`timestamp` = ? and `id` "+op+" ?)", nil, nil, nil)
		timestamp := af.KeyTimestamp.Format(timeformat)
		args = append(args, timestamp, timestamp, af.KeyID)
	}

	args = append(args, limit)

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), args...)
	if err != nil {
		return
	}

	for rows.Next() {
		var e event.EventANR
		fields := []any{
			&e.ID,
			&e.SessionID,
			&e.Type,
			&e.Timestamp,
			&e.Attribute.InstallationID,
			&e.Attribute.DeviceName,
			&e.Attribute.DeviceModel,
			&e.Attribute.DeviceManufacturer,
			&e.Attribute.DeviceType,
			&e.Attribute.DeviceIsFoldable,
			&e.Attribute.DeviceIsPhysical,
			&e.Attribute.DeviceDensityDPI,
			&e.Attribute.DeviceWidthPX,
			&e.Attribute.DeviceHeightPX,
			&e.Attribute.DeviceDensity,
			&e.Attribute.DeviceLocale,
			&e.Attribute.OSName,
			&e.Attribute.OSVersion,
			&e.Attribute.Platform,
			&e.Attribute.ThreadName,
			&e.Attribute.UserID,
			&e.Attribute.AppVersion,
			&e.Attribute.AppBuild,
			&e.Attribute.AppUniqueID,
			&e.Attribute.MeasureSDKVersion,
			&e.Attribute.NetworkType,
			&e.Attribute.NetworkGeneration,
			&e.Attribute.NetworkProvider,
			&e.ANR.Handled,
			&e.ANR.Fingerprint,
			&exceptions,
			&threads,
			&attachments,
		}

		if err := rows.Scan(fields...); err != nil {
			return nil, next, previous, err
		}

		if err := json.Unmarshal([]byte(exceptions), &e.ANR.Exceptions); err != nil {
			return nil, next, previous, err
		}
		if err := json.Unmarshal([]byte(threads), &e.ANR.Threads); err != nil {
			return nil, next, previous, err
		}
		if err := json.Unmarshal([]byte(attachments), &e.Attachments); err != nil {
			return nil, next, previous, err
		}

		e.ComputeView()
		events = append(events, e)
	}

	length := len(events)

	if forward {
		if length > abs {
			next = true
			events = events[:length-1]
		}
		if edgecount > -1 && af.HasKeyset() {
			previous = true
		}
	} else {
		// reverse
		for i, j := 0, len(events)-1; i < j; i, j = i+1, j-1 {
			events[i], events[j] = events[j], events[i]
		}
		if length > abs {
			previous = true
			events = events[1:]
		}
		if edgecount > -1 {
			next = true
		}
	}

	return
}

// GetANRPlotInstances queries aggregated ANRs
// instances and ANR free sessions by datetime and filters.
func GetANRPlotInstances(ctx context.Context, af *filter.AppFilter) (issueInstances []event.IssueInstance, err error) {
	base := sqlf.
		From("default.events").
		Select("formatDateTime(timestamp, '%Y-%m-%d') as datetime").
		Select("concat(toString(attribute.app_version), ' ', '(', toString(attribute.app_build), ')') as app_version").
		Select("type").
		Select("session_id").
		Select("attribute.app_version").
		Select("attribute.app_build").
		Select("timestamp").
		Where("app_id = ?", af.AppID).
		Where("timestamp >= ? and timestamp <= ?", af.From, af.To)

	if len(af.Versions) > 0 {
		base = base.Where("attribute.app_version in ?", af.Versions)
	}

	if len(af.VersionCodes) > 0 {
		base = base.Where("attribute.app_build in ?", af.VersionCodes)
	}

	stmt := sqlf.
		With("base_anrs", base).
		From("base_anrs").
		Select("datetime").
		Select("app_version").
		Select("count(if(type = 'anr', 1, NULL)) as total_anrs").
		Select("round((1 - (anr_sessions / total_sessions)) * 100, 2) as anr_free_sessions").
		Select("count(distinct session_id) as total_sessions").
		Select("count(distinct if(type = 'anr', session_id, NULL)) as anr_sessions").
		GroupBy("app_version, datetime").
		OrderBy("app_version, datetime")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var instance event.IssueInstance
		var ignore1, ignore2 uint64
		if err := rows.Scan(&instance.DateTime, &instance.Version, &instance.Instances, &instance.IssueFreeSessions, &ignore1, &ignore2); err != nil {
			return nil, err
		}
		issueInstances = append(issueInstances, instance)
	}

	if rows.Err() != nil {
		return
	}

	return
}

// GetEventIdsWithFilter gets the event ids matching event ids and optionally
// applies matching AppFilter.
func GetEventIdsMatchingFilter(ctx context.Context, eventIds []uuid.UUID, af *filter.AppFilter) ([]uuid.UUID, error) {
	stmt := sqlf.
		From("default.events").
		Select("id").
		Where("`id` in (?)")

	defer stmt.Close()

	if len(af.Versions) > 0 {
		stmt.Where("`attribute.app_version` in (?)")
	}

	if len(af.VersionCodes) > 0 {
		stmt.Where("`attribute.app_build` in (?)")
	}

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), eventIds, af.Versions, af.VersionCodes)
	if err != nil {
		return nil, err
	}

	defer rows.Close()

	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}

		ids = append(ids, id)
	}

	return ids, nil
}

// GetIssuesPlot queries and prepares aggregated issue instances
// based on datetime and filters.
func GetIssuesPlot(ctx context.Context, eventIds []uuid.UUID, af *filter.AppFilter) (issueInstances []event.IssueInstance, err error) {
	stmt := sqlf.
		From(`default.events`).
		Select("formatDateTime(timestamp, '%Y-%m-%d') as datetime").
		Select("concat(toString(attribute.app_version), ' ', '(', toString(attribute.app_build),')') as version").
		Select("count(id) as instances").
		Where("`id` in (?)", eventIds).
		GroupBy("version, formatDateTime(timestamp, '%Y-%m-%d') as datetime").
		OrderBy("version, formatDateTime(timestamp, '%Y-%m-%d') as datetime")

	stmt.Where("timestamp >= ? and timestamp <= ?", af.From, af.To)

	if len(af.Versions) > 0 {
		stmt.Where("attribute.app_version in (?)", af.Versions)
	}

	if len(af.VersionCodes) > 0 {
		stmt.Where("attribute.app_build in (?)", af.VersionCodes)
	}

	if len(af.Countries) > 0 {
		stmt.Where("inet.country_code in (?)", af.Countries)
	}

	if len(af.NetworkTypes) > 0 {
		stmt.Where("attribute.network_type in (?)", af.NetworkTypes)
	}

	if len(af.NetworkGenerations) > 0 {
		stmt.Where("attribute.network_generation in (?)", af.NetworkGenerations)
	}

	if len(af.Locales) > 0 {
		stmt.Where("attribute.device_locale in (?)", af.Locales)
	}

	if len(af.DeviceManufacturers) > 0 {
		stmt.Where(("attribute.device_manufacturer in (?)"), af.DeviceManufacturers)
	}

	if len(af.DeviceNames) > 0 {
		stmt.Where(("attribute.device_name in (?)"), af.DeviceNames)
	}

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var instance event.IssueInstance
		if err := rows.Scan(&instance.DateTime, &instance.Version, &instance.Instances); err != nil {
			return nil, err
		}
		issueInstances = append(issueInstances, instance)
	}

	if rows.Err() != nil {
		return
	}

	return
}

func PutEvents(c *gin.Context) {
	appId, err := uuid.Parse(c.GetString("appId"))
	if err != nil {
		msg := `error parsing app's uuid`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	ctx := c.Request.Context()

	app, err := SelectApp(ctx, appId)
	if app == nil || err != nil {
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
		attachments: make(map[uuid.UUID]*attachment),
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

	if seen, err := eventReq.seen(ctx); err != nil {
		msg := `failed to check existing event request`
		fmt.Println(msg, err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	} else if seen {
		c.JSON(http.StatusAccepted, gin.H{
			"ok": "accepted, known event request",
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

		events := eventReq.getSymbolicationEvents()

		batches := symbolicator.Batch(events)

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
					fmt.Printf("event id %q not found in symbolicate cache, batch index: %d, event index: %d\n", eventId, i, j)
					continue
				}
				eventReq.events[idx] = batches[i].Events[j]
				delete(eventReq.symbolicate, eventId)
			}
		}

		eventReq.bumpSymbolication()
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

		for i := range eventReq.events {
			if !eventReq.events[i].HasAttachments() {
				continue
			}

			for j := range eventReq.events[i].Attachments {
				id := eventReq.events[i].Attachments[j].ID
				attachment, ok := eventReq.attachments[id]
				if !ok {
					continue
				}
				if !attachment.uploaded {
					fmt.Printf("attachment %q failed to upload for event %q, skipping\n", attachment.id, id)
					continue
				}

				eventReq.events[i].Attachments[j].Location = attachment.location
				eventReq.events[i].Attachments[j].Key = attachment.key
			}
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

	defer tx.Rollback(ctx)

	if err := eventReq.ingest(ctx); err != nil {
		msg := `failed to ingest events`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if err := eventReq.bucketUnhandledExceptions(ctx, &tx); err != nil {
		msg := `failed to bucket unhandled exceptions`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if err := eventReq.bucketANRs(ctx, &tx); err != nil {
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

		if err := app.Onboard(ctx, &tx, uniqueID, platform, version); err != nil {
			msg := `failed to onboard app`
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})
			return
		}
	}

	if err := eventReq.save(ctx, &tx); err != nil {
		msg := `failed to save event request`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if err := tx.Commit(ctx); err != nil {
		msg := `failed to ingest events`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{"ok": "accepted"})
}
