package measure

import (
	"backend/api/event"
	"backend/api/filter"
	"backend/api/numeric"
	"backend/api/server"
	"backend/api/session"
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

type Session struct {
	SessionID uuid.UUID          `json:"session_id" binding:"required"`
	AppID     uuid.UUID          `json:"app_id"`
	Attribute *event.Attribute   `json:"attribute" binding:"required"`
	Events    []event.EventField `json:"events" binding:"required"`
}

// type Session struct {
// 	SessionID       uuid.UUID          `json:"session_id" binding:"required"`
// 	AppID           uuid.UUID          `json:"app_id"`
// 	Attribute       *event.Attribute   `json:"attribute" binding:"required"`
// 	Events          []event.EventField `json:"events" binding:"required"`
// 	FirstEventTime  *time.Time         `json:"first_event_time" binding:"required"`
// 	LastEventTime   *time.Time         `json:"last_event_time" binding:"required"`
// 	Duration        int64              `json:"duration"`
// 	MatchedFreeText string             `json:"matched_free_text"`
// }

type SessionDisplay struct {
	*Session
	FirstEventTime  *time.Time    `json:"first_event_time" binding:"required"`
	LastEventTime   *time.Time    `json:"last_event_time" binding:"required"`
	Duration        time.Duration `json:"duration"`
	MatchedFreeText string        `json:"matched_free_text"`
}

// firstEvent returns a pointer to the first event
// from the session's event slice.
func (s Session) GetID() uuid.UUID {
	return s.SessionID
}

// hasEvents returns true if the session contains at least
// one event.
func (s *Session) hasEvents() bool {
	return len(s.Events) > 0
}

// Duration calculates time duration between the last
// event and the first event in the session.
// func (s Session) DurationFromTimeStamps() time.Duration {
// 	return s.LastEventTime.Sub(*s.FirstEventTime)
// }

// firstEvent returns a pointer to the first event
// from the session's event slice.
func (s *Session) firstEvent() *event.EventField {
	if s.hasEvents() {
		return &s.Events[0]
	}
	return nil
}

// lastEvent returns a pointer to the last event
// from the session's event slice.
func (s *Session) lastEvent() *event.EventField {
	if s.hasEvents() {
		return &s.Events[len(s.Events)-1]
	}
	return nil
}

// EventsOfType retuns a slice of event.EventField that
// matches the accepted event type.
func (s *Session) EventsOfType(t string) (result []event.EventField) {
	for i := range s.Events {
		if s.Events[i].Type == t {
			result = append(result, s.Events[i])
		}
	}
	return
}

// EventsOfTypes provides events from the session
// matched by type.
func (s *Session) EventsOfTypes(types ...string) (result map[string][]event.EventField) {
	result = make(map[string][]event.EventField)
	for i := range s.Events {
		contains := slices.ContainsFunc(types, func(t string) bool {
			return t == s.Events[i].Type
		})
		if contains {
			result[s.Events[i].Type] = append(result[s.Events[i].Type], s.Events[i])
		}
	}
	return
}

// GetFirstEventTime provides the timestamp value of
// the first event of the session. Assumes session's
// event list is sorted ascending by timestamp.
//
// Returns zero time value if no events exist in the
// session.
func (s *Session) GetFirstEventTime() time.Time {
	if event := s.firstEvent(); event != nil {
		return event.Timestamp
	}

	return time.Time{}
}

// GetLastEventTime provides the timestamp value of
// the last event of the session. Assumes session's
// event list is sorted ascending by timestamp.
//
// Returns zero time value if no events exist in the
// session.
func (s *Session) GetLastEventTime() time.Time {
	if event := s.lastEvent(); event != nil {
		return event.Timestamp
	}

	return time.Time{}
}

// Duration calculates time duration between the last
// event and the first event in the session.
func (s Session) DurationFromEvents() time.Duration {
	return s.GetLastEventTime().Sub(s.GetFirstEventTime())
}

// GetSessionsInstancesPlot queries aggregated
// session instances respecting all filters.
func GetSessionsInstancesPlot(ctx context.Context, af *filter.AppFilter) (sessionInstances []session.SessionInstance, err error) {
	base := sqlf.From("sessions").
		Select("session_id").
		Select("first_event_timestamp").
		Select("last_event_timestamp").
		Select("app_version").
		Clause("prewhere app_id = toUUID(?) and first_event_timestamp >= ? and last_event_timestamp <= ?", af.AppID, af.From, af.To)

	if af.Crash && af.ANR {
		base.Select("uniqMerge(crash_count) crash_count")
		base.Select("uniqMerge(anr_count) anr_count")
		base.Having("crash_count >= 1 or anr_count >= 1")
	} else if af.Crash {
		base.Select("uniqMerge(crash_count) crash_count")
		base.Having("crash_count >= 1")
	} else if af.ANR {
		base.Select("uniqMerge(anr_count) anr_count")
		base.Having("anr_count >= 1")
	}

	if af.HasVersions() {
		selectedVersions, err := af.VersionPairs()
		if err != nil {
			return nil, err
		}

		base.Where(fmt.Sprintf("app_version in (%s)", selectedVersions.String()))
	}

	if af.HasOSVersions() {
		selectedOSVersions, err := af.OSVersionPairs()
		if err != nil {
			return nil, err
		}

		base.Where(fmt.Sprintf("os_version in (%s)", selectedOSVersions.String()))
	}

	if af.HasCountries() {
		base.Where("country_code in ?", af.Countries)
	}

	if af.HasNetworkProviders() {
		base.Where("network_provider in ?", af.NetworkProviders)
	}

	if af.HasNetworkTypes() {
		base.Where("network_type in ?", af.NetworkTypes)
	}

	if af.HasNetworkGenerations() {
		base.Where("network_generation in ?", af.NetworkGenerations)
	}

	if af.HasDeviceLocales() {
		base.Where("device_locale in ?", af.Locales)
	}

	if af.HasDeviceManufacturers() {
		base.Where("device_manufacturer in ?", af.DeviceManufacturers)
	}

	if af.HasDeviceNames() {
		base.Where("device_name in ?", af.DeviceNames)
	}

	if af.FreeText != "" {
		freeText := fmt.Sprintf("%%%s%%", af.FreeText)

		// to add/remove items, only modify this slice
		// of query strings. rest of the query exec
		// infra is self adapting.
		matches := []string{
			"user_id like ?",
			"arrayExists(x -> x ilike ?, unique_types)",
			"arrayExists(x -> x ilike ?, unique_strings)",
			"arrayExists(x -> x ilike ?, unique_view_classnames)",
			"arrayExists(x -> x ilike ?, unique_subview_classnames)",
			"arrayExists(x -> x.type ilike ?, unique_exceptions)",
			"arrayExists(x -> x.message ilike ?, unique_exceptions)",
			"arrayExists(x -> x.file_name ilike ?, unique_exceptions)",
			"arrayExists(x -> x.class_name ilike ?, unique_exceptions)",
			"arrayExists(x -> x.method_name ilike ?, unique_exceptions)",
			"arrayExists(x -> x.type ilike ?, unique_anrs)",
			"arrayExists(x -> x.message ilike ?, unique_anrs)",
			"arrayExists(x -> x.file_name ilike ?, unique_anrs)",
			"arrayExists(x -> x.class_name ilike ?, unique_anrs)",
			"arrayExists(x -> x.method_name ilike ?, unique_anrs)",
			"arrayExists(x -> x.1 ilike ?, unique_click_targets)",
			"arrayExists(x -> x.2 ilike ?, unique_click_targets)",
			"arrayExists(x -> x.1 ilike ?, unique_longclick_targets)",
			"arrayExists(x -> x.2 ilike ?, unique_longclick_targets)",
			"arrayExists(x -> x.1 ilike ?, unique_scroll_targets)",
			"arrayExists(x -> x.2 ilike ?, unique_scroll_targets)",
		}

		// compute arguments automatically
		args := []any{}
		for i := 0; i < len(matches); i++ {
			args = append(args, freeText)
		}

		// run the complex text matching query joined
		// with multiple 'OR' and inject the args
		base.Where(strings.Join(matches, " or "), args...)
	}

	applyGroupBy := af.Crash ||
		af.ANR ||
		af.HasCountries() ||
		af.HasNetworkProviders() ||
		af.HasNetworkTypes() ||
		af.HasNetworkGenerations() ||
		af.HasDeviceLocales() ||
		af.HasDeviceManufacturers() ||
		af.HasDeviceNames()

	if applyGroupBy {
		base.GroupBy("session_id")
		base.GroupBy("app_version")
		base.GroupBy("first_event_timestamp")
		base.GroupBy("last_event_timestamp")
	}

	stmt := sqlf.
		With("base", base).
		From("base").
		Select("uniq(session_id) instances").
		Select("formatDateTime(first_event_timestamp, '%Y-%m-%d', ?) datetime", af.Timezone).
		Select("concat(tupleElement(app_version, 1), ' ', '(', tupleElement(app_version, 2), ')') app_version_fmt").
		GroupBy("app_version, datetime").
		OrderBy("datetime, tupleElement(app_version, 2) desc")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var sessionInstance session.SessionInstance
		if err = rows.Scan(&sessionInstance.Instances, &sessionInstance.DateTime, &sessionInstance.Version); err != nil {
			return
		}

		sessionInstances = append(sessionInstances, sessionInstance)
	}

	err = rows.Err()

	return
}

// GetSessionsPlot queries session instances
// by datetime and filters.
func GetSessionsPlot(ctx context.Context, af *filter.AppFilter) (sessionInstances []session.SessionInstance, err error) {
	if af.Timezone == "" {
		return nil, errors.New("timezone filter needs to be provided for sessions plot")
	}

	base := sqlf.
		From("default.events").
		Select("session_id").
		Select("any(attribute.app_version) as app_version").
		Select("any(attribute.app_build) as app_build").
		Where("app_id = ?", af.AppID)

	if len(af.Versions) > 0 {
		base.Where("attribute.app_version").In(af.Versions)
	}

	if len(af.VersionCodes) > 0 {
		base.Where("attribute.app_build").In(af.VersionCodes)
	}

	if af.Crash && af.ANR {
		base.Where("((type = 'exception' AND exception.handled = false) OR type = 'anr')")
	} else if af.Crash {
		base.Where("type = 'exception' AND exception.handled = false")
	} else if af.ANR {
		base.Where("type = 'anr'")
	}

	if len(af.OsNames) > 0 {
		base.Where("attribute.os_name").In(af.OsNames)
	}

	if len(af.OsVersions) > 0 {
		base.Where("attribute.os_version").In(af.OsVersions)
	}

	if len(af.Countries) > 0 {
		base.Where("inet.country_code").In(af.Countries)
	}

	if len(af.DeviceNames) > 0 {
		base.Where("attribute.device_name").In(af.DeviceNames)
	}

	if len(af.DeviceManufacturers) > 0 {
		base.Where("attribute.device_manufacturer").In(af.DeviceManufacturers)
	}

	if len(af.Locales) > 0 {
		base.Where("attribute.device_locale").In(af.Locales)
	}

	if len(af.NetworkProviders) > 0 {
		base.Where("attribute.network_provider").In(af.NetworkProviders)
	}

	if len(af.NetworkTypes) > 0 {
		base.Where("attribute.network_type").In(af.NetworkTypes)
	}

	if len(af.NetworkGenerations) > 0 {
		base.Where("attribute.network_generation").In(af.NetworkGenerations)
	}

	if af.FreeText != "" {
		base.Where(
			"("+
				"attribute.user_id ILIKE ? OR "+
				"string.string ILIKE ? OR "+
				"toString(exception.exceptions) ILIKE ? OR "+
				"toString(anr.exceptions) ILIKE ? OR "+
				"type ILIKE ? OR "+
				"lifecycle_activity.class_name ILIKE ? OR "+
				"lifecycle_fragment.class_name ILIKE ? OR "+
				"gesture_click.target_id ILIKE ? OR "+
				"gesture_long_click.target_id ILIKE ? OR "+
				"gesture_scroll.target_id ILIKE ? OR "+
				"gesture_click.target ILIKE ? OR "+
				"gesture_long_click.target ILIKE ? OR "+
				"gesture_scroll.target ILIKE ?"+
				")",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%")
	}

	if af.HasTimeRange() {
		base.Where("timestamp >= ? and timestamp <= ?", af.From, af.To)
	}

	base.GroupBy("session_id")

	firstEventTimeStmt := sqlf.
		From("default.events").
		Select("session_id").
		Select("MIN(timestamp) AS first_event_time").
		Where("app_id = ?", af.AppID).
		GroupBy("session_id")

	stmt := sqlf.
		With("base_events", base).
		With("first_event_times", firstEventTimeStmt).
		From("base_events").
		Join("first_event_times f ", "base_events.session_id = f.session_id").
		Select("formatDateTime(f.first_event_time, '%Y-%m-%d', ?) as datetime", af.Timezone).
		Select("concat(toString(app_version), '', '(', toString(app_build), ')') as app_version").
		Select("count(distinct base_events.session_id) as instances").
		GroupBy("app_version, datetime").
		OrderBy("datetime, app_version")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}
	if rows.Err() != nil {
		return
	}

	defer rows.Close()

	for rows.Next() {
		var instance session.SessionInstance
		if err := rows.Scan(&instance.DateTime, &instance.Version, &instance.Instances); err != nil {
			return nil, err
		}

		if *instance.Instances > 0 {
			sessionInstances = append(sessionInstances, instance)
		}
	}

	return
}

func GetSessionsWithFilter(ctx context.Context, af *filter.AppFilter) (sessions []SessionDisplay, next, previous bool, err error) {
	pageSize := af.ExtendLimit()
	forward := af.HasPositiveLimit()
	operator := "<"
	order := "desc"
	if !forward {
		operator = ">"
		order = "asc"
	}

	// don't entertain reverse order
	// when no keyset present
	if !af.HasKeyset() && !forward {
		return
	}

	timeformat := "2006-01-02T15:04:05.000"
	var keyTimestamp string
	if !af.KeyTimestamp.IsZero() {
		keyTimestamp = af.KeyTimestamp.Format(timeformat)
	}

	substmt := sqlf.From("sessions").
		Select("distinct session_id").
		Select("user_id").
		Select("first_event_timestamp").
		Select("last_event_timestamp").
		Select("app_version").
		Select("os_version").
		Select("device_name").
		Select("device_manufacturer").
		Select("device_model").
		Select(fmt.Sprintf("row_number() over (order by first_event_timestamp %s, session_id) as row_num", order)).
		Clause("prewhere app_id = toUUID(?) and first_event_timestamp >= ? and last_event_timestamp <= ?", af.AppID, af.From, af.To)
		// Select("row_number() over (order by first_event_timestamp desc, session_id) as row_num").
		// GroupBy("session_id, first_event_timestamp, last_event_timestamp, app_version, os_version, device_name, device_manufacturer, device_model, user_id")
		// Where("app_id = toUUID(?)", af.AppID).
		// GroupBy("os_version").
		// GroupBy("device_manufacturer").
		// GroupBy("device_model")

	if af.Crash && af.ANR {
		substmt.Select("uniqMerge(crash_count) crash_count")
		substmt.Select("uniqMerge(anr_count) anr_count")
		substmt.Having("crash_count >= 1 or anr_count >= 1")
	} else if af.Crash {
		substmt.Select("uniqMerge(crash_count) crash_count")
		substmt.Having("crash_count >= 1")
	} else if af.ANR {
		substmt.Select("uniqMerge(anr_count) anr_count")
		substmt.Having("anr_count >= 1")
	}

	if af.HasVersions() {
		selectedVersions, err := af.VersionPairs()
		if err != nil {
			return sessions, next, previous, err
		}

		substmt.Where(fmt.Sprintf("app_version in (%s)", selectedVersions.String()))
	}

	if af.HasOSVersions() {
		selectedOSVersions, err := af.OSVersionPairs()
		if err != nil {
			return sessions, next, previous, err
		}

		substmt.Where(fmt.Sprintf("os_version in (%s)", selectedOSVersions.String()))
	}

	if af.HasCountries() {
		substmt.Where("country_code in ?", af.Countries)
	}

	if af.HasNetworkProviders() {
		substmt.Where("network_provider in ?", af.NetworkProviders)
	}

	if af.HasNetworkTypes() {
		substmt.Where("network_type in ?", af.NetworkTypes)
	}

	if af.HasNetworkGenerations() {
		substmt.Where("network_generation in ?", af.NetworkGenerations)
	}

	if af.HasDeviceLocales() {
		substmt.Where("device_locale in ?", af.Locales)
	}

	if af.HasDeviceManufacturers() {
		substmt.Where("device_manufacturer in ?", af.DeviceManufacturers)
	}

	if af.HasDeviceNames() {
		substmt.Where("device_name in ?", af.DeviceNames)
	}

	if af.FreeText != "" {
		freeText := fmt.Sprintf("%%%s%%", af.FreeText)

		// to add/remove items, only modify this slice
		// of query strings. rest of the query exec
		// infra is self adapting.
		matches := []string{
			"user_id like ?",
			"arrayExists(x -> x ilike ?, unique_types)",
			"arrayExists(x -> x ilike ?, unique_strings)",
			"arrayExists(x -> x ilike ?, unique_view_classnames)",
			"arrayExists(x -> x ilike ?, unique_subview_classnames)",
			"arrayExists(x -> x.type ilike ?, unique_exceptions)",
			"arrayExists(x -> x.message ilike ?, unique_exceptions)",
			"arrayExists(x -> x.file_name ilike ?, unique_exceptions)",
			"arrayExists(x -> x.class_name ilike ?, unique_exceptions)",
			"arrayExists(x -> x.method_name ilike ?, unique_exceptions)",
			"arrayExists(x -> x.type ilike ?, unique_anrs)",
			"arrayExists(x -> x.message ilike ?, unique_anrs)",
			"arrayExists(x -> x.file_name ilike ?, unique_anrs)",
			"arrayExists(x -> x.class_name ilike ?, unique_anrs)",
			"arrayExists(x -> x.method_name ilike ?, unique_anrs)",
			"arrayExists(x -> x.1 ilike ?, unique_click_targets)",
			"arrayExists(x -> x.2 ilike ?, unique_click_targets)",
			"arrayExists(x -> x.1 ilike ?, unique_longclick_targets)",
			"arrayExists(x -> x.2 ilike ?, unique_longclick_targets)",
			"arrayExists(x -> x.1 ilike ?, unique_scroll_targets)",
			"arrayExists(x -> x.2 ilike ?, unique_scroll_targets)",
		}

		extracts := []string{
			// extract user ids
			"if(toBool(user_id ilike ?), printf('User Id: %s', toString(user_id)), '')",

			// extract event types
			"if(notEmpty(arrayFirst(x -> x ilike ?, unique_types) as type), printf('Type: %s', type), '')",

			// extract log strings
			"if(notEmpty(arrayFirst(x -> x ilike ?, unique_strings) as logstring), printf('Log: %s', logstring), '')",

			// extract view(android activity) class names
			"if(notEmpty(arrayFirst(x -> x ilike ?, unique_view_classnames) as vclass), printf('View: %s', vclass), '')",

			// extract subview(android fragment) class names
			"if(notEmpty(arrayFirst(x -> x ilike ?, unique_subview_classnames) as subvclass), printf('SubView: %s', subvclass), '')",

			// extract crash types
			"if(notEmpty(arrayFirst(x -> x.type ilike ?, unique_exceptions).type as crash_type), printf('CrashType: %s', crash_type), '')",

			// extract crash messages
			"if(notEmpty(arrayFirst(x -> x.message ilike ?, unique_exceptions).message as crash_msg), printf('CrashMessage: %s', crash_msg), '')",

			// extract crash file names
			"if(notEmpty(arrayFirst(x -> x.file_name ilike ?, unique_exceptions).file_name as crash_file), printf('CrashFilename: %s', crash_file), '')",

			// extract crash class names
			"if(notEmpty(arrayFirst(x -> x.class_name ilike ?, unique_exceptions).class_name as crash_class), printf('CrashClass: %s', crash_class), '')",

			// extract crash method names
			"if(notEmpty(arrayFirst(x -> x.method_name ilike ?, unique_exceptions).method_name as crash_method), printf('CrashMethod: %s', crash_method), '')",

			// extract ANR types
			"if(notEmpty(arrayFirst(x -> x.type ilike ?, unique_anrs).type as anr_type), printf('ANRType: %s', anr_type), '')",

			// extract ANR messages
			"if(notEmpty(arrayFirst(x -> x.message ilike ?, unique_anrs).message as anr_msg), printf('ANRMessage: %s', anr_msg), '')",

			// extract ANR file names
			"if(notEmpty(arrayFirst(x -> x.file_name ilike ?, unique_anrs).file_name as anr_file), printf('ANRFilename: %s', anr_file), '')",

			// extract ANR class names
			"if(notEmpty(arrayFirst(x -> x.class_name ilike ?, unique_anrs).class_name as anr_class), printf('ANRClass: %s', anr_class), '')",

			// extract ANR method names
			"if(notEmpty(arrayFirst(x -> x.method_name ilike ?, unique_anrs).method_name as anr_method), format('ANRMethod: %s', anr_method), '')",

			// extract gesture click targets
			"if(notEmpty(arrayFirst(x -> x.1 ilike ?, unique_click_targets).1 as click_target), printf('ClickTarget: %s', click_target), '')",

			// extract gesture click target ids
			"if(notEmpty(arrayFirst(x -> x.2 ilike ?, unique_click_targets).2 as click_target_id), printf('ClickTargetId: %s', click_target_id), '')",

			// extract gesture long click targets
			"if(notEmpty(arrayFirst(x -> x.1 ilike ?, unique_longclick_targets).1 as longclick_target), printf('LongClickTarget: %s', longclick_target), '')",

			// extract gesture long click target ids
			"if(notEmpty(arrayFirst(x -> x.2 ilike ?, unique_longclick_targets).2 as longclick_target_id), printf('LongClickTargetId: %s', longclick_target_id), '')",

			// extract gesture scroll targets
			"if(notEmpty(arrayFirst(x -> x.1 ilike ?, unique_scroll_targets).1 as scroll_target), printf('ScrollTarget: %s', scroll_target), '')",

			// extract gesture scroll target ids
			"if(notEmpty(arrayFirst(x -> x.2 ilike ?, unique_scroll_targets).2 as scroll_target_id), printf('ScrollTargetId: %s', scroll_target_id), '')",
		}

		// automatically inject arguments
		argsExtract := []any{}
		for i := 0; i < len(extracts); i++ {
			argsExtract = append(argsExtract, freeText)
		}

		argsMatch := []any{}
		for i := 0; i < len(matches); i++ {
			argsMatch = append(argsMatch, freeText)
		}

		// run complex matched text extraction
		substmt.Select(fmt.Sprintf("concatWithSeparator(' ', %s) as matched_free_text", strings.Join(extracts, ",")), argsExtract...)
		substmt.GroupBy("unique_types")
		substmt.GroupBy("unique_strings")
		substmt.GroupBy("user_id")
		substmt.GroupBy("unique_view_classnames")
		substmt.GroupBy("unique_subview_classnames")
		substmt.GroupBy("unique_exceptions")
		substmt.GroupBy("unique_anrs")
		substmt.GroupBy("unique_click_targets")
		substmt.GroupBy("unique_longclick_targets")
		substmt.GroupBy("unique_scroll_targets")

		// run complex text matching with multiple 'OR's
		substmt.Where(strings.Join(matches, " or "), argsMatch...)
	}

	applyGroupBy := af.Crash ||
		af.ANR ||
		af.HasCountries() ||
		af.HasNetworkProviders() ||
		af.HasNetworkTypes() ||
		af.HasNetworkGenerations() ||
		af.HasDeviceLocales() ||
		af.HasDeviceManufacturers() ||
		af.HasDeviceNames()

	if applyGroupBy {
		substmt.GroupBy("session_id")
		substmt.GroupBy("app_version")
		substmt.GroupBy("os_version")
		substmt.GroupBy("device_name")
		substmt.GroupBy("device_model")
		substmt.GroupBy("device_manufacturer")
		substmt.GroupBy("first_event_timestamp")
		substmt.GroupBy("last_event_timestamp")
		substmt.GroupBy("user_id")
	}

	stmt := sqlf.New("with ? as page_size, ? as last_timestamp, ? as last_id select", pageSize, keyTimestamp, af.KeyID)

	if af.HasKeyset() {
		substmt = substmt.Where(fmt.Sprintf("(toDateTime64(first_event_timestamp, 3) %s last_timestamp) or (toDateTime64(first_event_timestamp, 3) = last_timestamp and session_id %s toUUID(last_id))", operator, operator))
	}

	stmt = stmt.
		Select("distinct session_id").
		Select("tupleElement(app_version, 1)").
		Select("tupleElement(app_version, 2)").
		Select("user_id").
		Select("device_name").
		Select("device_model").
		Select("device_manufacturer").
		Select("tupleElement(os_version, 1)").
		Select("tupleElement(os_version, 2)").
		Select("first_event_timestamp").
		Select("last_event_timestamp").
		From("").
		SubQuery("(", ") as t", substmt).
		Where("row_num <= abs(page_size)").
		OrderBy(fmt.Sprintf("first_event_timestamp %s, session_id %s", order, order)).
		GroupBy("t.session_id, t.app_version, t.os_version, t.device_name, t.device_manufacturer, t.device_model, t.first_event_timestamp, t.last_event_timestamp, t.user_id")

	defer stmt.Close()

	if af.FreeText != "" {
		stmt.Select("matched_free_text")
		stmt.GroupBy("t.matched_free_text")
	}

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var session SessionDisplay
		session.Session = new(Session)
		session.Attribute = new(event.Attribute)
		session.AppID = af.AppID

		dest := []any{
			&session.SessionID,
			&session.Attribute.AppVersion,
			&session.Attribute.AppBuild,
			&session.Attribute.UserID,
			&session.Attribute.DeviceName,
			&session.Attribute.DeviceModel,
			&session.Attribute.DeviceManufacturer,
			&session.Attribute.OSName,
			&session.Attribute.OSVersion,
			&session.FirstEventTime,
			&session.LastEventTime,
		}

		if af.FreeText != "" {
			dest = append(dest, &session.MatchedFreeText)
		}

		if err = rows.Scan(dest...); err != nil {
			return
		}

		// set duration
		session.Duration = time.Duration(session.LastEventTime.Sub(*session.FirstEventTime).Milliseconds())

		// trim matched free text
		// session.MatchedFreeText = strings.Trim(session.MatchedFreeText, " ")

		sessions = append(sessions, session)
	}

	err = rows.Err()

	resultLen := len(sessions)

	// set pagination meta
	if af.HasKeyset() {
		if resultLen >= numeric.AbsInt(pageSize) {
			next = true
			previous = true
		} else {
			if forward {
				previous = true
			} else {
				next = true
			}
		}
	} else {
		// first record always
		if resultLen >= numeric.AbsInt(pageSize) {
			next = true
		}
	}

	// truncate results
	if resultLen >= numeric.AbsInt(pageSize) {
		sessions = sessions[:resultLen-1]
	}

	// reverse list to respect client's ordering view
	if !forward {
		for i, j := 0, len(sessions)-1; i < j; i, j = i+1, j-1 {
			sessions[i], sessions[j] = sessions[j], sessions[i]
		}
	}

	return
}
