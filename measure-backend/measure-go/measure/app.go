package measure

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"measure-backend/measure-go/event"
	"measure-backend/measure-go/replay"
	"measure-backend/measure-go/server"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/leporo/sqlf"
)

type App struct {
	ID           *uuid.UUID `json:"id"`
	TeamId       uuid.UUID  `json:"team_id"`
	AppName      string     `json:"name" binding:"required"`
	UniqueId     string     `json:"unique_identifier"`
	Platform     string     `json:"platform"`
	APIKey       *APIKey    `json:"api_key"`
	FirstVersion string     `json:"first_version"`
	Onboarded    bool       `json:"onboarded"`
	OnboardedAt  time.Time  `json:"onboarded_at"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

func (a App) MarshalJSON() ([]byte, error) {
	type Alias App
	return json.Marshal(&struct {
		*Alias
		Platform    *string    `json:"platform"`
		OnboardedAt *time.Time `json:"onboarded_at"`
		UniqueId    *string    `json:"unique_identifier"`
	}{
		Platform: func() *string {
			if a.Platform == "" {
				return nil
			}
			return &a.Platform
		}(),
		UniqueId: func() *string {
			if a.UniqueId == "" {
				return nil
			}
			return &a.UniqueId
		}(),
		OnboardedAt: func() *time.Time {
			if a.OnboardedAt.IsZero() {
				return nil
			}
			return &a.OnboardedAt
		}(),
		Alias: (*Alias)(&a),
	})
}

// GetExceptionGroup queries a single exception group from the exception
// group id and returns a pointer to ExceptionGroup.
func (a App) GetExceptionGroup(id uuid.UUID) (*ExceptionGroup, error) {
	stmt := sqlf.PostgreSQL.
		Select("id, app_id, name, fingerprint, array_length(event_ids, 1) as count, event_ids, created_at, updated_at").
		From("unhandled_exception_groups").
		Where("id = ?", nil)
	defer stmt.Close()

	rows, err := server.Server.PgPool.Query(context.Background(), stmt.String(), id)
	if err != nil {
		return nil, err
	}
	group, err := pgx.CollectOneRow(rows, pgx.RowToStructByNameLax[ExceptionGroup])
	if err != nil {
		return nil, err
	}

	return &group, nil
}

// GetANRGroup queries a single anr group from the anr
// group id and returns a pointer to ANRGroup.
func (a App) GetANRGroup(id uuid.UUID) (*ANRGroup, error) {
	stmt := sqlf.PostgreSQL.
		Select("id, app_id, name, fingerprint, array_length(event_ids, 1) as count, event_ids, created_at, updated_at").
		From("anr_groups").
		Where("id = ?", nil)
	defer stmt.Close()

	rows, err := server.Server.PgPool.Query(context.Background(), stmt.String(), id)
	if err != nil {
		return nil, err
	}
	group, err := pgx.CollectOneRow(rows, pgx.RowToStructByNameLax[ANRGroup])
	if err != nil {
		return nil, err
	}

	return &group, nil
}

// GetExceptionGroups returns slice of ExceptionGroup after applying matching
// AppFilter values
func (a App) GetExceptionGroups(af *AppFilter) ([]ExceptionGroup, error) {
	stmt := sqlf.PostgreSQL.
		Select("id, app_id, name, fingerprint, array_length(event_ids, 1) as count, event_ids, created_at, updated_at").
		From("public.unhandled_exception_groups").
		OrderBy("count desc").
		Where("app_id = ?", nil)
	defer stmt.Close()

	args := []any{a.ID}

	if af != nil {
		if af.hasTimeRange() {
			stmt.Where("created_at >= ? and created_at <= ?", nil, nil)
			args = append(args, af.From, af.To)
		}
	}

	rows, err := server.Server.PgPool.Query(context.Background(), stmt.String(), args...)
	if err != nil {
		return nil, err
	}
	groups, err := pgx.CollectRows(rows, pgx.RowToStructByNameLax[ExceptionGroup])
	if err != nil {
		return nil, err
	}

	return groups, nil
}

// GetANRGroups returns slice of ANRGroup after applying matching
// AppFilter values
func (a App) GetANRGroups(af *AppFilter) ([]ANRGroup, error) {
	stmt := sqlf.PostgreSQL.
		Select("id, app_id, name, fingerprint, array_length(event_ids, 1) as count, event_ids, created_at, updated_at").
		From("public.anr_groups").
		OrderBy("count desc").
		Where("app_id = ?", nil)
	defer stmt.Close()

	args := []any{a.ID}

	if af != nil {
		if af.hasTimeRange() {
			stmt.Where("created_at >= ? and created_at <= ?", nil, nil)
			args = append(args, af.From, af.To)
		}
	}

	rows, err := server.Server.PgPool.Query(context.Background(), stmt.String(), args...)
	if err != nil {
		return nil, err
	}
	groups, err := pgx.CollectRows(rows, pgx.RowToStructByNameLax[ANRGroup])
	if err != nil {
		return nil, err
	}

	return groups, nil
}

func NewApp(teamId uuid.UUID) *App {
	now := time.Now()
	id := uuid.New()
	return &App{
		ID:        &id,
		TeamId:    teamId,
		CreatedAt: now,
		UpdatedAt: now,
	}
}

func (a *App) add() (*APIKey, error) {
	id := uuid.New()
	a.ID = &id
	tx, err := server.Server.PgPool.Begin(context.Background())

	if err != nil {
		return nil, err
	}

	defer tx.Rollback(context.Background())

	_, err = tx.Exec(context.Background(), "insert into public.apps(id, team_id, app_name, created_at, updated_at) values ($1, $2, $3, $4, $5);", a.ID, a.TeamId, a.AppName, a.CreatedAt, a.UpdatedAt)

	if err != nil {
		return nil, err
	}

	apiKey, err := NewAPIKey(*a.ID)

	if err != nil {
		return nil, err
	}

	if err := apiKey.saveTx(tx); err != nil {
		return nil, err
	}

	if err := tx.Commit(context.Background()); err != nil {
		return nil, err
	}

	return apiKey, nil
}

func (a *App) get() (*App, error) {
	var onboarded pgtype.Bool
	var uniqueId pgtype.Text
	var platform pgtype.Text
	var firstVersion pgtype.Text

	stmt := sqlf.PostgreSQL.
		Select("onboarded", nil).
		Select("unique_identifier", nil).
		Select("platform", nil).
		Select("first_version", nil).
		From("apps").
		Where("id = ?", nil)
	defer stmt.Close()

	if err := server.Server.PgPool.QueryRow(context.Background(), stmt.String(), a.ID).Scan(&onboarded, &uniqueId, &platform, &firstVersion); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		} else {
			return nil, err
		}
	}

	if uniqueId.Valid {
		a.UniqueId = uniqueId.String
	} else {
		a.UniqueId = ""
	}

	if platform.Valid {
		a.Platform = platform.String
	} else {
		a.Platform = ""
	}

	if firstVersion.Valid {
		a.FirstVersion = firstVersion.String
	} else {
		a.FirstVersion = ""
	}

	return a, nil
}

func (a *App) getWithTeam(id uuid.UUID) (*App, error) {
	var appName pgtype.Text
	var uniqueId pgtype.Text
	var platform pgtype.Text
	var firstVersion pgtype.Text
	var onboarded pgtype.Bool
	var onboardedAt pgtype.Timestamptz
	var apiKeyLastSeen pgtype.Timestamptz
	var apiKeyCreatedAt pgtype.Timestamptz
	var createdAt pgtype.Timestamptz
	var updatedAt pgtype.Timestamptz

	apiKey := new(APIKey)

	cols := []string{
		"apps.app_name",
		"apps.unique_identifier",
		"apps.platform",
		"apps.first_version",
		"apps.onboarded",
		"apps.onboarded_at",
		"api_keys.key_prefix",
		"api_keys.key_value",
		"api_keys.checksum",
		"api_keys.last_seen",
		"api_keys.created_at",
		"apps.created_at",
		"apps.updated_at",
	}

	stmt := sqlf.PostgreSQL.
		Select(strings.Join(cols, ",")).
		From("public.apps").
		LeftJoin("public.api_keys", "api_keys.app_id = apps.id").
		Where("apps.id = ? and apps.team_id = ?", nil, nil)

	defer stmt.Close()

	dest := []any{
		&appName,
		&uniqueId,
		&platform,
		&firstVersion,
		&onboarded,
		&onboardedAt,
		&apiKey.keyPrefix,
		&apiKey.keyValue,
		&apiKey.checksum,
		&apiKeyLastSeen,
		&apiKeyCreatedAt,
		&createdAt,
		&updatedAt,
	}

	if err := server.Server.PgPool.QueryRow(context.Background(), stmt.String(), id, a.TeamId).Scan(dest...); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		} else {
			return nil, err
		}
	}

	if appName.Valid {
		a.AppName = appName.String
	}

	if uniqueId.Valid {
		a.UniqueId = uniqueId.String
	} else {
		a.UniqueId = ""
	}

	if platform.Valid {
		a.Platform = platform.String
	} else {
		a.Platform = ""
	}

	if firstVersion.Valid {
		a.FirstVersion = firstVersion.String
	} else {
		a.FirstVersion = ""
	}

	if onboarded.Valid {
		a.Onboarded = onboarded.Bool
	}

	if onboardedAt.Valid {
		a.OnboardedAt = onboardedAt.Time
	}

	if apiKeyLastSeen.Valid {
		apiKey.lastSeen = apiKeyLastSeen.Time
	}

	if apiKeyCreatedAt.Valid {
		apiKey.createdAt = apiKeyCreatedAt.Time
	}

	if createdAt.Valid {
		a.CreatedAt = createdAt.Time
	}

	if updatedAt.Valid {
		a.UpdatedAt = updatedAt.Time
	}

	a.APIKey = apiKey

	return a, nil
}

func (a *App) getTeam() (*Team, error) {
	team := &Team{}

	stmt := sqlf.PostgreSQL.
		Select("team_id").
		From("apps").
		Where("id = ?", nil)
	defer stmt.Close()

	if err := server.Server.PgPool.QueryRow(context.Background(), stmt.String(), a.ID).Scan(&team.ID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		} else {
			return nil, err
		}
	}

	return team, nil
}

func (a *App) Onboard(tx pgx.Tx, uniqueIdentifier, platform, firstVersion string) error {
	now := time.Now()
	stmt := sqlf.PostgreSQL.Update("apps").
		Set("onboarded", nil).
		Set("unique_identifier", nil).
		Set("platform", nil).
		Set("first_version", nil).
		Set("onboarded_at", nil).
		Set("updated_at", nil).
		Where("id = ?", nil)

	defer stmt.Close()

	_, err := tx.Exec(context.Background(), stmt.String(), true, uniqueIdentifier, platform, firstVersion, now, now, a.ID)
	if err != nil {
		return err
	}

	return nil
}

func (a *App) GetEventResource(id uuid.UUID) (resource *event.Resource, err error) {
	resource = &event.Resource{}
	stmt := sqlf.From(`default.events`).
		Select(`resource.device_name`, nil).
		Select(`resource.device_model`, nil).
		Select(`resource.device_manufacturer`, nil).
		Select(`resource.device_type`, nil).
		Select(`resource.device_is_foldable`, nil).
		Select(`resource.device_is_physical`, nil).
		Select(`resource.device_density_dpi`, nil).
		Select(`resource.device_width_px`, nil).
		Select(`resource.device_height_px`, nil).
		Select(`resource.device_density`, nil).
		Select(`resource.device_locale`, nil).
		Select(`resource.os_name`, nil).
		Select(`resource.os_version`, nil).
		Select(`resource.platform`, nil).
		Select(`resource.app_version`, nil).
		Select(`resource.app_build`, nil).
		Select(`resource.app_unique_id`, nil).
		Select(`resource.measure_sdk_version`, nil).
		Select(`resource.network_type`, nil).
		Select(`resource.network_generation`, nil).
		Select(`resource.network_provider`, nil).
		Where(`id = ?`)

	defer stmt.Close()

	dest := []any{
		&resource.DeviceName,
		&resource.DeviceModel,
		&resource.DeviceManufacturer,
		&resource.DeviceType,
		&resource.DeviceIsFoldable,
		&resource.DeviceIsPhysical,
		&resource.DeviceDensityDPI,
		&resource.DeviceWidthPX,
		&resource.DeviceHeightPX,
		&resource.DeviceDensity,
		&resource.DeviceLocale,
		&resource.OSName,
		&resource.OSVersion,
		&resource.Platform,
		&resource.AppVersion,
		&resource.AppBuild,
		&resource.AppUniqueID,
		&resource.MeasureSDKVersion,
		&resource.NetworkType,
		&resource.NetworkGeneration,
		&resource.NetworkProvider,
	}

	if err := server.Server.ChPool.QueryRow(context.Background(), stmt.String(), id).Scan(dest...); err != nil {
		return nil, err
	}

	return
}

func (a *App) GetSessionEvents(sessionId uuid.UUID) (*Session, error) {
	cols := []string{
		`id`,
		`type`,
		`session_id`,
		`app_id`,
		`inet.ipv4`,
		`inet.ipv6`,
		`inet.country_code`,
		`timestamp`,
		`thread_name`,
		`anr.thread_name`,
		`anr.fingerprint`,
		`anr.network_type`,
		`anr.network_generation`,
		`anr.network_provider`,
		`anr.device_locale`,
		`anr.exceptions`,
		`anr.threads`,
		`exception.thread_name`,
		`exception.handled`,
		`exception.fingerprint`,
		`exception.network_type`,
		`exception.network_generation`,
		`exception.network_provider`,
		`exception.device_locale`,
		`exception.exceptions`,
		`exception.threads`,
		`app_exit.reason`,
		`app_exit.importance`,
		`app_exit.trace`,
		`app_exit.process_name`,
		`app_exit.pid`,
		`string.severity_text`,
		`string.string`,
		`gesture_long_click.target`,
		`gesture_long_click.target_id`,
		`gesture_long_click.touch_down_time`,
		`gesture_long_click.touch_up_time`,
		`gesture_long_click.width`,
		`gesture_long_click.height`,
		`gesture_long_click.x`,
		`gesture_long_click.y`,
		`gesture_click.target`,
		`gesture_click.target_id`,
		`gesture_click.touch_down_time`,
		`gesture_click.touch_up_time`,
		`gesture_click.width`,
		`gesture_click.height`,
		`gesture_click.x`,
		`gesture_click.y`,
		`gesture_scroll.target`,
		`gesture_scroll.target_id`,
		`gesture_scroll.touch_down_time`,
		`gesture_scroll.touch_up_time`,
		`gesture_scroll.x`,
		`gesture_scroll.y`,
		`gesture_scroll.end_x`,
		`gesture_scroll.end_y`,
		`gesture_scroll.direction`,
		`lifecycle_activity.type`,
		`lifecycle_activity.class_name`,
		`lifecycle_activity.intent`,
		`lifecycle_activity.saved_instance_state`,
		`lifecycle_fragment.type`,
		`lifecycle_fragment.class_name`,
		`lifecycle_fragment.parent_activity`,
		`lifecycle_fragment.tag`,
		`lifecycle_app.type`,
		`cold_launch.process_start_uptime`,
		`cold_launch.process_start_requested_uptime`,
		`cold_launch.content_provider_attach_uptime`,
		`cold_launch.on_next_draw_uptime`,
		`cold_launch.launched_activity`,
		`cold_launch.has_saved_state`,
		`cold_launch.intent_data`,
		`warm_launch.app_visible_uptime`,
		`warm_launch.on_next_draw_uptime`,
		`warm_launch.launched_activity`,
		`warm_launch.has_saved_state`,
		`warm_launch.intent_data`,
		`hot_launch.app_visible_uptime`,
		`hot_launch.on_next_draw_uptime`,
		`hot_launch.launched_activity`,
		`hot_launch.has_saved_state`,
		`hot_launch.intent_data`,
		`network_change.network_type`,
		`network_change.previous_network_type`,
		`network_change.network_generation`,
		`network_change.previous_network_generation`,
		`network_change.network_provider`,
		`http.url`,
		`http.method`,
		`http.status_code`,
		`http.request_body_size`,
		`http.response_body_size`,
		`http.request_timestamp`,
		`http.response_timestamp`,
		`http.start_time`,
		`http.end_time`,
		`http.dns_start`,
		`http.dns_end`,
		`http.connect_start`,
		`http.connect_end`,
		`http.request_start`,
		`http.request_end`,
		`http.request_headers_start`,
		`http.request_headers_end`,
		`http.request_body_start`,
		`http.request_body_end`,
		`http.response_start`,
		`http.response_end`,
		`http.response_headers_start`,
		`http.response_headers_end`,
		`http.response_body_start`,
		`http.response_body_end`,
		`http.request_headers_size`,
		`http.response_headers_size`,
		`http.failure_reason`,
		`http.failure_description`,
		`http_request_headers`,
		`http_response_headers`,
		`http.client`,
		`memory_usage.java_max_heap`,
		`memory_usage.java_total_heap`,
		`memory_usage.java_free_heap`,
		`memory_usage.total_pss`,
		`memory_usage.rss`,
		`memory_usage.native_total_heap`,
		`memory_usage.native_free_heap`,
		`memory_usage.interval_config`,
		// `low_memory`,
		`trim_memory.level`,
		`cpu_usage.num_cores`,
		`cpu_usage.clock_speed`,
		`cpu_usage.start_time`,
		`cpu_usage.uptime`,
		`cpu_usage.utime`,
		`cpu_usage.cutime`,
		`cpu_usage.stime`,
		`cpu_usage.cstime`,
		`cpu_usage.interval_config`,
		`navigation.route`,
		`attributes`,
	}

	stmt := sqlf.From("default.events")

	for i := range cols {
		stmt.Select(cols[i], nil)
	}

	stmt.Where("app_id = ? and session_id = ?", nil, nil)
	stmt.OrderBy("timestamp")

	rows, err := server.Server.ChPool.Query(context.Background(), stmt.String(), a.ID, sessionId)

	if err != nil {
		return nil, err
	}

	var session Session

	for rows.Next() {
		var ev event.EventField
		var anr event.ANR
		var exception event.Exception
		var exceptionExceptions string
		var exceptionThreads string
		var anrExceptions string
		var anrThreads string
		var appExit event.AppExit
		var logString event.LogString
		var gestureLongClick event.GestureLongClick
		var gestureClick event.GestureClick
		var gestureScroll event.GestureScroll
		var lifecycleActivity event.LifecycleActivity
		var lifecycleFragment event.LifecycleFragment
		var lifecycleApp event.LifecycleApp
		var coldLaunch event.ColdLaunch
		var warmLaunch event.WarmLaunch
		var hotLaunch event.HotLaunch
		var networkChange event.NetworkChange
		var http event.Http
		var memoryUsage event.MemoryUsage
		var trimMemory event.TrimMemory
		var cpuUsage event.CPUUsage
		var navigation event.Navigation
		var attributes map[string]string

		// FIXME: there are struct issues with
		// `low_memory` event
		// var lowMemory LowMemory

		dest := []any{
			&ev.ID,
			&ev.Type,
			&session.SessionID,
			&session.AppID,
			&session.IPv4,
			&session.IPv6,
			&session.CountryCode,
			&ev.Timestamp,
			&ev.ThreadName,

			// anr
			&anr.ThreadName,
			&anr.Fingerprint,
			&anr.NetworkType,
			&anr.NetworkGeneration,
			&anr.NetworkProvider,
			&anr.DeviceLocale,
			&anrExceptions,
			&anrThreads,

			// excpetion
			&exception.ThreadName,
			&exception.Handled,
			&exception.Fingerprint,
			&exception.NetworkType,
			&exception.NetworkGeneration,
			&exception.NetworkProvider,
			&exception.DeviceLocale,
			&exceptionExceptions,
			&exceptionThreads,

			// app exit
			&appExit.Reason,
			&appExit.Importance,
			&appExit.Trace,
			&appExit.ProcessName,
			&appExit.PID,

			// log string
			&logString.SeverityText,
			&logString.String,

			// gesture long click
			&gestureLongClick.Target,
			&gestureLongClick.TargetID,
			&gestureLongClick.TouchDownTime,
			&gestureLongClick.TouchUpTime,
			&gestureLongClick.Width,
			&gestureLongClick.Height,
			&gestureLongClick.X,
			&gestureLongClick.Y,

			// gesture click
			&gestureClick.Target,
			&gestureClick.TargetID,
			&gestureClick.TouchDownTime,
			&gestureClick.TouchUpTime,
			&gestureClick.Width,
			&gestureClick.Height,
			&gestureClick.X,
			&gestureClick.Y,

			// gesture scroll
			&gestureScroll.Target,
			&gestureScroll.TargetID,
			&gestureScroll.TouchDownTime,
			&gestureScroll.TouchUpTime,
			&gestureScroll.X,
			&gestureScroll.Y,
			&gestureScroll.EndX,
			&gestureScroll.EndY,
			&gestureScroll.Direction,

			// lifecycle activity
			&lifecycleActivity.Type,
			&lifecycleActivity.ClassName,
			&lifecycleActivity.Intent,
			&lifecycleActivity.SavedInstanceState,

			// lifecycle fragment
			&lifecycleFragment.Type,
			&lifecycleFragment.ClassName,
			&lifecycleFragment.ParentActivity,
			&lifecycleFragment.Tag,

			// lifecycle app
			&lifecycleApp.Type,

			// cold launch
			&coldLaunch.ProcessStartUptime,
			&coldLaunch.ProcessStartRequestedUptime,
			&coldLaunch.ContentProviderAttachUptime,
			&coldLaunch.OnNextDrawUptime,
			&coldLaunch.LaunchedActivity,
			&coldLaunch.HasSavedState,
			&coldLaunch.IntentData,

			// warm launch
			&warmLaunch.AppVisibleUptime,
			&warmLaunch.OnNextDrawUptime,
			&warmLaunch.LaunchedActivity,
			&warmLaunch.HasSavedState,
			&warmLaunch.IntentData,

			// hot launch
			&hotLaunch.AppVisibleUptime,
			&hotLaunch.OnNextDrawUptime,
			&hotLaunch.LaunchedActivity,
			&hotLaunch.HasSavedState,
			&hotLaunch.IntentData,

			// network change
			&networkChange.NetworkType,
			&networkChange.PreviousNetworkType,
			&networkChange.NetworkGeneration,
			&networkChange.PreviousNetworkGeneration,
			&networkChange.NetworkProvider,

			// http
			&http.URL,
			&http.Method,
			&http.StatusCode,
			&http.RequestBodySize,
			&http.ResponseBodySize,
			&http.RequestTimestamp,
			&http.ResponseTimestamp,
			&http.StartTime,
			&http.EndTime,
			&http.DNSStart,
			&http.DNSEnd,
			&http.ConnectStart,
			&http.ConnectEnd,
			&http.RequestStart,
			&http.RequestEnd,
			&http.RequestHeadersStart,
			&http.RequestHeadersEnd,
			&http.RequestBodyStart,
			&http.RequestBodyEnd,
			&http.ResponseStart,
			&http.ResponseEnd,
			&http.ResponseHeadersStart,
			&http.ResponseHeadersEnd,
			&http.ResponseBodyStart,
			&http.ResponseBodyEnd,
			&http.RequestHeadersSize,
			&http.ResponseHeadersSize,
			&http.FailureReason,
			&http.FailureDescription,
			&http.RequestHeaders,
			&http.ResponseHeaders,
			&http.Client,

			// memory usage
			&memoryUsage.JavaMaxHeap,
			&memoryUsage.JavaTotalHeap,
			&memoryUsage.JavaFreeHeap,
			&memoryUsage.TotalPSS,
			&memoryUsage.RSS,
			&memoryUsage.NativeTotalHeap,
			&memoryUsage.NativeFreeHeap,
			&memoryUsage.IntervalConfig,

			// trim memory
			&trimMemory.Level,

			// cpu usage
			&cpuUsage.NumCores,
			&cpuUsage.ClockSpeed,
			&cpuUsage.StartTime,
			&cpuUsage.Uptime,
			&cpuUsage.UTime,
			&cpuUsage.CUTime,
			&cpuUsage.STime,
			&cpuUsage.CSTime,
			&cpuUsage.IntervalConfig,

			// navigation
			&navigation.Route,

			// attributes
			&attributes,
		}

		if err := rows.Scan(dest...); err != nil {
			return nil, err
		}

		ev.Trim()
		ev.Attributes = attributes

		switch ev.Type {
		case event.TypeANR:
			if err := json.Unmarshal([]byte(anrExceptions), &anr.Exceptions); err != nil {
				return nil, err
			}
			if err := json.Unmarshal([]byte(anrThreads), &anr.Threads); err != nil {
				return nil, err
			}
			ev.ANR = anr
			session.Events = append(session.Events, ev)
		case event.TypeException:
			if err := json.Unmarshal([]byte(exceptionExceptions), &exception.Exceptions); err != nil {
				return nil, err
			}
			if err := json.Unmarshal([]byte(exceptionThreads), &exception.Threads); err != nil {
				return nil, err
			}
			ev.Exception = exception
			session.Events = append(session.Events, ev)
		case event.TypeAppExit:
			ev.AppExit = appExit
			session.Events = append(session.Events, ev)
		case event.TypeString:
			ev.LogString = logString
			session.Events = append(session.Events, ev)
		case event.TypeGestureLongClick:
			ev.GestureLongClick = gestureLongClick
			session.Events = append(session.Events, ev)
		case event.TypeGestureClick:
			ev.GestureClick = gestureClick
			session.Events = append(session.Events, ev)
		case event.TypeGestureScroll:
			ev.GestureScroll = gestureScroll
			session.Events = append(session.Events, ev)
		case event.TypeLifecycleActivity:
			ev.LifecycleActivity = lifecycleActivity
			session.Events = append(session.Events, ev)
		case event.TypeLifecycleFragment:
			ev.LifecycleFragment = lifecycleFragment
			session.Events = append(session.Events, ev)
		case event.TypeLifecycleApp:
			ev.LifecycleApp = lifecycleApp
			session.Events = append(session.Events, ev)
		case event.TypeColdLaunch:
			ev.ColdLaunch = coldLaunch
			session.Events = append(session.Events, ev)
		case event.TypeWarmLaunch:
			ev.WarmLaunch = warmLaunch
			session.Events = append(session.Events, ev)
		case event.TypeHotLaunch:
			ev.HotLaunch = hotLaunch
			session.Events = append(session.Events, ev)
		case event.TypeNetworkChange:
			ev.NetworkChange = networkChange
			session.Events = append(session.Events, ev)
		case event.TypeHttp:
			ev.Http = http
			session.Events = append(session.Events, ev)
		case event.TypeMemoryUsage:
			ev.MemoryUsage = memoryUsage
			session.Events = append(session.Events, ev)
		case event.TypeTrimMemory:
			ev.TrimMemory = trimMemory
			session.Events = append(session.Events, ev)
		case event.TypeCPUUsage:
			ev.CPUUsage = cpuUsage
			session.Events = append(session.Events, ev)
		case event.TypeNavigation:
			ev.Navigation = navigation
			session.Events = append(session.Events, ev)
		default:
			continue
		}
	}

	return &session, nil
}

func GetAppJourney(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}
	af := AppFilter{
		AppID: id,
		Limit: DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		fmt.Println(err.Error())
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := af.validate(); err != nil {
		msg := "app journey request validation failed"
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	if !af.hasTimeRange() {
		af.setDefaultTimeRange()
	}

	// fmt.Println("journey request app id", af.AppID)
	// fmt.Println("journey request from", af.From)
	// fmt.Println("journey request to", af.To)
	// fmt.Println("journey request version", af.Version)

	data1 := `{"nodes":[{"id":"Home Screen","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"Order History","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"Order Status","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"Support","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"List Of Items","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"Sales Offer","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"View Item Images","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"View Item Detail","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"Cyber Monday Sale Items List","nodeColor":"hsl(0, 72%, 51%)","issues":{"crashes":[{"title":"NullPointerException.java","count":37893},{"title":"LayoutInflaterException.java","count":12674}],"anrs":[{"title":"CyberMondayActivity.java","count":97321},{"title":"CyberMondayFragment.kt","count":8005}]}},{"id":"Add To Cart","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"Pay","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"Explore Discounts","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}}],"links":[{"source":"Home Screen","target":"Order History","value":50000},{"source":"Home Screen","target":"List Of Items","value":73356},{"source":"Home Screen","target":"Cyber Monday Sale Items List","value":97652},{"source":"Order History","target":"Order Status","value":9782},{"source":"Order History","target":"Support","value":2837},{"source":"List Of Items","target":"Sales Offer","value":14678},{"source":"List Of Items","target":"View Item Detail","value":23654},{"source":"Cyber Monday Sale Items List","target":"View Item Detail","value":43889},{"source":"Cyber Monday Sale Items List","target":"Explore Discounts","value":34681},{"source":"Sales Offer","target":"View Item Images","value":12055},{"source":"View Item Detail","target":"View Item Images","value":16793},{"source":"View Item Detail","target":"Add To Cart","value":11537},{"source":"Add To Cart","target":"Pay","value":10144},{"source":"Add To Cart","target":"Explore Discounts","value":4007}]}`

	data2 := `{"nodes":[{"id":"Home Screen","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"Order History","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"Order Status","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"Support","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"List Of Items","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"Sales Offer","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"View Item Images","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"View Item Detail","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"Cyber Monday Sale Items List","nodeColor":"hsl(0, 72%, 51%)","issues":{"crashes":[{"title":"NullPointerException.java","count":32893},{"title":"LayoutInflaterException.java","count":12874}],"anrs":[{"title":"CyberMondayActivity.java","count":77321},{"title":"CyberMondayFragment.kt","count":6305}]}},{"id":"Add To Cart","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"Pay","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"Explore Discounts","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}}],"links":[{"source":"Home Screen","target":"Order History","value":60000},{"source":"Home Screen","target":"List Of Items","value":53356},{"source":"Home Screen","target":"Cyber Monday Sale Items List","value":96652},{"source":"Order History","target":"Order Status","value":9822},{"source":"Order History","target":"Support","value":2287},{"source":"List Of Items","target":"Sales Offer","value":12628},{"source":"List Of Items","target":"View Item Detail","value":53254},{"source":"Cyber Monday Sale Items List","target":"View Item Detail","value":43889},{"source":"Cyber Monday Sale Items List","target":"Explore Discounts","value":34681},{"source":"Sales Offer","target":"View Item Images","value":12055},{"source":"View Item Detail","target":"View Item Images","value":12793},{"source":"View Item Detail","target":"Add To Cart","value":16537},{"source":"Add To Cart","target":"Pay","value":10144},{"source":"Add To Cart","target":"Explore Discounts","value":3007}]}`

	var data string
	randomInt := rand.Intn(100)
	if randomInt > 85 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "API server is experiencing intermittent issues"})
		return
	}
	if randomInt%2 == 0 {
		data = data1
	} else {
		data = data2
	}

	c.Data(http.StatusOK, "application/json", []byte(data))
}

func GetAppMetrics(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}
	af := AppFilter{
		AppID: id,
		Limit: DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		fmt.Println(err.Error())
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := af.validate(); err != nil {
		msg := "app journey request validation failed"
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	if !af.hasTimeRange() {
		af.setDefaultTimeRange()
	}

	// fmt.Println("journey request app id", af.AppID)
	// fmt.Println("journey request from", af.From)
	// fmt.Println("journey request to", af.To)
	// fmt.Println("journey request version", af.Version)

	data1 := `{"adoption":{"users":40000,"totalUsers":200000,"value":20},"app_size":{"value":20,"delta":3.18},"crash_free_users":{"value":98.5,"delta":0.73},"perceived_crash_free_users":{"value":91.3,"delta":-0.51},"multiple_crash_free_users":{"value":76.37,"delta":0.62},"anr_free_users":{"value":98.5,"delta":0.73},"perceived_anr_free_users":{"value":91.3,"delta":0.27},"multiple_anr_free_users":{"value":97.88,"delta":-3.13},"app_cold_launch":{"value":937,"delta":34},"app_warm_launch":{"value":600,"delta":-87},"app_hot_launch":{"value":250,"delta":-55}}`
	data2 := `{"adoption":{"users":49000,"totalUsers":200000,"value":28},"app_size":{"value":20,"delta":3.18},"crash_free_users":{"value":98.2,"delta":0.71},"perceived_crash_free_users":{"value":92.8,"delta":-0.81},"multiple_crash_free_users":{"value":75.49,"delta":0.38},"anr_free_users":{"value":98.3,"delta":0.43},"perceived_anr_free_users":{"value":91.9,"delta":0.77},"multiple_anr_free_users":{"value":97.26,"delta":-2.85},"app_cold_launch":{"value":900,"delta":-200},"app_warm_launch":{"value":600,"delta":-127},"app_hot_launch":{"value":300,"delta":-50}}`

	var data string
	randomInt := rand.Intn(100)
	if randomInt > 85 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "API server is experiencing intermittent issues"})
		return
	}
	if randomInt%2 == 0 {
		data = data1
	} else {
		data = data2
	}

	c.Data(http.StatusOK, "application/json", []byte(data))
}

func GetAppFilters(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := AppFilter{
		AppID: id,
		Limit: DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	if err := af.validate(); err != nil {
		msg := "app filters request validation failed"
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam()
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	var fl FilterList

	if err := af.getGenericFilters(&fl); err != nil {
		msg := `failed to query app filters`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, fl)
}

func GetCrashGroups(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := AppFilter{
		AppID: id,
		Limit: DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	af.expand()

	if err := af.validate(); err != nil {
		msg := "app filters request validation failed"
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	if !af.hasTimeRange() {
		af.setDefaultTimeRange()
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam()
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	groups, err := app.GetExceptionGroups(&af)
	if err != nil {
		msg := "failed to get app's exception groups"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	var crashGroups []ExceptionGroup
	for i := range groups {
		ids, err := GetEventIdsMatchingFilter(groups[i].EventIDs, &af)
		if err != nil {
			msg := "failed to get app's exception group's event ids"
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
			return
		}

		count := len(ids)

		// only consider those groups that have at least 1 exception
		// event
		if count > 0 {
			groups[i].Count = count

			// omit `event_ids` & `exception_events` fields from JSON
			// response, because these can get really huge
			groups[i].EventIDs = nil
			groups[i].EventExceptions = nil

			crashGroups = append(crashGroups, groups[i])
		}
	}

	ComputeCrashContribution(crashGroups)
	SortExceptionGroups(crashGroups)
	crashGroups, next, previous := PaginateGroups(crashGroups, &af)
	meta := gin.H{"next": next, "previous": previous}

	c.JSON(http.StatusOK, gin.H{"results": crashGroups, "meta": meta})
}

func GetCrashGroupCrashes(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	crashGroupId, err := uuid.Parse(c.Param("crashGroupId"))
	if err != nil {
		msg := `crash group id is invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := AppFilter{
		AppID: id,
		Limit: DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	af.expand()

	if err := af.validate(); err != nil {
		msg := "app filters request validation failed"
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam()
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	group, err := app.GetExceptionGroup(crashGroupId)
	if err != nil {
		msg := fmt.Sprintf("failed to get exception group with id %q", crashGroupId.String())
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	eventExceptions, next, previous, err := GetExceptionsWithFilter(group.EventIDs, &af)
	if err != nil {
		msg := `failed to get exception group's exception events`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{"results": eventExceptions, "meta": gin.H{"next": next, "previous": previous}})
}

func GetANRGroups(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := AppFilter{
		AppID: id,
		Limit: DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	if err := af.validate(); err != nil {
		msg := "app filters request validation failed"
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	if !af.hasTimeRange() {
		af.setDefaultTimeRange()
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam()
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	groups, err := app.GetANRGroups(&af)
	if err != nil {
		msg := "failed to get app's anr groups"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	var anrGroups []ANRGroup
	for i := range groups {
		ids, err := GetEventIdsMatchingFilter(groups[i].EventIDs, &af)
		if err != nil {
			msg := "failed to get app's anr group's event ids"
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
			return
		}

		count := len(ids)

		// only consider those groups that have at least 1 anr
		// event
		if count > 0 {
			groups[i].Count = count

			// omit `event_ids` & `exception_anrs` fields from JSON
			// response, because these can get really huge
			groups[i].EventIDs = nil
			groups[i].EventANRs = nil

			anrGroups = append(anrGroups, groups[i])
		}
	}

	ComputeANRContribution(anrGroups)
	SortANRGroups(anrGroups)
	anrGroups, next, previous := PaginateGroups(anrGroups, &af)
	meta := gin.H{"next": next, "previous": previous}

	c.JSON(http.StatusOK, gin.H{"results": anrGroups, "meta": meta})
}

func GetANRGroupANRs(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	anrGroupId, err := uuid.Parse(c.Param("anrGroupId"))
	if err != nil {
		msg := `anr group id is invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := AppFilter{
		AppID: id,
		Limit: DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	af.expand()

	if err := af.validate(); err != nil {
		msg := "app filters request validation failed"
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam()
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	group, err := app.GetANRGroup(anrGroupId)
	if err != nil {
		msg := fmt.Sprintf("failed to get anr group with id %q", anrGroupId.String())
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	eventANRs, next, previous, err := GetANRsWithFilter(group.EventIDs, &af)
	if err != nil {
		msg := `failed to get anr group's anr events`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{"results": eventANRs, "meta": gin.H{"next": next, "previous": previous}})
}

func CreateApp(c *gin.Context) {
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	ok, err := PerformAuthz(userId, teamId.String(), *ScopeAppAll)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to create apps in team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	app := NewApp(teamId)
	if err := c.ShouldBindJSON(&app); err != nil {
		msg := `failed to parse app json payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	apiKey, err := app.add()

	if err != nil {
		msg := "failed to create app"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	app.APIKey = apiKey

	c.JSON(http.StatusCreated, app)
}

func GetAppSession(c *gin.Context) {
	appId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	sessionId, err := uuid.Parse(c.Param("sessionId"))
	if err != nil {
		msg := `session id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	app := &App{
		ID: &appId,
	}
	team, err := app.getTeam()
	if err != nil {
		msg := `failed to fetch team from app`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")

	ok, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to read apps in team %q`, team.ID)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	ok, err = PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to read apps in team %q`, team.ID)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	session, err := app.GetSessionEvents(sessionId)
	if err != nil {
		msg := `failed to fetch session data for replay`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	duration := session.Duration().Milliseconds()
	cpuUsageEvents := session.EventsOfType(event.TypeCPUUsage)
	cpuUsages := replay.ComputeCPUUsage(cpuUsageEvents)

	memoryUsageEvents := session.EventsOfType(event.TypeMemoryUsage)
	memoryUsages := replay.ComputeMemoryUsage(memoryUsageEvents)

	typeList := []string{
		event.TypeGestureClick,
		event.TypeGestureLongClick,
		event.TypeGestureScroll,
		event.TypeNavigation,
		event.TypeString,
		event.TypeNetworkChange,
		event.TypeColdLaunch,
		event.TypeWarmLaunch,
		event.TypeHotLaunch,
		event.TypeLifecycleActivity,
		event.TypeLifecycleFragment,
		event.TypeLifecycleApp,
		event.TypeTrimMemory,
		event.TypeAppExit,
		event.TypeException,
		event.TypeANR,
		event.TypeHttp,
	}

	eventMap := session.EventsOfTypes(typeList...)
	threads := make(replay.Threads)

	gestureClickEvents := eventMap[event.TypeGestureClick]
	if len(gestureClickEvents) > 0 {
		gestureClicks := replay.ComputeGestureClicks(gestureClickEvents)
		threadedGestureClicks := replay.GroupByThreads(gestureClicks)
		threads.Organize(event.TypeGestureClick, threadedGestureClicks)
	}

	gestureLongClickEvents := eventMap[event.TypeGestureLongClick]
	if len(gestureLongClickEvents) > 0 {
		gestureLongClicks := replay.ComputeGestureLongClicks(gestureLongClickEvents)
		threadedGestureLongClicks := replay.GroupByThreads(gestureLongClicks)
		threads.Organize(event.TypeGestureLongClick, threadedGestureLongClicks)
	}

	gestureScrollEvents := eventMap[event.TypeGestureScroll]
	if len(gestureScrollEvents) > 0 {
		gestureScrolls := replay.ComputeGestureScrolls(gestureScrollEvents)
		threadedGestureScrolls := replay.GroupByThreads(gestureScrolls)
		threads.Organize(event.TypeGestureScroll, threadedGestureScrolls)
	}

	navEvents := eventMap[event.TypeNavigation]
	if len(navEvents) > 0 {
		navs := replay.ComputeNavigation(navEvents)
		threadedNavs := replay.GroupByThreads(navs)
		threads.Organize(event.TypeNavigation, threadedNavs)
	}

	logEvents := eventMap[event.TypeString]
	if len(logEvents) > 0 {
		logs := replay.ComputeLogString(logEvents)
		threadedLogs := replay.GroupByThreads(logs)
		threads.Organize(event.TypeString, threadedLogs)
	}

	netChangeEvents := eventMap[event.TypeNetworkChange]
	if len(netChangeEvents) > 0 {
		netChanges := replay.ComputeNetworkChange(netChangeEvents)
		threadedNetChanges := replay.GroupByThreads(netChanges)
		threads.Organize(event.TypeNetworkChange, threadedNetChanges)
	}

	coldLaunchEvents := eventMap[event.TypeColdLaunch]
	if len(coldLaunchEvents) > 0 {
		coldLaunches := replay.ComputeColdLaunches(coldLaunchEvents)
		threadedColdLaunches := replay.GroupByThreads(coldLaunches)
		threads.Organize(event.TypeColdLaunch, threadedColdLaunches)
	}

	warmLaunchEvents := eventMap[event.TypeWarmLaunch]
	if len(warmLaunchEvents) > 0 {
		warmLaunches := replay.ComputeColdLaunches(warmLaunchEvents)
		threadedWarmLaunches := replay.GroupByThreads(warmLaunches)
		threads.Organize(event.TypeWarmLaunch, threadedWarmLaunches)
	}

	hotLaunchEvents := eventMap[event.TypeHotLaunch]
	if len(hotLaunchEvents) > 0 {
		hotLaunches := replay.ComputeColdLaunches(hotLaunchEvents)
		threadedHotLaunches := replay.GroupByThreads(hotLaunches)
		threads.Organize(event.TypeHotLaunch, threadedHotLaunches)
	}

	lifecycleActivityEvents := eventMap[event.TypeLifecycleActivity]
	if len(lifecycleActivityEvents) > 0 {
		lifecycleActivities := replay.ComputeLifecycleActivities(lifecycleActivityEvents)
		threadedLifecycleActivities := replay.GroupByThreads(lifecycleActivities)
		threads.Organize(event.TypeLifecycleActivity, threadedLifecycleActivities)
	}

	lifecycleFragmentEvents := eventMap[event.TypeLifecycleFragment]
	if len(lifecycleActivityEvents) > 0 {
		lifecycleFragments := replay.ComputeLifecycleFragments(lifecycleFragmentEvents)
		threadedLifecycleFragments := replay.GroupByThreads(lifecycleFragments)
		threads.Organize(event.TypeLifecycleFragment, threadedLifecycleFragments)
	}

	lifecycleAppEvents := eventMap[event.TypeLifecycleApp]
	if len(lifecycleActivityEvents) > 0 {
		lifecycleApps := replay.ComputeLifecycleApps(lifecycleAppEvents)
		threadedLifecycleApps := replay.GroupByThreads(lifecycleApps)
		threads.Organize(event.TypeLifecycleApp, threadedLifecycleApps)
	}

	trimMemoryEvents := eventMap[event.TypeTrimMemory]
	if len(trimMemoryEvents) > 0 {
		trimMemories := replay.ComputeTrimMemories(trimMemoryEvents)
		threadedTrimMemories := replay.GroupByThreads(trimMemories)
		threads.Organize(event.TypeTrimMemory, threadedTrimMemories)
	}

	appExitEvents := eventMap[event.TypeAppExit]
	if len(appExitEvents) > 0 {
		appExits := replay.ComputeAppExits(appExitEvents)
		threadedAppExits := replay.GroupByThreads(appExits)
		threads.Organize(event.TypeAppExit, threadedAppExits)
	}

	exceptionEvents := eventMap[event.TypeException]
	if len(exceptionEvents) > 0 {
		exceptions := replay.ComputeExceptions(exceptionEvents)
		threadedExceptions := replay.GroupByThreads(exceptions)
		threads.Organize(event.TypeException, threadedExceptions)
	}

	anrEvents := eventMap[event.TypeANR]
	if len(anrEvents) > 0 {
		anrs := replay.ComputeANRs(anrEvents)
		threadedANRs := replay.GroupByThreads(anrs)
		threads.Organize(event.TypeANR, threadedANRs)
	}

	httpEvents := eventMap[event.TypeHttp]
	if len(httpEvents) > 0 {
		httpies := replay.ComputeHttp(httpEvents)
		threadedHttpies := replay.GroupByThreads(httpies)
		threads.Organize(event.TypeHttp, threadedHttpies)
	}

	threads.Sort()

	resource := &session.Resource

	if session.hasEvents() {
		firstEvent := session.firstEvent()
		res, err := app.GetEventResource(firstEvent.ID)
		if err != nil {
			msg := `failed to fetch session resource`
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
			return
		}
		resource = res
	}

	resource.Trim()

	response := gin.H{
		"session_id":   sessionId,
		"resource":     resource,
		"app_id":       appId,
		"duration":     duration,
		"cpu_usage":    cpuUsages,
		"memory_usage": memoryUsages,
		"threads":      threads,
	}

	c.JSON(http.StatusOK, response)
}
