package measure

import (
	"context"
	"encoding/json"
	"measure-backend/measure-go/chrono"
	"measure-backend/measure-go/server"
	"slices"
	"strconv"
	"time"

	"github.com/go-dedup/simhash"
	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

// MatchingHammingDistance is the minimum hamming
// distance above which two similar exceptions or
// ANRs are considered unique.
var MinHammingDistance = 3

type ExceptionGroup struct {
	ID              uuid.UUID        `json:"id" db:"id"`
	AppID           uuid.UUID        `json:"app_id" db:"app_id"`
	AppVersion      string           `json:"app_version" db:"app_version"`
	Name            string           `json:"name" db:"name"`
	Fingerprint     string           `json:"fingerprint" db:"fingerprint"`
	Count           int              `json:"count" db:"count"`
	Events          []uuid.UUID      `json:"events" db:"events"`
	EventExceptions []EventException `json:"exception_events"`
	Percentage      float32          `json:"percentage_contribution"`
	CreatedAt       chrono.ISOTime   `json:"created_at" db:"created_at"`
	UpdatedAt       chrono.ISOTime   `json:"updated_at" db:"updated_at"`
}

type ANRGroup struct {
	ID          uuid.UUID   `json:"id" db:"id"`
	AppID       uuid.UUID   `json:"app_id" db:"app_id"`
	AppVersion  string      `json:"app_version" db:"app_version"`
	Name        string      `json:"name" db:"name"`
	Fingerprint string      `json:"fingerprint" db:"fingerprint"`
	Count       int         `json:"count" db:"count"`
	Events      []uuid.UUID `json:"events" db:"events"`
	Percentage  float32     `json:"percentage_contribution"`
	CreatedAt   time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at" db:"updated_at"`
}

type Grouper interface {
	Bucket(session Session) error
	GetGroup(fingerprint uint64) ExceptionGroup
}

// EventExists checks if the given event id exists in
// the ExceptionGroup's events array.
func (e ExceptionGroup) EventExists(id uuid.UUID) bool {
	return slices.ContainsFunc(e.Events, func(eventId uuid.UUID) bool {
		return eventId.String() == id.String()
	})
}

// EventExists checks if the given event id exists in
// the ANRGroup's events array.
func (a ANRGroup) EventExists(id uuid.UUID) bool {
	return slices.ContainsFunc(a.Events, func(eventId uuid.UUID) bool {
		return eventId.String() == id.String()
	})
}

// AppendEventId appends a new event id to the ExceptionGroup's
// events array.
func (e ExceptionGroup) AppendEventId(id uuid.UUID) error {
	stmt := sqlf.PostgreSQL.Update("public.unhandled_exception_groups").
		SetExpr("events", "array_append(events, ?)", nil).
		Set("count", nil).
		Set("updated_at", nil).
		Where("id = ?", nil)

	defer stmt.Close()
	_, err := server.Server.PgPool.Exec(context.Background(), stmt.String(), id, e.Count+1, time.Now(), e.ID)
	if err != nil {
		return err
	}

	return nil
}

// AppendEventId appends a new event id to the ANRGroup's
// events array.
func (a ANRGroup) AppendEventId(id uuid.UUID) error {
	stmt := sqlf.PostgreSQL.Update("public.anr_groups").
		SetExpr("events", "array_append(events, ?)", nil).
		Set("count", nil).
		Set("updated_at", nil)

	defer stmt.Close()
	_, err := server.Server.PgPool.Exec(context.Background(), stmt.String(), id, a.Count+1, time.Now())
	if err != nil {
		return err
	}

	return nil
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
	stmt := sqlf.PostgreSQL.Select("name, fingerprint, count, events, created_at, updated_at").
		From("public.unhandled_exception_groups").
		Where("id = ? and app_id = ?", nil, nil)
	defer stmt.Close()

	return server.Server.PgPool.QueryRow(context.Background(), stmt.String(), eg.ID, eg.AppID).Scan(&eg.Name, &eg.Fingerprint, &eg.Count, &eg.Events, &eg.CreatedAt, &eg.UpdatedAt)
}

func GetExceptionsWithFilter(eventIds []uuid.UUID, af *AppFilter) ([]EventException, error) {
	stmt := sqlf.Select("id, type, timestamp, thread_name, resource.device_name, resource.device_model, resource.device_manufacturer, resource.device_type, resource.device_is_foldable, resource.device_is_physical, resource.device_density_dpi, resource.device_width_px, resource.device_height_px, resource.device_density, resource.device_locale, resource.os_name, resource.os_version, resource.platform, resource.app_version, resource.app_build, resource.app_unique_id, resource.measure_sdk_version, resource.network_type, resource.network_generation, resource.network_provider, exception.thread_name, exception.handled, exception.network_type, exception.network_generation, exception.network_provider, exception.device_locale, exception.fingerprint, exception.exceptions, exception.threads, attributes").
		From("default.events").
		Where("id in (?)")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(context.Background(), stmt.String(), eventIds)
	if err != nil {
		return nil, err
	}

	var events []EventException

	var exceptions string
	var threads string

	for rows.Next() {
		var e EventException
		fields := []any{
			&e.ID,
			&e.Type,
			&e.Timestamp,
			&e.ThreadName,
			&e.Resource.DeviceName,
			&e.Resource.DeviceModel,
			&e.Resource.DeviceManufacturer,
			&e.Resource.DeviceType,
			&e.Resource.DeviceIsFoldable,
			&e.Resource.DeviceIsPhysical,
			&e.Resource.DeviceDensityDPI,
			&e.Resource.DeviceWidthPX,
			&e.Resource.DeviceHeightPX,
			&e.Resource.DeviceDensity,
			&e.Resource.DeviceLocale,
			&e.Resource.OSName,
			&e.Resource.OSVersion,
			&e.Resource.Platform,
			&e.Resource.AppVersion,
			&e.Resource.AppBuild,
			&e.Resource.AppUniqueID,
			&e.Resource.MeasureSDKVersion,
			&e.Resource.NetworkType,
			&e.Resource.NetworkGeneration,
			&e.Resource.NetworkProvider,
			&e.Exception.ThreadName,
			&e.Exception.Handled,
			&e.Exception.NetworkType,
			&e.Exception.NetworkGeneration,
			&e.Exception.NetworkProvider,
			&e.Exception.DeviceLocale,
			&e.Exception.Fingerprint,
			&exceptions,
			&threads,
			&e.Attributes,
		}

		if err := rows.Scan(fields...); err != nil {
			return nil, err
		}

		e.Trim()
		if err := json.Unmarshal([]byte(exceptions), &e.Exception.Exceptions); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(threads), &e.Exception.Threads); err != nil {
			return nil, err
		}

		e.ComputeView()

		events = append(events, e)
	}

	return events, nil
}

// GetANRGroup gets the ANRGroup by matching
// ANRGroup id and app id.
func GetANRGroup(ag *ANRGroup) error {
	stmt := sqlf.PostgreSQL.Select("name, fingerprint, count, events, created_at, updated_at").
		From("public.anr_groups").
		Where("id = ? and app_id = ?", nil, nil)
	defer stmt.Close()

	return server.Server.PgPool.QueryRow(context.Background(), stmt.String(), ag.ID, ag.AppID).Scan(&ag.Name, &ag.Fingerprint, &ag.Count, &ag.Events, &ag.CreatedAt, &ag.UpdatedAt)
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

func ComputeCrashContribution(groups []ExceptionGroup) {
	total := 0

	for _, group := range groups {
		total = total + group.Count
	}

	for i := range groups {
		groups[i].Percentage = (float32(groups[i].Count) / float32(total)) * 100
	}
}

func ComputeANRContribution(groups []ANRGroup) {
	total := 0

	for _, group := range groups {
		total = total + group.Count
	}

	for i := range groups {
		groups[i].Percentage = (float32(groups[i].Count) / float32(total)) * 100
	}
}

// Insert inserts a new ExceptionGroup into the database
func (e *ExceptionGroup) Insert() error {
	stmt := sqlf.PostgreSQL.InsertInto("public.unhandled_exception_groups").
		Set("app_id", nil).
		Set("app_version", nil).
		Set("name", nil).
		Set("fingerprint", nil).
		Set("count", nil).
		Set("events", nil)

	defer stmt.Close()

	_, err := server.Server.PgPool.Exec(context.Background(), stmt.String(), e.AppID, e.AppVersion, e.Name, e.Fingerprint, e.Count, e.Events)
	if err != nil {
		return err
	}

	return nil
}

// Insert inserts a new ANRGroup into the database
func (e *ANRGroup) Insert() error {
	stmt := sqlf.PostgreSQL.InsertInto("public.anr_groups").
		Set("app_id", nil).
		Set("app_version", nil).
		Set("name", nil).
		Set("fingerprint", nil).
		Set("count", nil).
		Set("events", nil)

	defer stmt.Close()

	_, err := server.Server.PgPool.Exec(context.Background(), stmt.String(), e.AppID, e.AppVersion, e.Name, e.Fingerprint, e.Count, e.Events)
	if err != nil {
		return err
	}

	return nil
}

// NewExceptionGroup constructs a new ExceptionGroup and returns a pointer to it
func NewExceptionGroup(appId uuid.UUID, version string, name string, fingerprint string, eventIds []uuid.UUID) *ExceptionGroup {
	return &ExceptionGroup{
		AppID:       appId,
		AppVersion:  version,
		Name:        name,
		Fingerprint: fingerprint,
		Count:       len(eventIds),
		Events:      eventIds,
	}
}

// NewANRGroup constructs a new ANRGroup and returns a pointer to it
func NewANRGroup(appId uuid.UUID, version string, name string, fingerprint string, eventIds []uuid.UUID) *ANRGroup {
	return &ANRGroup{
		AppID:       appId,
		AppVersion:  version,
		Name:        name,
		Fingerprint: fingerprint,
		Count:       len(eventIds),
		Events:      eventIds,
	}
}
