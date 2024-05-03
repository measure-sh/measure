package measure

import (
	"context"
	"encoding/json"
	"measure-backend/measure-go/chrono"
	"measure-backend/measure-go/event"
	"measure-backend/measure-go/server"
	"slices"
	"sort"
	"strconv"
	"time"

	"github.com/go-dedup/simhash"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
)

// MatchingHammingDistance is the minimum hamming
// distance above which two similar exceptions or
// ANRs are considered unique.
var MinHammingDistance = 3

type GroupID interface {
	GetID() uuid.UUID
}

type ExceptionGroup struct {
	ID              uuid.UUID              `json:"id" db:"id"`
	AppID           uuid.UUID              `json:"app_id" db:"app_id"`
	Name            string                 `json:"name" db:"name"`
	Fingerprint     string                 `json:"fingerprint" db:"fingerprint"`
	Count           int                    `json:"count" db:"count"`
	EventIDs        []uuid.UUID            `json:"event_ids,omitempty" db:"event_ids"`
	EventExceptions []event.EventException `json:"exception_events,omitempty"`
	Percentage      float32                `json:"percentage_contribution"`
	CreatedAt       chrono.ISOTime         `json:"created_at" db:"created_at"`
	UpdatedAt       chrono.ISOTime         `json:"updated_at" db:"updated_at"`
}

type ANRGroup struct {
	ID          uuid.UUID        `json:"id" db:"id"`
	AppID       uuid.UUID        `json:"app_id" db:"app_id"`
	Name        string           `json:"name" db:"name"`
	Fingerprint string           `json:"fingerprint" db:"fingerprint"`
	Count       int              `json:"count" db:"count"`
	EventIDs    []uuid.UUID      `json:"event_ids,omitempty" db:"event_ids"`
	EventANRs   []event.EventANR `json:"anr_events,omitempty"`
	Percentage  float32          `json:"percentage_contribution"`
	CreatedAt   chrono.ISOTime   `json:"created_at" db:"created_at"`
	UpdatedAt   chrono.ISOTime   `json:"updated_at" db:"updated_at"`
}

type Grouper interface {
	Bucket(session Session) error
	GetGroup(fingerprint uint64) ExceptionGroup
}

func (e ExceptionGroup) GetID() uuid.UUID {
	return e.ID
}

func (a ANRGroup) GetID() uuid.UUID {
	return a.ID
}

// EventExists checks if the given event id exists in
// the ExceptionGroup's events array.
func (e ExceptionGroup) EventExists(id uuid.UUID) bool {
	return slices.ContainsFunc(e.EventIDs, func(eventId uuid.UUID) bool {
		return eventId.String() == id.String()
	})
}

// EventExists checks if the given event id exists in
// the ANRGroup's events array.
func (a ANRGroup) EventExists(id uuid.UUID) bool {
	return slices.ContainsFunc(a.EventIDs, func(eventId uuid.UUID) bool {
		return eventId.String() == id.String()
	})
}

// AppendEventId appends a new event id to the ExceptionGroup's
// events array.
func (e ExceptionGroup) AppendEventId(ctx context.Context, id uuid.UUID, tx *pgx.Tx) (err error) {
	stmt := sqlf.PostgreSQL.
		Update("public.unhandled_exception_groups").
		SetExpr("event_ids", "array_append(event_ids, ?)", id).
		Set("updated_at", time.Now()).
		Where("id = ?", e.ID)

	defer stmt.Close()

	if tx != nil {
		_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)
		return
	}

	_, err = server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)

	return
}

// AppendEventId appends a new event id to the ANRGroup's
// events array.
func (a ANRGroup) AppendEventId(ctx context.Context, id uuid.UUID, tx *pgx.Tx) (err error) {
	stmt := sqlf.PostgreSQL.
		Update("public.anr_groups").
		SetExpr("event_ids", "array_append(event_ids, ?)", id).
		Set("updated_at", time.Now()).
		Where("id = ?", a.ID)

	defer stmt.Close()

	if tx != nil {
		_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)
		return
	}

	_, err = server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)

	return
}

// HammingDistance calculates the hamming distance between the
// exception's fingerprint with any arbitrary fingerprint
// represented as a 64 bit unsigned integer returning
// the distance.
func (e ExceptionGroup) HammingDistance(a uint64) (uint8, error) {
	b, err := strconv.ParseUint(e.Fingerprint, 16, 64)
	if err != nil {
		return 0, err
	}

	return simhash.Compare(a, b), nil
}

// HammingDistance calculates the hamming distance between the
// anr's fingerprint with any arbitrary fingerprint
// represented as a 64 bit unsigned integer returning
// the distance.
func (anr ANRGroup) HammingDistance(a uint64) (uint8, error) {
	b, err := strconv.ParseUint(anr.Fingerprint, 16, 64)
	if err != nil {
		return 0, err
	}

	return simhash.Compare(a, b), nil
}

// GetExceptionGroup gets the ExceptionGroup by matching
// ExceptionGroup id and app id.
func GetExceptionGroup(eg *ExceptionGroup) error {
	stmt := sqlf.PostgreSQL.Select("name, fingerprint, event_ids, created_at, updated_at").
		From("public.unhandled_exception_groups").
		Where("id = ? and app_id = ?", nil, nil)
	defer stmt.Close()

	return server.Server.PgPool.QueryRow(context.Background(), stmt.String(), eg.ID, eg.AppID).Scan(&eg.Name, &eg.Fingerprint, &eg.EventIDs, &eg.CreatedAt, &eg.UpdatedAt)
}

// GetExceptionsWithFilter returns a slice of EventException for the given slice of
// event id and matching AppFilter. Also computes the next, previous pagination meta
// values.
func GetExceptionsWithFilter(ctx context.Context, eventIds []uuid.UUID, af *AppFilter) (events []event.EventException, next bool, previous bool, err error) {
	var edgecount int
	var countStmt *sqlf.Stmt
	var exceptions string
	var threads string
	limit := af.extendLimit()
	forward := af.hasPositiveLimit()
	next = false
	previous = false
	timeformat := "2006-01-02T15:04:05.000"
	abs := af.limitAbs()
	op := "<"
	if !forward {
		op = ">"
	}

	if !af.hasKeyset() && !forward {
		next = true
		return
	}

	if af.hasKeyset() {
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

		if af.hasTimeRange() {
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

	if af.hasTimeRange() {
		stmt.Where("`timestamp` >= ? and `timestamp` <= ?", nil, nil)
		args = append(args, af.From, af.To)
	}

	if af.hasKeyset() {
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

		e.ComputeView()
		events = append(events, e)
	}

	length := len(events)

	if forward {
		if length > abs {
			next = true
			events = events[:length-1]
		}
		if edgecount > -1 && af.hasKeyset() {
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

// GetANRsWithFilter returns a slice of EventANR for the given slice of
// event id and matching AppFilter.
func GetANRsWithFilter(ctx context.Context, eventIds []uuid.UUID, af *AppFilter) (events []event.EventANR, next bool, previous bool, err error) {
	var edgecount int
	var countStmt *sqlf.Stmt
	var exceptions string
	var threads string
	limit := af.extendLimit()
	forward := af.hasPositiveLimit()
	next = false
	previous = false
	timeformat := "2006-01-02T15:04:05.000"
	abs := af.limitAbs()
	op := "<"
	if !forward {
		op = ">"
	}

	if !af.hasKeyset() && !forward {
		next = true
		return
	}

	if af.hasKeyset() {
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

		if af.hasTimeRange() {
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

	if af.hasTimeRange() {
		stmt.Where("`timestamp` >= ? and `timestamp` <= ?", nil, nil)
		args = append(args, af.From, af.To)
	}

	if af.hasKeyset() {
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

		e.ComputeView()
		events = append(events, e)
	}

	length := len(events)

	if forward {
		if length > abs {
			next = true
			events = events[:length-1]
		}
		if edgecount > -1 && af.hasKeyset() {
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

// GetEventIdsWithFilter gets the event ids matching event ids and optionally
// applies matching AppFilter.
func GetEventIdsMatchingFilter(ctx context.Context, eventIds []uuid.UUID, af *AppFilter) ([]uuid.UUID, error) {
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

// GetANRGroup gets the ANRGroup by matching
// ANRGroup id and app id.
func GetANRGroup(ag *ANRGroup) error {
	stmt := sqlf.PostgreSQL.Select("name, fingerprint, event_ids, created_at, updated_at").
		From("public.anr_groups").
		Where("id = ? and app_id = ?", nil, nil)
	defer stmt.Close()

	return server.Server.PgPool.QueryRow(context.Background(), stmt.String(), ag.ID, ag.AppID).Scan(&ag.Name, &ag.Fingerprint, &ag.EventIDs, &ag.CreatedAt, &ag.UpdatedAt)
}

// ClosestExceptionGroup finds the index of the ExceptionGroup closest to
// an arbitrary fingerprint from a slice of ExceptionGroup.
func ClosestExceptionGroup(groups []ExceptionGroup, fingerprint uint64) (int, error) {
	lowest := -1
	var min uint8 = uint8(MinHammingDistance)
	for index, group := range groups {
		distance, err := group.HammingDistance(fingerprint)
		if err != nil {
			return 0, err
		}

		if distance <= min {
			min = distance
			lowest = index
		}
	}

	return lowest, nil
}

// ClosestANRGroup finds the index of the ANRGroup closest to
// an arbitrary fingerprint from a slice of ANRGroup.
func ClosestANRGroup(groups []ANRGroup, fingerprint uint64) (int, error) {
	lowest := -1
	var min uint8 = uint8(MinHammingDistance)
	for index, group := range groups {
		distance, err := group.HammingDistance(fingerprint)
		if err != nil {
			return 0, err
		}

		if distance <= min {
			min = distance
			lowest = index
		}
	}

	return lowest, nil
}

// ComputeCrashContribution computes percentage of crash contribution from
// given slice of ExceptionGroup.
func ComputeCrashContribution(groups []ExceptionGroup) {
	total := 0

	for _, group := range groups {
		total = total + group.Count
	}

	for i := range groups {
		groups[i].Percentage = (float32(groups[i].Count) / float32(total)) * 100
	}
}

// PaginateGroups accepts slice of interface GroupID and computes and
// returns a subset slice along with pagination meta, like next and previous.
func PaginateGroups[T GroupID](groups []T, af *AppFilter) (sliced []T, next bool, previous bool) {
	sliced = groups
	next = false
	previous = false

	length := len(groups)

	// no change if slice is empty
	if length == 0 {
		return
	}

	start := 0
	for i := range groups {
		if groups[i].GetID().String() == af.KeyID {
			if af.Limit > 0 {
				start = i + 1
			} else {
				start = i
			}
			break
		}
	}

	end := start + af.Limit

	if af.Limit > 0 {
		if end > len(groups) {
			end = len(groups)
		}
		if end < len(groups) {
			next = true
		}
		if start > 0 {
			previous = true
		}
		if start >= length {
			start = 0
			end = 0
		}
		sliced = groups[start:end]
	} else if af.Limit < 0 {
		if end < 0 {
			end = 0
		}
		if end < len(groups) {
			next = true
		}
		if end > 0 {
			previous = true
		}
		sliced = groups[end:start]
	}

	return
}

// SortExceptionGroups first sorts a slice of ExceptionGroup
// with descending count and then ascending ID.
func SortExceptionGroups(groups []ExceptionGroup) {
	sort.SliceStable(groups, func(i, j int) bool {
		if groups[i].Count != groups[j].Count {
			return groups[i].Count > groups[j].Count
		}
		return groups[i].ID.String() < groups[j].ID.String()
	})
}

// SortANRGroups first sorts a slice of ANRGroup
// with descending count and then ascending ID.
func SortANRGroups(groups []ANRGroup) {
	sort.SliceStable(groups, func(i, j int) bool {
		if groups[i].Count != groups[j].Count {
			return groups[i].Count > groups[j].Count
		}
		return groups[i].ID.String() < groups[j].ID.String()
	})
}

// ComputeANRContribution computes percentage of anr contribution from
// given slice of ANRGroup.
func ComputeANRContribution(groups []ANRGroup) {
	total := 0

	for _, group := range groups {
		total = total + group.Count
	}

	for i := range groups {
		groups[i].Percentage = (float32(groups[i].Count) / float32(total)) * 100
	}
}

// Insert inserts a new ExceptionGroup into the database.
func (e *ExceptionGroup) Insert(ctx context.Context, tx *pgx.Tx) (err error) {
	id, err := uuid.NewV7()
	if err != nil {
		return
	}

	stmt := sqlf.PostgreSQL.
		InsertInto("public.unhandled_exception_groups").
		Set("id", id).
		Set("app_id", e.AppID).
		Set("name", e.Name).
		Set("fingerprint", e.Fingerprint).
		Set("event_ids", e.EventIDs)

	defer stmt.Close()

	if tx != nil {
		_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)
		return
	}

	_, err = server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)

	return
}

// Insert inserts a new ANRGroup into the database.
func (a *ANRGroup) Insert(ctx context.Context, tx *pgx.Tx) (err error) {
	id, err := uuid.NewV7()
	if err != nil {
		return err
	}

	stmt := sqlf.PostgreSQL.
		InsertInto("public.anr_groups").
		Set("id", id).
		Set("app_id", a.AppID).
		Set("name", a.Name).
		Set("fingerprint", a.Fingerprint).
		Set("event_ids", a.EventIDs)

	defer stmt.Close()

	if tx != nil {
		_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)
		return
	}

	_, err = server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)

	return
}

// NewExceptionGroup constructs a new ExceptionGroup and returns a pointer to it.
func NewExceptionGroup(appId uuid.UUID, name string, fingerprint string, eventIds []uuid.UUID) *ExceptionGroup {
	return &ExceptionGroup{
		AppID:       appId,
		Name:        name,
		Fingerprint: fingerprint,
		EventIDs:    eventIds,
	}
}

// NewANRGroup constructs a new ANRGroup and returns a pointer to it.
func NewANRGroup(appId uuid.UUID, name string, fingerprint string, eventIds []uuid.UUID) *ANRGroup {
	return &ANRGroup{
		AppID:       appId,
		Name:        name,
		Fingerprint: fingerprint,
		EventIDs:    eventIds,
	}
}
