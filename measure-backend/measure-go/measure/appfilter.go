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
	AppID               uuid.UUID
	From                time.Time `form:"from" time_format:"2006-01-02T15:04:05.000Z" time_utc:"1"`
	To                  time.Time `form:"to" time_format:"2006-01-02T15:04:05.000Z" time_utc:"1"`
	Versions            []string  `form:"versions"`
	VersionCodes        []string  `form:"version_codes"`
	Countries           []string  `form:"countries"`
	DeviceNames         []string  `form:"device_names"`
	DeviceManufacturers []string  `form:"device_manufacturers"`
	Locales             []string  `form:"locales"`
	NetworkProviders    []string  `form:"network_providers"`
	NetworkGenerations  []string  `form:"network_generations"`
	NetworkTypes        []string  `form:"network_types"`
	Exception           bool      `form:"exception"`
	Crash               bool      `form:"crash"`
	ANR                 bool      `form:"anr"`
	KeyID               string    `form:"key_id"`
	KeyTimestamp        time.Time `form:"key_timestamp"`
	Limit               int       `form:"limit"`
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
func (af *AppFilter) getGenericFilters(fl *FilterList) error {
	if err := af.getAppVersions(fl); err != nil {
		return err
	}

	if err := af.getCountries(fl); err != nil {
		return err
	}

	if err := af.getNetworkProviders(fl); err != nil {
		return err
	}

	if err := af.getNetworkTypes(fl); err != nil {
		return err
	}

	if err := af.getNetworkGenerations(fl); err != nil {
		return err
	}

	if err := af.getDeviceLocales(fl); err != nil {
		return err
	}

	if err := af.getDeviceManufacturers(fl); err != nil {
		return err
	}

	if err := af.getDeviceNames(fl); err != nil {
		return err
	}

	return nil
}

// getAppVersions finds distinct pairs of app versions &
// app build no from available events.
//
// Additionally, filters for `exception` and `anr` event
// types.
func (af *AppFilter) getAppVersions(fl *FilterList) error {
	stmt := sqlf.Select("distinct toString(resource.app_version), toString(resource.app_build)").
		From("events").
		Where("app_id = toUUID(?)").
		OrderBy("resource.app_version desc", "resource.app_build desc")

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

	rows, err := server.Server.ChPool.Query(context.Background(), stmt.String(), af.AppID)
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
func (af *AppFilter) getCountries(fl *FilterList) error {
	stmt := sqlf.Select("distinct toString(inet.country_code)").
		From("events").
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

	rows, err := server.Server.ChPool.Query(context.Background(), stmt.String(), af.AppID)
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
func (af *AppFilter) getNetworkProviders(fl *FilterList) error {
	stmt := sqlf.Select("distinct toString(resource.network_provider)").
		From("events").
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

	rows, err := server.Server.ChPool.Query(context.Background(), stmt.String(), af.AppID)
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
func (af *AppFilter) getNetworkTypes(fl *FilterList) error {
	stmt := sqlf.Select("distinct toString(resource.network_type)").
		From("events").
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

	rows, err := server.Server.ChPool.Query(context.Background(), stmt.String(), af.AppID)
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
func (af *AppFilter) getNetworkGenerations(fl *FilterList) error {
	stmt := sqlf.Select("distinct toString(resource.network_generation)").
		From("events").
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

	rows, err := server.Server.ChPool.Query(context.Background(), stmt.String(), af.AppID)
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
func (af *AppFilter) getDeviceLocales(fl *FilterList) error {
	stmt := sqlf.Select("distinct toString(resource.device_locale)").
		From("events").
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

	rows, err := server.Server.ChPool.Query(context.Background(), stmt.String(), af.AppID)
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
func (af *AppFilter) getDeviceManufacturers(fl *FilterList) error {
	stmt := sqlf.Select("distinct toString(resource.device_manufacturer)").
		From("events").
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

	rows, err := server.Server.ChPool.Query(context.Background(), stmt.String(), af.AppID)
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
func (af *AppFilter) getDeviceNames(fl *FilterList) error {
	stmt := sqlf.Select("distinct toString(resource.device_name)").
		From("events").
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

	rows, err := server.Server.ChPool.Query(context.Background(), stmt.String(), af.AppID)
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
