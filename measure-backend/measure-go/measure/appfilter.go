package measure

import (
	"context"
	"fmt"
	"measure-backend/measure-go/server"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

// DefaultDuration is the default time duration used
// for all filtering oprations when an explicit
// duration is not provided.
const DefaultDuration = time.Hour * 24 * 7

// MaxPaginationLimit is the maximum limit value allowed
// for generic query operations.
const MaxPaginationLimit = 1000

// DefaultPaginationLimit is the number of items used
// as default for paginating items.
const DefaultPaginationLimit = 10

// AppFilter represents various app filtering
// operations and its parameters to query app's
// issue journey map, metrics, exceptions and
// ANRs.
type AppFilter struct {
	// these fields should be exportable
	// otherwise gin doesn't bind them
	// and fails silently

	// ID is the unique id of the app.
	AppID uuid.UUID

	// From represents the lower time bound of
	// the filter time range.
	From time.Time `form:"from" time_format:"2006-01-02T15:04:05.000Z" time_utc:"1"`

	// To represents the upper time bound of
	// the filter time range.
	To time.Time `form:"to" time_format:"2006-01-02T15:04:05.000Z" time_utc:"1"`

	// Versions is the list of version string
	// to be matched & filtered on.
	Versions []string `form:"versions"`

	// VersionCodes is the list of version code
	// to be matched & filtered on.
	VersionCodes []string `form:"version_codes"`

	// Countries is the list of country codes
	// to be matched on & filtered on.
	Countries []string `form:"countries"`

	// DeviceNames is the list of device names
	// to be matched & filtered on.
	DeviceNames []string `form:"device_names"`

	// DeviceManufacturers is the list of device
	// manufacturers to be matched & filtered on.
	DeviceManufacturers []string `form:"device_manufacturers"`

	// Locales is the list of device locales to
	// be matched & filtered on.
	Locales []string `form:"locales"`

	// NetworkProviders is the list of network
	// providers to be matched & filtered on.
	NetworkProviders []string `form:"network_providers"`

	// NetworkGenerations is the list of network
	// generations to be matched & filtered on.
	NetworkGenerations []string `form:"network_generations"`

	// NetworkTypes is the list of network types
	// to be matched & filtered on.
	NetworkTypes []string `form:"network_types"`

	// Exception indicates the filtering should
	// only consider exception events, both
	// handled & unhandled.
	Exception bool `form:"exception"`

	// Crash indicates the filtering should
	// only consider unhandled exception events.
	Crash bool `form:"crash"`

	// ANR indicates the filtering should only
	// consider ANR events.
	ANR bool `form:"anr"`

	// KeyID is the anchor point for keyset
	// pagination.
	KeyID string `form:"key_id"`

	// KeyTimestamp is the anchor point for
	// keyset pagination.
	KeyTimestamp time.Time `form:"key_timestamp"`

	// Limit is the count of matching results to
	// limit to.
	Limit int `form:"limit"`
}

// FilterList holds various filter parameter values that are
// used in filtering operations of app's issue journey map,
// metrics, exceptions and ANRs.
type FilterList struct {
	Versions            []string `json:"versions"`
	VersionCodes        []string `json:"version_codes"`
	Countries           []string `json:"countries"`
	NetworkProviders    []string `json:"network_providers"`
	NetworkTypes        []string `json:"network_types"`
	NetworkGenerations  []string `json:"network_generations"`
	DeviceLocales       []string `json:"locales"`
	DeviceManufacturers []string `json:"device_manufacturers"`
	DeviceNames         []string `json:"device_names"`
}

// validate validates each app filtering parameter and sets
// defaults for unspecified parameters. Returns error if any
// parameter is invalid or incomplete.
func (af *AppFilter) validate() error {
	// app UUID validations
	if af.AppID == uuid.Nil {
		return fmt.Errorf("app id is invalid or empty")
	}

	if af.AppID.Version().String() != "VERSION_4" {
		return fmt.Errorf("app id version is not UUID v4")
	}

	// time validations
	if af.From.IsZero() && !af.To.IsZero() {
		return fmt.Errorf("both `from` and `to` time must be set")
	}

	if af.To.IsZero() && !af.From.IsZero() {
		return fmt.Errorf("both `from` and `to` time must be set")
	}

	if af.To.Before(af.From) {
		return fmt.Errorf("`to` must be later time than `from`")
	}

	if af.From.After(time.Now().UTC()) {
		return fmt.Errorf("`from` cannot be later than now")
	}

	if af.Limit > MaxPaginationLimit {
		return fmt.Errorf("`limit` cannot be more than %d", MaxPaginationLimit)
	}

	return nil
}

// expand expands comma separated fields to slice
// of strings
func (af *AppFilter) expand() {
	if len(af.Versions) > 0 {
		versions := af.Versions[0]
		versions = strings.TrimSpace(versions)
		af.Versions = strings.Split(versions, ",")
	}

	if len(af.VersionCodes) > 0 {
		codes := af.VersionCodes[0]
		codes = strings.TrimSpace(codes)
		af.VersionCodes = strings.Split(codes, ",")
	}

	if len(af.Countries) > 0 {
		countries := af.Countries[0]
		countries = strings.TrimSpace(countries)
		af.Countries = strings.Split(countries, ",")
	}

	if len(af.DeviceNames) > 0 {
		deviceNames := af.DeviceNames[0]
		deviceNames = strings.TrimSpace(deviceNames)
		af.DeviceNames = strings.Split(deviceNames, ",")
	}

	if len(af.DeviceManufacturers) > 0 {
		deviceManufacturers := af.DeviceManufacturers[0]
		deviceManufacturers = strings.TrimSpace(deviceManufacturers)
		af.DeviceManufacturers = strings.Split(deviceManufacturers, ",")
	}

	if len(af.Locales) > 0 {
		locales := af.Locales[0]
		locales = strings.TrimSpace(locales)
		af.Locales = strings.Split(locales, ",")
	}

	if len(af.NetworkProviders) > 0 {
		networkProviders := af.NetworkProviders[0]
		networkProviders = strings.TrimSpace(networkProviders)
		af.NetworkProviders = strings.Split(networkProviders, ",")
	}

	if len(af.NetworkTypes) > 0 {
		networkTypes := af.NetworkTypes[0]
		networkTypes = strings.TrimSpace(networkTypes)
		af.NetworkTypes = strings.Split(networkTypes, ",")
	}

	if len(af.NetworkGenerations) > 0 {
		networkGenerations := af.NetworkGenerations[0]
		networkGenerations = strings.TrimSpace(networkGenerations)
		af.NetworkGenerations = strings.Split(networkGenerations, ",")
	}
}

// hasTimeRange checks if the time values are
// appropriately set.
func (af *AppFilter) hasTimeRange() bool {
	return !af.From.IsZero() && !af.To.IsZero()
}

// hasKeyID checks if key id is a valid non-empty
// value.
func (af *AppFilter) hasKeyID() bool {
	return af.KeyID != ""
}

// hasKeyTimestamp checks if key timestamp is a valid non-empty
// value.
func (af *AppFilter) hasKeyTimestamp() bool {
	return !time.Time.IsZero(af.KeyTimestamp)
}

// hasKeyset checks if key id and key timestamp
// values are present and valid.
func (af *AppFilter) hasKeyset() bool {
	return af.hasKeyID() && af.hasKeyTimestamp()
}

// hasPositiveLimit checks if limit is greater
// than zero.
func (af *AppFilter) hasPositiveLimit() bool {
	return af.Limit > 0
}

// limitAbs returns the absolute value of limit
func (af *AppFilter) limitAbs() int {
	if !af.hasPositiveLimit() {
		return -af.Limit
	}
	return af.Limit
}

func (af *AppFilter) extendLimit() int {
	if af.hasPositiveLimit() {
		return af.Limit + 1
	} else {
		limit := -af.Limit
		return limit + 1
	}
}

// setDefaultTimeRange sets the time range to last
// default duration from current UTC time
func (af *AppFilter) setDefaultTimeRange() {
	to := time.Now().UTC()
	from := to.Add(-DefaultDuration)

	af.From = from
	af.To = to
}

// getGenericFilters finds distinct values of app versions, network type,
// network provider and other such event parameters from available events
// with appropriate filters applied.
func (af *AppFilter) getGenericFilters(ctx context.Context, fl *FilterList) error {
	if err := af.getAppVersions(ctx, fl); err != nil {
		return err
	}

	if err := af.getCountries(ctx, fl); err != nil {
		return err
	}

	if err := af.getNetworkProviders(ctx, fl); err != nil {
		return err
	}

	if err := af.getNetworkTypes(ctx, fl); err != nil {
		return err
	}

	if err := af.getNetworkGenerations(ctx, fl); err != nil {
		return err
	}

	if err := af.getDeviceLocales(ctx, fl); err != nil {
		return err
	}

	if err := af.getDeviceManufacturers(ctx, fl); err != nil {
		return err
	}

	if err := af.getDeviceNames(ctx, fl); err != nil {
		return err
	}

	return nil
}

// getAppVersions finds distinct pairs of app versions &
// app build no from available events.
//
// Additionally, filters for `exception` and `anr` event
// types.
func (af *AppFilter) getAppVersions(ctx context.Context, fl *FilterList) error {
	stmt := sqlf.
		From("default.events").
		Select("distinct toString(attribute.app_version), toString(attribute.app_build)").
		Where("app_id = toUUID(?)").
		OrderBy("attribute.app_build desc")

	defer stmt.Close()

	if af.Exception {
		stmt.Where("type = 'exception'")
	}

	if af.Crash {
		stmt.Where("type = 'exception'")
		stmt.Where("`exception.handled` = false")
	}

	if af.ANR {
		stmt.Where("type = 'anr'")
	}

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), af.AppID)
	if err != nil {
		msg := `failed to query app versions`
		fmt.Println(msg, err)
		return err
	}

	for rows.Next() {
		var version string
		var code string
		if err := rows.Scan(&version, &code); err != nil {
			return err
		}
		fl.Versions = append(fl.Versions, version)
		fl.VersionCodes = append(fl.VersionCodes, code)
	}

	return rows.Err()
}

// getCountries finds distinct values of country codes
// from available events.
//
// Additionally, filters `exception` and `anr` event types.
func (af *AppFilter) getCountries(ctx context.Context, fl *FilterList) error {
	stmt := sqlf.
		From("default.events").
		Select("distinct toString(inet.country_code)").
		Where("app_id = toUUID(?)")
	defer stmt.Close()

	if af.Exception {
		stmt.Where("type = 'exception'")
	}

	if af.Crash {
		stmt.Where("type = 'exception'")
		stmt.Where("`exception.handled` = false")
	}

	if af.ANR {
		stmt.Where("type = 'anr'")
	}

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), af.AppID)
	if err != nil {
		msg := `failed to query countries from ip`
		fmt.Println(msg, err)
		return err
	}

	for rows.Next() {
		var country string
		if err := rows.Scan(&country); err != nil {
			return err
		}
		fl.Countries = append(fl.Countries, country)
	}

	return rows.Err()
}

// getNetworkProviders finds distinct values of app network
// providers from available events.
//
// Additionally, filters `exception` and `anr` event types.
func (af *AppFilter) getNetworkProviders(ctx context.Context, fl *FilterList) error {
	stmt := sqlf.
		From("default.events").
		Select("distinct toString(attribute.network_provider)").
		Where("app_id = toUUID(?)")

	defer stmt.Close()

	if af.Exception {
		stmt.Where("type = 'exception'")
	}

	if af.Crash {
		stmt.Where("type = 'exception'")
		stmt.Where("`exception.handled` = false")
	}

	if af.ANR {
		stmt.Where("type = 'anr'")
	}

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), af.AppID)
	if err != nil {
		msg := `failed to query app network providers`
		fmt.Println(msg, err)
		return err
	}

	for rows.Next() {
		var networkProvider string
		if err := rows.Scan(&networkProvider); err != nil {
			return err
		}
		if networkProvider == "" {
			continue
		}
		fl.NetworkProviders = append(fl.NetworkProviders, networkProvider)
	}

	return rows.Err()
}

// getNetworkTypes finds distinct values of app network
// types from available events.
//
// Additionally, filters `exception` and `anr` event types.
func (af *AppFilter) getNetworkTypes(ctx context.Context, fl *FilterList) error {
	stmt := sqlf.
		From("default.events").
		Select("distinct toString(attribute.network_type)").
		Where("app_id = toUUID(?)")

	defer stmt.Close()

	if af.Exception {
		stmt.Where("type = 'exception'")
	}

	if af.Crash {
		stmt.Where("type = 'exception'")
		stmt.Where("`exception.handled` = false")
	}

	if af.ANR {
		stmt.Where("type = 'anr'")
	}

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), af.AppID)
	if err != nil {
		msg := `failed to query app network types`
		fmt.Println(msg, err)
		return err
	}

	for rows.Next() {
		var networkType string
		if err := rows.Scan(&networkType); err != nil {
			return err
		}
		fl.NetworkTypes = append(fl.NetworkTypes, networkType)
	}

	return rows.Err()
}

// getNetworkGenerations finds distinct values of app network
// generations from available events.
//
// Additionally, filters `exception` and `anr` event types.
func (af *AppFilter) getNetworkGenerations(ctx context.Context, fl *FilterList) error {
	stmt := sqlf.
		From("default.events").
		Select("distinct toString(attribute.network_generation)").
		Where("app_id = toUUID(?)")

	defer stmt.Close()

	if af.Exception {
		stmt.Where("type = 'exception'")
	}

	if af.Crash {
		stmt.Where("type = 'exception'")
		stmt.Where("`exception.handled` = false")
	}

	if af.ANR {
		stmt.Where("type = 'anr'")
	}

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), af.AppID)
	if err != nil {
		msg := `failed to query app network generations`
		fmt.Println(msg, err)
		return err
	}

	for rows.Next() {
		var generation string
		if err := rows.Scan(&generation); err != nil {
			return err
		}
		if generation == "" {
			continue
		}
		fl.NetworkGenerations = append(fl.NetworkGenerations, generation)
	}

	return rows.Err()
}

// getDeviceLocales finds distinct values of app device
// locales from available events.
//
// Additionally, filters `exception` and `anr` event types.
func (af *AppFilter) getDeviceLocales(ctx context.Context, fl *FilterList) error {
	stmt := sqlf.
		From("default.events").
		Select("distinct toString(attribute.device_locale)").
		Where("app_id = toUUID(?)")

	defer stmt.Close()

	if af.Exception {
		stmt.Where("type = 'exception'")
	}

	if af.Crash {
		stmt.Where("type = 'exception'")
		stmt.Where("`exception.handled` = false")
	}

	if af.ANR {
		stmt.Where("type = 'anr'")
	}

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), af.AppID)
	if err != nil {
		msg := `failed to query app device locales`
		fmt.Println(msg, err)
		return err
	}

	for rows.Next() {
		var locale string
		if err := rows.Scan(&locale); err != nil {
			return err
		}
		fl.DeviceLocales = append(fl.DeviceLocales, locale)
	}

	return rows.Err()
}

// getDeviceManufacturers finds distinct values of app device
// manufacturers from available events.
//
// Additionally, filters `exception` and `anr` event types.
func (af *AppFilter) getDeviceManufacturers(ctx context.Context, fl *FilterList) error {
	stmt := sqlf.
		From("default.events").
		Select("distinct toString(attribute.device_manufacturer)").
		Where("app_id = toUUID(?)")

	defer stmt.Close()

	if af.Exception {
		stmt.Where("type = 'exception'")
	}

	if af.Crash {
		stmt.Where("type = 'exception'")
		stmt.Where("`exception.handled` = false")
	}

	if af.ANR {
		stmt.Where("type = 'anr'")
	}

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), af.AppID)
	if err != nil {
		msg := `failed to query app device manufacturers`
		fmt.Println(msg, err)
		return err
	}

	for rows.Next() {
		var manufacturer string
		if err := rows.Scan(&manufacturer); err != nil {
			return err
		}
		fl.DeviceManufacturers = append(fl.DeviceManufacturers, manufacturer)
	}

	return rows.Err()
}

// getDeviceNames finds distinct values of app device
// names from available events.
//
// Additionally, filters `exception` and `anr` event types.
func (af *AppFilter) getDeviceNames(ctx context.Context, fl *FilterList) error {
	stmt := sqlf.
		From("default.events").
		Select("distinct toString(attribute.device_name)").
		Where("app_id = toUUID(?)")

	defer stmt.Close()

	if af.Exception {
		stmt.Where("type = 'exception'")
	}

	if af.Crash {
		stmt.Where("type = 'exception'")
		stmt.Where("`exception.handled` = false")
	}

	if af.ANR {
		stmt.Where("type = 'anr'")
	}

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), af.AppID)
	if err != nil {
		msg := `failed to query app device names`
		fmt.Println(msg, err)
		return err
	}

	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return err
		}
		fl.DeviceNames = append(fl.DeviceNames, name)
	}

	return rows.Err()
}
