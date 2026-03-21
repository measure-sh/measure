package measure

import (
	"backend/api/event"
	"backend/api/group"
	"backend/api/span"
	"backend/ingest-worker/server"
	"backend/ingest-worker/symbolicator"
	"backend/libs/ambient"
	"backend/libs/chrono"
	"backend/libs/concur"
	"backend/libs/inet"
	"backend/libs/opsys"
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
	"go.opentelemetry.io/otel"
	"golang.org/x/sync/errgroup"
)

// IngestBatch is a serializable representation
// of an ingest request batch for publishing
// to a message bus.
type IngestBatch struct {
	BatchID  string             `json:"batch_id"`
	AppID    string             `json:"app_id"`
	TeamID   string             `json:"team_id"`
	OsName   string             `json:"os_name"`
	ClientIP string             `json:"client_ip"`
	Events   []event.EventField `json:"events"`
	Spans    []span.SpanField   `json:"spans"`
}

// eventreq represents the ingest batch
type eventreq struct {
	// id is the unique id identifying the request
	// batch
	id uuid.UUID
	// appId is the id of the app
	appId uuid.UUID
	// teamId is the id of the team
	teamId uuid.UUID
	// seen indicates whether this request batch
	// was previously ingested
	seen bool
	// osName is operating system runtime of the SDK
	osName string
	// symbolicateEvents is a look up table to find
	// the events that need symbolication
	symbolicateEvents map[uuid.UUID]int
	// symbolicateSpans is a look up table to find
	// the spans that need symbolication
	symbolicateSpans map[string]int
	// exceptionIds is a list of all unhandled exception
	// event ids
	exceptionIds []int
	// anrIds is a list of all ANR event IDs
	anrIds []int
	// events is the list of events in the ingest
	// batch
	events []event.EventField
	// spans is the list of spans in the ingest
	// batch
	spans []span.SpanField
}

// checkSeen checks & remembers if this request batch was
// previously ingested.
func (e *eventreq) checkSeen(ctx context.Context) (err error) {
	stmt := sqlf.From("ingested_batches final").
		Select("1").
		Where("team_id = ?", e.teamId).
		Where("app_id = ?", e.appId).
		Where("batch_id = ?", e.id).
		Limit(1)

	defer stmt.Close()
	var result uint8
	if err = server.Server.ChPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&result); err != nil {
		if err == sql.ErrNoRows {
			err = nil
		}
		return
	}

	if result == 1 {
		e.seen = true
	}

	return
}

// infuseInet looks up the country code for the IP
// and infuses the country code and IP info to each event.
func (e *eventreq) infuseInet(rawIP string) error {
	ip := net.ParseIP(rawIP)
	country, err := inet.CountryCode(ip)
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

		if country != "" {
			e.events[i].CountryCode = country
		} else if inet.IsBogon(ip) {
			e.events[i].CountryCode = "bogon"
		} else {
			e.events[i].CountryCode = "n/a"
		}
	}

	for i := range e.spans {
		if country != "" {
			e.spans[i].Attributes.CountryCode = country
		} else if inet.IsBogon(ip) {
			e.spans[i].Attributes.CountryCode = "bogon"
		} else {
			e.spans[i].Attributes.CountryCode = "n/a"
		}
	}

	return nil
}

func (e *eventreq) countMetrics() (sessions, events, spans, attachments uint32) {
	events = uint32(len(e.events))

	sessions = 0
	for _, ev := range e.events {
		if ev.Type == event.TypeSessionStart {
			sessions++
		}
	}

	// attachments count is not tracked in the worker — attachments are
	// uploaded by the ingest service before publishing the batch.

	spans = uint32(len(e.spans))

	return sessions, events, spans, attachments
}

// onboardable determines if the ingest batch
// meets the conditions for onboarding the app.
func (e eventreq) onboardable() (ok bool) {
	if len(e.events) > 0 || len(e.spans) > 0 {
		ok = true
	}
	return
}

// remember stores the ingest batch record for future idempotency
func (e eventreq) remember(ctx context.Context) (err error) {
	stmt := sqlf.InsertInto("ingested_batches").
		NewRow().
		Set("team_id", e.teamId).
		Set("app_id", e.appId).
		Set("batch_id", e.id).
		Set("timestamp", time.Now())

	defer stmt.Close()

	asyncCtx := clickhouse.Context(ctx, clickhouse.WithAsync(true))
	return server.Server.ChPool.Exec(asyncCtx, stmt.String(), stmt.Args()...)
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

// getOSName extracts the operating system name
// of the app from ingest batch.
func (e eventreq) getOSName() (osName string) {
	if len(e.events) > 0 {
		return strings.ToLower(e.events[0].Attribute.OSName)
	}

	return strings.ToLower(e.spans[0].Attributes.OSName)
}

// getOSVersion extracts the operating system version
// of the app from ingest batch.
func (e eventreq) getOSVersion() (osVersion string) {
	if len(e.events) > 0 {
		return strings.ToLower(e.events[0].Attribute.OSVersion)
	}

	return strings.ToLower(e.spans[0].Attributes.OSVersion)
}

// getAppUniqueID extracts the app's unique identifier from
// ingest batch.
func (e eventreq) getAppUniqueID() (appUniqueID string) {
	if len(e.events) > 0 {
		return strings.ToLower(e.events[0].Attribute.AppUniqueID)
	}

	return strings.ToLower(e.spans[0].Attributes.AppUniqueID)
}

// getUnhandledExceptions returns unhandled exceptions
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
func (e eventreq) bucketUnhandledExceptions(ctx context.Context) (err error) {
	events := e.getUnhandledExceptions()

	for i := range events {
		if events[i].Exception.Fingerprint == "" {
			msg := fmt.Sprintf("no fingerprint found for event %q, cannot bucket exception", events[i].ID)
			fmt.Println(msg)
			continue
		}

		exceptionGroup := group.NewExceptionGroup(
			events[i].AppID,
			events[i].CountryCode,
			events[i].Attribute,
			events[i].Exception.Fingerprint,
			events[i].Exception.GetType(),
			events[i].Exception.GetMessage(),
			events[i].Exception.GetMethodName(),
			events[i].Exception.GetFileName(),
			events[i].Exception.GetLineNumber(),
			events[i].Timestamp,
		)

		if err = exceptionGroup.Insert(ctx, server.Server.ChPool); err != nil {
			return
		}
	}

	return
}

// bucketANRs groups ANRs based on similarity.
func (e eventreq) bucketANRs(ctx context.Context) (err error) {
	events := e.getANRs()

	for i := range events {
		if events[i].ANR.Fingerprint == "" {
			msg := fmt.Sprintf("no fingerprint found for event %q, cannot bucket ANR", events[i].ID)
			fmt.Println(msg)
			continue
		}

		anrGroup := group.NewANRGroup(
			events[i].AppID,
			events[i].CountryCode,
			events[i].Attribute,
			events[i].ANR.Fingerprint,
			events[i].ANR.GetType(),
			events[i].ANR.GetMessage(),
			events[i].ANR.GetMethodName(),
			events[i].ANR.GetFileName(),
			events[i].ANR.GetLineNumber(),
			events[i].Timestamp,
		)

		if err := anrGroup.Insert(ctx, server.Server.ChPool); err != nil {
			return err
		}
	}

	return
}

// needsSymbolication returns true if payload
// contains events that should be symbolicated.
func (e eventreq) needsSymbolication() bool {
	return len(e.symbolicateEvents) > 0 || len(e.symbolicateSpans) > 0
}

// validate validates the integrity of each event
// and corresponding attachments.
func (e eventreq) validate() error {
	if len(e.events) < 1 && len(e.spans) < 1 {
		return fmt.Errorf(`payload must contain at least 1 event or 1 span`)
	}

	for i := range e.events {
		if err := e.events[i].Validate(); err != nil {
			return err
		}
		if err := e.events[i].Attribute.Validate(); err != nil {
			return err
		}

		// only process user defined attributes
		// if the payload contains any.
		//
		// this check is super important to have
		// because SDKs without support for user
		// defined attributes won't ever send these.
		if !e.events[i].UserDefinedAttribute.Empty() {
			if err := e.events[i].UserDefinedAttribute.Validate(); err != nil {
				return err
			}
		}

		for j := range e.events[i].Attachments {
			if err := e.events[i].Attachments[j].Validate(); err != nil {
				return err
			}
		}
	}

	for i := range e.spans {
		if err := e.spans[i].Validate(); err != nil {
			return err
		}

		// only process user defined attributes
		// if the payload contains any.
		//
		// this check is super important to have
		// because SDKs without support for user
		// defined attributes won't ever send these.
		if !e.spans[i].UserDefinedAttribute.Empty() {
			if err := e.spans[i].UserDefinedAttribute.Validate(); err != nil {
				return err
			}
		}
	}

	return nil
}

// ingestEvents writes the events to database.
func (e eventreq) ingestEvents(ctx context.Context) error {
	if len(e.events) == 0 {
		return nil
	}

	stmt := sqlf.InsertInto(`events`)
	defer stmt.Close()

	for i := range e.events {
		anrExceptions := "[]"
		anrThreads := "[]"
		exceptionExceptions := "[]"
		exceptionThreads := "[]"
		attachments := "[]"
		binaryImages := "[]"
		error := "{}"

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
			if err := e.events[i].ANR.ComputeFingerprint(); err != nil {
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
			if err := e.events[i].Exception.ComputeFingerprint(); err != nil {
				return err
			}

			if len(e.events[i].Exception.BinaryImages) > 0 {
				marshalledImages, err := json.Marshal(e.events[i].Exception.BinaryImages)
				if err != nil {
					return err
				}
				binaryImages = string(marshalledImages)
			}

			if e.events[i].Exception.HasError() {
				marshalledError, err := json.Marshal(e.events[i].Exception.Error)
				if err != nil {
					return err
				}

				error = string(marshalledError)
			}
		}

		if e.events[i].HasAttachments() {
			marshalledAttachments, err := json.Marshal(e.events[i].Attachments)
			if err != nil {
				return err
			}
			attachments = string(marshalledAttachments)
		}

		sessionStartTime := e.events[i].Attribute.SessionStartTime.Format(chrono.MSTimeFormat)

		row := stmt.NewRow().
			Set(`id`, e.events[i].ID).
			Set(`team_id`, e.teamId).
			Set(`app_id`, e.events[i].AppID).
			Set(`session_id`, e.events[i].SessionID).
			Set(`timestamp`, e.events[i].Timestamp.Format(chrono.MSTimeFormat)).
			Set(`type`, e.events[i].Type).
			Set(`user_triggered`, e.events[i].UserTriggered).
			Set(`inet.ipv4`, e.events[i].IPv4).
			Set(`inet.ipv6`, e.events[i].IPv6).
			Set(`inet.country_code`, e.events[i].CountryCode).

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
			Set(`attribute.device_low_power_mode`, e.events[i].Attribute.DeviceLowPowerMode).
			Set(`attribute.device_thermal_throttling_enabled`, e.events[i].Attribute.DeviceThermalThrottlingEnabled).
			Set(`attribute.device_cpu_arch`, e.events[i].Attribute.DeviceCPUArch).
			Set(`attribute.os_name`, e.events[i].Attribute.OSName).
			Set(`attribute.os_version`, e.events[i].Attribute.OSVersion).
			Set(`attribute.os_page_size`, e.events[i].Attribute.OSPageSize).
			Set(`attribute.network_type`, e.events[i].Attribute.NetworkType).
			Set(`attribute.network_generation`, e.events[i].Attribute.NetworkGeneration).
			Set(`attribute.network_provider`, e.events[i].Attribute.NetworkProvider).
			Set(`attribute.session_start_time`, sessionStartTime).

			// user defined attribute
			Set(`user_defined_attribute`, e.events[i].UserDefinedAttribute.Parameterize()).

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
				Set(`exception.foreground`, e.events[i].Exception.Foreground).
				Set(`exception.binary_images`, binaryImages).
				Set(`exception.framework`, e.events[i].Exception.GetFramework()).
				Set(`exception.error`, error)
		} else {
			row.
				Set(`exception.handled`, nil).
				Set(`exception.fingerprint`, nil).
				Set(`exception.exceptions`, nil).
				Set(`exception.threads`, nil).
				Set(`exception.foreground`, nil).
				Set(`exception.binary_images`, nil).
				Set(`exception.framework`, nil).
				Set(`exception.error`, nil)
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
				Set(`lifecycle_fragment.parent_fragment`, e.events[i].LifecycleFragment.ParentFragment).
				Set(`lifecycle_fragment.tag`, e.events[i].LifecycleFragment.Tag)
		} else {
			row.
				Set(`lifecycle_fragment.type`, nil).
				Set(`lifecycle_fragment.class_name`, nil).
				Set(`lifecycle_fragment.parent_activity`, nil).
				Set(`lifecycle_fragment.parent_fragment`, nil).
				Set(`lifecycle_fragment.tag`, nil)
		}

		// lifecycle view controller
		if e.events[i].IsLifecycleViewController() {
			row.
				Set(`lifecycle_view_controller.type`, e.events[i].LifecycleViewController.Type).
				Set(`lifecycle_view_controller.class_name`, e.events[i].LifecycleViewController.ClassName)
		} else {
			row.
				Set(`lifecycle_view_controller.type`, nil).
				Set(`lifecycle_view_controller.class_name`, nil)
		}

		// lifecycle swift ui
		if e.events[i].IsLifecycleSwiftUI() {
			row.
				Set(`lifecycle_swift_ui.type`, e.events[i].LifecycleSwiftUI.Type).
				Set(`lifecycle_swift_ui.class_name`, e.events[i].LifecycleSwiftUI.ClassName)
		} else {
			row.
				Set(`lifecycle_swift_ui.type`, nil).
				Set(`lifecycle_swift_ui.class_name`, nil)
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
				Set(`warm_launch.process_start_uptime`, e.events[i].WarmLaunch.ProcessStartUptime).
				Set(`warm_launch.process_start_requested_uptime`, e.events[i].WarmLaunch.ProcessStartRequestedUptime).
				Set(`warm_launch.content_provider_attach_uptime`, e.events[i].WarmLaunch.ContentProviderAttachUptime).
				Set(`warm_launch.on_next_draw_uptime`, e.events[i].WarmLaunch.OnNextDrawUptime).
				Set(`warm_launch.launched_activity`, e.events[i].WarmLaunch.LaunchedActivity).
				Set(`warm_launch.has_saved_state`, e.events[i].WarmLaunch.HasSavedState).
				Set(`warm_launch.intent_data`, e.events[i].WarmLaunch.IntentData).
				Set(`warm_launch.duration`, e.events[i].WarmLaunch.Duration.Milliseconds()).
				Set(`warm_launch.is_lukewarm`, e.events[i].WarmLaunch.IsLukewarm)
		} else {
			row.
				Set(`warm_launch.app_visible_uptime`, nil).
				Set(`warm_launch.process_start_uptime`, nil).
				Set(`warm_launch.process_start_requested_uptime`, nil).
				Set(`warm_launch.content_provider_attach_uptime`, nil).
				Set(`warm_launch.on_next_draw_uptime`, nil).
				Set(`warm_launch.launched_activity`, nil).
				Set(`warm_launch.has_saved_state`, nil).
				Set(`warm_launch.intent_data`, nil).
				Set(`warm_launch.duration`, nil).
				Set(`warm_launch.is_lukewarm`, nil)
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
				Set(`memory_usage.interval`, e.events[i].MemoryUsage.Interval)
		} else {
			row.
				Set(`memory_usage.java_max_heap`, nil).
				Set(`memory_usage.java_total_heap`, nil).
				Set(`memory_usage.java_free_heap`, nil).
				Set(`memory_usage.total_pss`, nil).
				Set(`memory_usage.rss`, nil).
				Set(`memory_usage.native_total_heap`, nil).
				Set(`memory_usage.native_free_heap`, nil).
				Set(`memory_usage.interval`, nil)
		}

		// memory usage absolute
		if e.events[i].IsMemoryUsageAbs() {
			row.
				Set(`memory_usage_absolute.max_memory`, e.events[i].MemoryUsageAbs.MaxMemory).
				Set(`memory_usage_absolute.used_memory`, e.events[i].MemoryUsageAbs.UsedMemory).
				Set(`memory_usage_absolute.interval`, e.events[i].MemoryUsageAbs.Interval)
		} else {
			row.
				Set(`memory_usage_absolute.max_memory`, nil).
				Set(`memory_usage_absolute.used_memory`, nil).
				Set(`memory_usage_absolute.interval`, nil)
		}

		// low memory
		if e.events[i].IsLowMemory() {
			row.
				Set(`low_memory.java_max_heap`, e.events[i].LowMemory.JavaMaxHeap).
				Set(`low_memory.java_total_heap`, e.events[i].LowMemory.JavaTotalHeap).
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
				Set(`cpu_usage.interval`, e.events[i].CPUUsage.Interval).
				Set(`cpu_usage.percentage_usage`, e.events[i].CPUUsage.PercentageUsage)
		} else {
			row.
				Set(`cpu_usage.num_cores`, nil).
				Set(`cpu_usage.clock_speed`, nil).
				Set(`cpu_usage.uptime`, nil).
				Set(`cpu_usage.utime`, nil).
				Set(`cpu_usage.cutime`, nil).
				Set(`cpu_usage.stime`, nil).
				Set(`cpu_usage.cstime`, nil).
				Set(`cpu_usage.interval`, nil).
				Set(`cpu_usage.percentage_usage`, nil)

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

		// screen view
		if e.events[i].IsScreenView() {
			row.
				Set(`screen_view.name`, e.events[i].ScreenView.Name)
		} else {
			row.
				Set(`screen_view.name`, nil)
		}

		// bug report
		if e.events[i].IsBugReport() {
			row.
				Set(`bug_report.description`, e.events[i].BugReport.Description)
		} else {
			row.
				Set(`bug_report.description`, nil)
		}

		// custom
		if e.events[i].IsCustom() {
			row.
				Set(`custom.name`, e.events[i].Custom.Name)
		} else {
			row.
				Set(`custom.name`, nil)
		}
	}

	asyncCtx := clickhouse.Context(ctx, clickhouse.WithAsync(true))
	return server.Server.ChPool.Exec(asyncCtx, stmt.String(), stmt.Args()...)
}

// ingestSpans writes the spans to database.
func (e eventreq) ingestSpans(ctx context.Context) error {
	if len(e.spans) == 0 {
		return nil
	}

	stmt := sqlf.InsertInto(`spans`)
	defer stmt.Close()

	for i := range e.spans {
		appVersionTuple := fmt.Sprintf("('%s', '%s')", e.spans[i].Attributes.AppVersion, e.spans[i].Attributes.AppBuild)
		osVersionTuple := fmt.Sprintf("('%s', '%s')", e.spans[i].Attributes.OSName, e.spans[i].Attributes.OSVersion)

		var b strings.Builder
		var checkpoints []string
		b.WriteString("[")
		for _, cp := range e.spans[i].CheckPoints {
			checkpoints = append(checkpoints, fmt.Sprintf("('%s','%s')", cp.Name, cp.Timestamp.Format(chrono.MSTimeFormat)))
		}
		b.WriteString(strings.Join(checkpoints, ","))
		b.WriteString("]")
		formattedCheckpoints := b.String()

		spanSessionStartTime := e.spans[i].Attributes.SessionStartTime.Format(chrono.MSTimeFormat)

		stmt.NewRow().
			Set(`team_id`, e.teamId).
			Set(`app_id`, e.spans[i].AppID).
			Set(`span_name`, e.spans[i].SpanName).
			Set(`span_id`, e.spans[i].SpanID).
			Set(`parent_id`, e.spans[i].ParentID).
			Set(`trace_id`, e.spans[i].TraceID).
			Set(`session_id`, e.spans[i].SessionID).
			Set(`status`, e.spans[i].Status).
			Set(`start_time`, e.spans[i].StartTime.Format(chrono.MSTimeFormat)).
			Set(`end_time`, e.spans[i].EndTime.Format(chrono.MSTimeFormat)).
			Set(`checkpoints`, formattedCheckpoints).
			Set(`attribute.app_unique_id`, e.spans[i].Attributes.AppUniqueID).
			Set(`attribute.installation_id`, e.spans[i].Attributes.InstallationID).
			Set(`attribute.user_id`, e.spans[i].Attributes.UserID).
			Set(`attribute.measure_sdk_version`, e.spans[i].Attributes.MeasureSDKVersion).
			Set(`attribute.app_version`, appVersionTuple).
			Set(`attribute.os_version`, osVersionTuple).
			Set(`attribute.platform`, e.spans[i].Attributes.Platform).
			Set(`attribute.thread_name`, e.spans[i].Attributes.ThreadName).
			Set(`attribute.country_code`, e.spans[i].Attributes.CountryCode).
			Set(`attribute.network_provider`, e.spans[i].Attributes.NetworkProvider).
			Set(`attribute.network_type`, e.spans[i].Attributes.NetworkType).
			Set(`attribute.network_generation`, e.spans[i].Attributes.NetworkGeneration).
			Set(`attribute.device_name`, e.spans[i].Attributes.DeviceName).
			Set(`attribute.device_model`, e.spans[i].Attributes.DeviceModel).
			Set(`attribute.device_manufacturer`, e.spans[i].Attributes.DeviceManufacturer).
			Set(`attribute.device_locale`, e.spans[i].Attributes.DeviceLocale).
			Set(`attribute.device_low_power_mode`, e.spans[i].Attributes.LowPowerModeEnabled).
			Set(`attribute.device_thermal_throttling_enabled`, e.spans[i].Attributes.ThermalThrottlingEnabled).
			Set(`attribute.session_start_time`, spanSessionStartTime).
			// user defined attribute
			Set(`user_defined_attribute`, e.spans[i].UserDefinedAttribute.Parameterize())
	}

	asyncCtx := clickhouse.Context(ctx, clickhouse.WithAsync(true))
	return server.Server.ChPool.Exec(asyncCtx, stmt.String(), stmt.Args()...)
}

// PushHandler handles incoming Pub/Sub push messages containing
// ingest batches published by the ingest service.
func PushHandler(c *gin.Context) {
	var envelope struct {
		Message struct {
			Data string `json:"data"`
		} `json:"message"`
	}
	if err := c.BindJSON(&envelope); err != nil {
		c.Status(http.StatusBadRequest)
		return
	}
	raw, err := base64.StdEncoding.DecodeString(envelope.Message.Data)
	if err != nil {
		c.Status(http.StatusBadRequest)
		return
	}
	var batch IngestBatch
	if err := json.Unmarshal(raw, &batch); err != nil {
		c.Status(http.StatusBadRequest)
		return
	}
	concur.GlobalWg.Add(1)
	go func() {
		defer concur.GlobalWg.Done()
		processIngestBatch(context.Background(), batch)
	}()
	c.Status(http.StatusOK)
}

// processIngestBatch runs the full ingestion processing pipeline
// for an ingest batch received from the message bus.
func processIngestBatch(ctx context.Context, batch IngestBatch) {
	batchID, err := uuid.Parse(batch.BatchID)
	if err != nil {
		fmt.Println("failed to parse batch id:", err)
		return
	}
	appID, err := uuid.Parse(batch.AppID)
	if err != nil {
		fmt.Println("failed to parse app id:", err)
		return
	}
	teamID, err := uuid.Parse(batch.TeamID)
	if err != nil {
		fmt.Println("failed to parse team id:", err)
		return
	}

	app, err := SelectApp(ctx, appID)
	if app == nil || err != nil {
		fmt.Println("failed to lookup app:", err)
		return
	}

	eventReq := &eventreq{
		id:                batchID,
		appId:             appID,
		teamId:            teamID,
		osName:            batch.OsName,
		events:            batch.Events,
		spans:             batch.Spans,
		symbolicateEvents: make(map[uuid.UUID]int),
		symbolicateSpans:  make(map[string]int),
	}

	// Rebuild exceptionIds, anrIds and symbolication lookups by scanning events.
	for i := range eventReq.events {
		eventReq.events[i].AppID = appID
		if eventReq.events[i].NeedsSymbolication() {
			eventReq.symbolicateEvents[eventReq.events[i].ID] = i
		}
		if eventReq.events[i].IsUnhandledException() {
			eventReq.exceptionIds = append(eventReq.exceptionIds, i)
		}
		if eventReq.events[i].IsANR() {
			eventReq.anrIds = append(eventReq.anrIds, i)
		}
	}

	for i := range eventReq.spans {
		if eventReq.spans[i].NeedsSymbolication() {
			eventReq.symbolicateSpans[eventReq.spans[i].SpanName] = i
		}
	}

	// Validate re-populates UDAttribute.keyTypes for all events and spans.
	// keyTypes is not serialized in JSON, so it must be rebuilt after
	// deserializing the IngestBatch from Pub/Sub.
	//
	// FIXME: This should be refactored, validate should not have such
	// side effects.
	if err := eventReq.validate(); err != nil {
		fmt.Println("failed to validate batch:", err)
		return
	}

	// Check idempotency — Pub/Sub delivers at-least-once.
	if err := eventReq.checkSeen(ctx); err != nil {
		fmt.Println("failed to check seen status:", err)
		return
	}
	if eventReq.seen {
		return
	}

	ingestCtx := ambient.WithTeamId(context.Background(), app.TeamId)
	ingestTracer := otel.Tracer("ingest-tracer")
	ingestCtx, ingestSpan := ingestTracer.Start(ingestCtx, "ingest")
	defer ingestSpan.End()

	var infuseInetGroup errgroup.Group
	infuseInetGroup.Go(func() error {
		_, infuseInetSpan := ingestTracer.Start(ingestCtx, "infuse-inet")
		defer infuseInetSpan.End()
		if err := eventReq.infuseInet(batch.ClientIP); err != nil {
			msg := fmt.Sprintf(`failed to lookup country info for IP: %q`, batch.ClientIP)
			fmt.Println(msg, err)
			return err
		}
		return nil
	})

	var symbolicationGroup errgroup.Group
	symbolicationGroup.Go(func() error {
		if eventReq.needsSymbolication() {
			config := server.Server.Config
			origin := config.SymbolicatorOrigin
			osName := eventReq.osName
			sources := []symbolicator.Source{}

			switch opsys.ToFamily(osName) {
			case opsys.Android:
				if config.IsCloud() {
					privateKey := os.Getenv("SYMBOLS_READER_SA_KEY")
					clientEmail := os.Getenv("SYMBOLS_READER_SA_EMAIL")
					sources = append(sources, symbolicator.NewGCSSourceAndroid("msr-symbols", config.SymbolsBucket, privateKey, clientEmail))
				} else {
					sources = append(sources, symbolicator.NewS3SourceAndroid("msr-symbols", config.SymbolsBucket, config.SymbolsBucketRegion, config.AWSEndpoint, config.SymbolsAccessKey, config.SymbolsSecretAccessKey))
				}
			case opsys.AppleFamily:
				if config.IsCloud() {
					privateKey := os.Getenv("SYMBOLS_READER_SA_KEY")
					clientEmail := os.Getenv("SYMBOLS_READER_SA_EMAIL")
					sources = append(sources, symbolicator.NewGCSSourceApple("msr-symbols", config.SymbolsBucket, privateKey, clientEmail))
				} else {
					sources = append(sources, symbolicator.NewS3SourceApple("msr-symbols", config.SymbolsBucket, config.SymbolsBucketRegion, config.AWSEndpoint, config.SymbolsAccessKey, config.SymbolsSecretAccessKey))
				}
			}

			symblctr := symbolicator.New(origin, osName, sources)

			_, symbolicationSpan := ingestTracer.Start(ingestCtx, "symbolicate-events")
			defer symbolicationSpan.End()

			if err := symblctr.Symbolicate(ingestCtx, server.Server.PgPool, eventReq.appId, eventReq.events, eventReq.spans); err != nil {
				fmt.Printf("failed to symbolicate batch %q containing %d events & %d spans: %v\n", eventReq.id, len(eventReq.events), len(eventReq.spans), err.Error())
				return err
			}
		}
		return nil
	})

	if err := infuseInetGroup.Wait(); err != nil {
		fmt.Println("failed to lookup IP info")
	}
	if err := symbolicationGroup.Wait(); err != nil {
		fmt.Println("failed to symbolicate", err)
	}

	var ingestGroup errgroup.Group
	ingestGroup.Go(func() error {
		_, ingestEventsSpan := ingestTracer.Start(ingestCtx, "ingest-events")
		defer ingestEventsSpan.End()
		if err := eventReq.ingestEvents(ingestCtx); err != nil {
			fmt.Println(`failed to ingest events`, err)
			return err
		}
		return nil
	})
	ingestGroup.Go(func() error {
		_, ingestSpansSpan := ingestTracer.Start(ingestCtx, "ingest-spans")
		defer ingestSpansSpan.End()
		if err := eventReq.ingestSpans(ingestCtx); err != nil {
			fmt.Println(`failed to ingest spans`, err)
			return err
		}
		return nil
	})
	if err := ingestGroup.Wait(); err != nil {
		fmt.Println("failed to ingest", err)
		return
	}

	var bucketGroup errgroup.Group
	bucketGroup.Go(func() error {
		_, bucketUnhandledExceptionsSpan := ingestTracer.Start(ingestCtx, "bucket-unhandled-exceptions")
		defer bucketUnhandledExceptionsSpan.End()
		if err := eventReq.bucketUnhandledExceptions(ingestCtx); err != nil {
			fmt.Println(`failed to bucket unhandled exceptions`, err)
			return err
		}
		return nil
	})
	bucketGroup.Go(func() error {
		_, bucketAnrsSpan := ingestTracer.Start(ingestCtx, "bucket-anrs")
		defer bucketAnrsSpan.End()
		if err := eventReq.bucketANRs(ingestCtx); err != nil {
			fmt.Println(`failed to bucket anrs`, err)
			return err
		}
		return nil
	})
	if err := bucketGroup.Wait(); err != nil {
		fmt.Println("failed to bucket issues", err)
		return
	}

	var metricsGroup errgroup.Group
	metricsGroup.Go(func() error {
		_, ingestMetricsSpan := ingestTracer.Start(ingestCtx, "ingest-metrics")
		defer ingestMetricsSpan.End()

		sessions, events, spans, attachments := eventReq.countMetrics()

		insertMetricsIngestionSelectStmt := sqlf.
			Select("? AS team_id", eventReq.teamId).
			Select("? AS app_id", app.ID).
			Select("? AS timestamp", time.Now()).
			Select("sumState(CAST(? AS UInt32)) AS sessions", sessions).
			Select("sumState(CAST(? AS UInt32)) AS events", events).
			Select("sumState(CAST(? AS UInt32)) AS spans", spans).
			Select("sumState(CAST(? AS UInt32)) AS attachments", attachments).
			Select("sumState(CAST(? AS UInt32)) AS metrics", 0)
		selectSQL := insertMetricsIngestionSelectStmt.String()
		args := insertMetricsIngestionSelectStmt.Args()
		defer insertMetricsIngestionSelectStmt.Close()
		insertMetricsIngestionFullStmt := "INSERT INTO ingestion_metrics " + selectSQL

		asyncCtx := clickhouse.Context(ingestCtx, clickhouse.WithAsync(true))
		if err := server.Server.ChPool.Exec(asyncCtx, insertMetricsIngestionFullStmt, args...); err != nil {
			fmt.Println(`failed to insert ingestion metrics`, err)
			return err
		}
		return nil
	})
	if err := metricsGroup.Wait(); err != nil {
		fmt.Println(`failed to count ingestion metrics`, err)
		return
	}

	_, rememberIngestSpan := ingestTracer.Start(ingestCtx, "remember-ingest")
	defer rememberIngestSpan.End()

	if err := eventReq.remember(ingestCtx); err != nil {
		fmt.Println(`failed to remember event request`, err)
		return
	}

	if eventReq.onboardable() && !app.Onboarded {
		_, onboardAppSpan := ingestTracer.Start(ingestCtx, "onboard-app")
		defer onboardAppSpan.End()

		tx, err := server.Server.PgPool.BeginTx(ingestCtx, pgx.TxOptions{
			IsoLevel: pgx.ReadCommitted,
		})
		defer tx.Rollback(ingestCtx)

		if err != nil {
			fmt.Println("failed to acquire transaction while onboarding app:", err)
			return
		}

		uniqueID := eventReq.getAppUniqueID()
		osName := eventReq.getOSName()
		version := eventReq.getOSVersion()

		if err := app.Onboard(ingestCtx, &tx, uniqueID, osName, version); err != nil {
			fmt.Println(`failed to onboard app`, err)
			return
		}

		if err := tx.Commit(ingestCtx); err != nil {
			fmt.Println(`failed to commit app onboard transaction`, err)
			return
		}
	}
}
