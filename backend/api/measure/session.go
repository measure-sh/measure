package measure

import (
	"backend/api/event"
	"backend/api/filter"
	"backend/api/server"
	"backend/api/session"
	"context"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

// Session represents a session
type Session struct {
	SessionID uuid.UUID          `json:"session_id" binding:"required"`
	AppID     uuid.UUID          `json:"app_id"`
	Attribute *event.Attribute   `json:"attribute" binding:"required"`
	Events    []event.EventField `json:"events" binding:"required"`
}

// SessionDisplay provides a convinient
// wrapper over Session for display purposes.
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

// GetSessionsInstancesPlot provides aggregated session instances
// matching various filters.
func GetSessionsInstancesPlot(ctx context.Context, af *filter.AppFilter) (sessionInstances []session.SessionInstance, err error) {
	base := sqlf.From("sessions").
		Select("session_id").
		Select("first_event_timestamp").
		Select("last_event_timestamp").
		Select("app_version").
		Clause("prewhere app_id = toUUID(?) and first_event_timestamp >= ? and last_event_timestamp <= ?", af.AppID, af.From, af.To)

	if af.Crash && af.ANR {
		base.Having("uniqMerge(crash_count) >= 1 or uniqMerge(anr_count) >= 1")
	} else if af.Crash {
		base.Having("uniqMerge(crash_count) >= 1")
	} else if af.ANR {
		base.Having("uniqMerge(anr_count) >= 1")
	}

	if af.HasVersions() {
		selectedVersions, err := af.VersionPairs()
		if err != nil {
			return nil, err
		}

		base.Where("app_version in (?)", selectedVersions.Parameterize())
	}

	if af.HasOSVersions() {
		selectedOSVersions, err := af.OSVersionPairs()
		if err != nil {
			return nil, err
		}

		base.Where("os_version in (?)", selectedOSVersions.Parameterize())
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
			"toString(session_id) like ?",
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
		base.Where(fmt.Sprintf("(%s)", strings.Join(matches, " or ")), args...)
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

// GetSessionsWithFilter provides sessions that matches various
// filter criteria in a paginated fashion.
func GetSessionsWithFilter(ctx context.Context, af *filter.AppFilter) (sessions []SessionDisplay, next, previous bool, err error) {
	stmt := sqlf.
		Select("distinct session_id").
		Select("tupleElement(app_version, 1)").
		Select("tupleElement(app_version, 2)").
		Select("user_id").
		Select("device_name").
		Select("device_model").
		Select("device_manufacturer").
		Select("tupleElement(os_version, 1)").
		Select("tupleElement(os_version, 2)").
		// avoid duplicates using window functions
		//
		// we choose the least first_event_timestamp
		// and most last_event_timestamp otherwise
		// duplicate sessions will be selected
		Select("first_value(first_event_timestamp) over (partition by session_id order by first_event_timestamp)").
		Select("last_value(last_event_timestamp) over (partition by session_id)").
		From("sessions").
		Clause("prewhere app_id = toUUID(?) and first_event_timestamp >= ? and last_event_timestamp <= ?", af.AppID, af.From, af.To).
		OrderBy("first_event_timestamp desc")

	if af.Limit > 0 {
		stmt.Limit(uint64(af.Limit) + 1)
	}

	if af.Offset >= 0 {
		stmt.Offset(uint64(af.Offset))
	}

	if af.Crash && af.ANR {
		stmt.Having("uniqMerge(crash_count) >= 1 or uniqMerge(anr_count) >= 1")
	} else if af.Crash {
		stmt.Having("uniqMerge(crash_count) >= 1")
	} else if af.ANR {
		stmt.Having("uniqMerge(anr_count) >= 1")
	}

	if af.HasVersions() {
		selectedVersions, err := af.VersionPairs()
		if err != nil {
			return sessions, next, previous, err
		}

		stmt.Where("app_version in (?)", selectedVersions.Parameterize())
	}

	if af.HasOSVersions() {
		selectedOSVersions, err := af.OSVersionPairs()
		if err != nil {
			return sessions, next, previous, err
		}

		stmt.Where("os_version in (?)", selectedOSVersions.Parameterize())
	}

	if af.HasCountries() {
		stmt.Where("country_code in ?", af.Countries)
	}

	if af.HasNetworkProviders() {
		stmt.Where("network_provider in ?", af.NetworkProviders)
	}

	if af.HasNetworkTypes() {
		stmt.Where("network_type in ?", af.NetworkTypes)
	}

	if af.HasNetworkGenerations() {
		stmt.Where("network_generation in ?", af.NetworkGenerations)
	}

	if af.HasDeviceLocales() {
		stmt.Where("device_locale in ?", af.Locales)
	}

	if af.HasDeviceManufacturers() {
		stmt.Where("device_manufacturer in ?", af.DeviceManufacturers)
	}

	if af.HasDeviceNames() {
		stmt.Where("device_name in ?", af.DeviceNames)
	}

	if af.HasUDExpression() && !af.UDExpression.Empty() {
		subQuery := sqlf.From("user_def_attrs").
			Select("distinct session_id").
			Clause("final").
			Where("app_id = toUUID(?)", af.AppID)
		af.UDExpression.Augment(subQuery)
		stmt.SubQuery("session_id in (", ")", subQuery)
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
		stmt.GroupBy("session_id")
		stmt.GroupBy("app_version")
		stmt.GroupBy("os_version")
		stmt.GroupBy("device_name")
		stmt.GroupBy("device_model")
		stmt.GroupBy("device_manufacturer")
		stmt.GroupBy("first_event_timestamp")
		stmt.GroupBy("last_event_timestamp")
		stmt.GroupBy("user_id")
	}

	defer stmt.Close()

	if af.FreeText != "" {
		freeText := fmt.Sprintf("%%%s%%", af.FreeText)

		// to add/remove items, only modify this slice
		// of query strings. rest of the query exec
		// infra is self adapting.
		matches := []string{
			"user_id like ?",
			"toString(session_id) like ?",
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

		argsMatch := []any{}
		for i := 0; i < len(matches); i++ {
			argsMatch = append(argsMatch, freeText)
		}

		stmt.Select("unique_types").
			Select("unique_strings").
			Select("unique_view_classnames").
			Select("unique_subview_classnames").
			Select("unique_exceptions").
			Select("unique_anrs").
			Select("unique_click_targets").
			Select("unique_longclick_targets").
			Select("unique_scroll_targets").
			GroupBy("unique_types").
			GroupBy("unique_strings").
			GroupBy("user_id").
			GroupBy("unique_view_classnames").
			GroupBy("unique_subview_classnames").
			GroupBy("unique_exceptions").
			GroupBy("unique_anrs").
			GroupBy("unique_click_targets").
			GroupBy("unique_longclick_targets").
			GroupBy("unique_scroll_targets")

		// run complex text matching with multiple 'OR's
		stmt.Where(fmt.Sprintf("(%s)", strings.Join(matches, " or ")), argsMatch...)
	}

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var uniqueTypes, uniqueStrings, uniqueViewClassnames, uniqueSubviewClassnames []string
		uniqueExceptions := []map[string]string{}
		uniqueANRs := []map[string]string{}
		uniqueClickTargets := []map[string]string{}
		uniqueLongclickTargets := []map[string]string{}
		uniqueScrollTargets := []map[string]string{}

		var sess SessionDisplay
		sess.Session = new(Session)
		sess.Attribute = new(event.Attribute)
		sess.AppID = af.AppID

		dest := []any{
			&sess.SessionID,
			&sess.Attribute.AppVersion,
			&sess.Attribute.AppBuild,
			&sess.Attribute.UserID,
			&sess.Attribute.DeviceName,
			&sess.Attribute.DeviceModel,
			&sess.Attribute.DeviceManufacturer,
			&sess.Attribute.OSName,
			&sess.Attribute.OSVersion,
			&sess.FirstEventTime,
			&sess.LastEventTime,
		}

		if af.FreeText != "" {
			dest = append(dest, &uniqueTypes, &uniqueStrings, &uniqueViewClassnames, &uniqueSubviewClassnames, &uniqueExceptions, &uniqueANRs, &uniqueClickTargets, &uniqueLongclickTargets, &uniqueScrollTargets)
		}

		if err = rows.Scan(dest...); err != nil {
			fmt.Println(err)
			return
		}

		if err = rows.Err(); err != nil {
			return
		}

		// set duration
		sess.Duration = time.Duration(sess.LastEventTime.Sub(*sess.FirstEventTime).Milliseconds())

		// set matched free text results
		sess.MatchedFreeText = session.ExtractMatches(af.FreeText, sess.Attribute.UserID, sess.SessionID.String(), uniqueTypes, uniqueStrings, uniqueViewClassnames, uniqueSubviewClassnames, uniqueExceptions, uniqueANRs, uniqueClickTargets, uniqueLongclickTargets, uniqueScrollTargets)

		sessions = append(sessions, sess)
	}

	err = rows.Err()

	resultLen := len(sessions)

	// Set pagination next & previous flags
	if resultLen > af.Limit {
		sessions = sessions[:resultLen-1]
		next = true
	}
	if af.Offset > 0 {
		previous = true
	}

	return
}
