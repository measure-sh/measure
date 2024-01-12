package measure

import (
	"context"
	"fmt"
	"measure-backend/measure-go/server"
	"time"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

// DefaultDuration is the default time duration used
// for all filtering oprations when an explicit
// duration is not provided.
const DefaultDuration = time.Hour * 24 * 7

// AppFilter represents various app filtering
// operations and its parameters to query app's
// issue journey map, metrics, exceptions and
// ANRs.
type AppFilter struct {
	// these fields should be exportable
	// otherwise gin doesn't bind them
	// and fails silently
	AppID     uuid.UUID
	From      time.Time `form:"from" time_format:"2006-01-02T15:04:05.000Z" time_utc:"1"`
	To        time.Time `form:"to" time_format:"2006-01-02T15:04:05.000Z" time_utc:"1"`
	Version   string    `form:"version"`
	Exception bool      `form:"exception"`
	Crash     bool      `form:"crash"`
	ANR       bool      `form:"anr"`
}

// FilterList holds various filter parameter values that are
// used in filtering operations of app's issue journey map,
// metrics, exceptions and ANRs.
type FilterList struct {
	Versions            []string `json:"versions"`
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

	return nil
}

// hasVersion checks if the version has been
// explicitly set.
func (af *AppFilter) hasVersion() bool {
	return af.Version != ""
}

// hasTimeRange checks if the time values are
// appropriately set.
func (af *AppFilter) hasTimeRange() bool {
	return !af.From.IsZero() && !af.To.IsZero()
}

// setDefaultTimeRange sets the time range to last
// default duration from current UTC time
func (af *AppFilter) setDefaultTimeRange() {
	to := time.Now().UTC()
	from := to.Add(-DefaultDuration)

	af.From = from
	af.To = to
}

// setDefaultVersion sets the version to the
// latest app version if available
func (af *AppFilter) setDefaultVersion() {
	af.Version = "1.2.3"
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

// getEventFilters finds distinct values of app versions, network type,
// network provider and other such event parameters from a set of event
// IDs with appropriate filters applied.
func (af *AppFilter) getEventFilters(fl *FilterList, e []uuid.UUID) error {
	if err := af.getEventVersions(fl, e); err != nil {
		return err
	}

	if err := af.getEventCountries(fl, e); err != nil {
		return err
	}

	if err := af.getEventNetworkProviders(fl, e); err != nil {
		return err
	}

	if err := af.getEventNetworkTypes(fl, e); err != nil {
		return err
	}

	if err := af.getEventNetworkGenerations(fl, e); err != nil {
		return err
	}

	if err := af.getEventDeviceLocales(fl, e); err != nil {
		return err
	}

	if err := af.getEventDeviceManufacturers(fl, e); err != nil {
		return err
	}

	if err := af.getEventDeviceNames(fl, e); err != nil {
		return err
	}

	return nil
}

// getAppVersions finds distinct values of app versions from
// available events within a time range.
//
// Additionally, filters `exception` and `anr` event types.
func (af *AppFilter) getAppVersions(fl *FilterList) error {
	stmt := sqlf.Select("distinct toString(resource.app_version)").
		From("events").
		Where("app_id = toUUID(?)")

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

	defer stmt.Close()
	rows, err := server.Server.ChPool.Query(context.Background(), stmt.String(), af.AppID)
	if err != nil {
		msg := `failed to query app versions`
		fmt.Println(msg, err)
		return err
	}

	for rows.Next() {
		var version string
		if err := rows.Scan(&version); err != nil {
			return err
		}
		fl.Versions = append(fl.Versions, version)
	}

	return rows.Err()
}

// getCountries finds distinct values of country codes
// from available events within a time range.
//
// Additionally, filters `exception` and `anr` event types.
func (af *AppFilter) getCountries(fl *FilterList) error {
	stmt := sqlf.Select("distinct toString(inet.country_code)").
		From("events").
		Where("app_id = toUUID(?)")

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

	defer stmt.Close()
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
// providers from available events within a time range.
//
// Additionally, filters `exception` and `anr` event types.
func (af *AppFilter) getNetworkProviders(fl *FilterList) error {
	stmt := sqlf.Select("distinct toString(resource.network_provider)").
		From("events").
		Where("app_id = toUUID(?)")

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

	defer stmt.Close()
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
// types from available events within a time range.
//
// Additionally, filters `exception` and `anr` event types.
func (af *AppFilter) getNetworkTypes(fl *FilterList) error {
	stmt := sqlf.Select("distinct toString(resource.network_type)").
		From("events").
		Where("app_id = toUUID(?)")

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

	defer stmt.Close()
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
// generations from available events within a time range.
//
// Additionally, filters `exception` and `anr` event types.
func (af *AppFilter) getNetworkGenerations(fl *FilterList) error {
	stmt := sqlf.Select("distinct toString(resource.network_generation)").
		From("events").
		Where("app_id = toUUID(?)")

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

	defer stmt.Close()
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
// locales from available events within a time range.
//
// Additionally, filters `exception` and `anr` event types.
func (af *AppFilter) getDeviceLocales(fl *FilterList) error {
	stmt := sqlf.Select("distinct toString(resource.device_locale)").
		From("events").
		Where("app_id = toUUID(?)")

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

	defer stmt.Close()
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
// manufacturers from available events within a time range.
//
// Additionally, filters `exception` and `anr` event types.
func (af *AppFilter) getDeviceManufacturers(fl *FilterList) error {
	stmt := sqlf.Select("distinct toString(resource.device_manufacturer)").
		From("events").
		Where("app_id = toUUID(?)")

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

	defer stmt.Close()
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
// names from available events within a time range.
//
// Additionally, filters `exception` and `anr` event types.
func (af *AppFilter) getDeviceNames(fl *FilterList) error {
	stmt := sqlf.Select("distinct toString(resource.device_name)").
		From("events").
		Where("app_id = toUUID(?)")

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

	defer stmt.Close()
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

// getEventVersions finds distinct values of versions from a
// set of event IDs with appropriate filters applied.
func (af *AppFilter) getEventVersions(fl *FilterList, eventIds []uuid.UUID) error {
	stmt := sqlf.Select("distinct toString(resource.app_version)").
		From("events").
		Where("id in (?)").
		Where("app_id = toUUID(?)").
		Where("timestamp >= ? and timestamp <= ?")

	defer stmt.Close()
	rows, err := server.Server.ChPool.Query(context.Background(), stmt.String(), eventIds, af.AppID, af.From, af.To)
	if err != nil {
		msg := `failed to query event versions`
		fmt.Println(msg, err)
		return err
	}

	for rows.Next() {
		var version string
		if err := rows.Scan(&version); err != nil {
			return err
		}
		fl.Versions = append(fl.Versions, version)
	}

	return rows.Err()
}

// getEventCountries finds distinct values of countries from a
// set of event IDs with appropriate filters applied.
func (af *AppFilter) getEventCountries(fl *FilterList, eventIds []uuid.UUID) error {
	stmt := sqlf.Select("distinct toString(inet.country_code)").
		From("events").
		Where("id in (?)").
		Where("app_id = toUUID(?)").
		Where("timestamp >= ? and timestamp <= ?")

	defer stmt.Close()
	rows, err := server.Server.ChPool.Query(context.Background(), stmt.String(), eventIds, af.AppID, af.From, af.To)
	if err != nil {
		msg := `failed to query event countries`
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

// getEventNetworkProviders finds distinct values of network providers
// from a set of event IDs with appropriate filters applied.
func (af *AppFilter) getEventNetworkProviders(fl *FilterList, eventIds []uuid.UUID) error {
	stmt := sqlf.Select("distinct toString(resource.network_provider)").
		From("events").
		Where("id in (?)").
		Where("app_id = toUUID(?)").
		Where("timestamp >= ? and timestamp <= ?")

	defer stmt.Close()
	rows, err := server.Server.ChPool.Query(context.Background(), stmt.String(), eventIds, af.AppID, af.From, af.To)
	if err != nil {
		msg := `failed to query event network providers`
		fmt.Println(msg, err)
		return err
	}

	for rows.Next() {
		var network_provider string
		if err := rows.Scan(&network_provider); err != nil {
			return err
		}
		fl.NetworkProviders = append(fl.NetworkProviders, network_provider)
	}

	return rows.Err()
}

// getEventNetworkTypes finds distinct values of network types
// from a set of event IDs with appropriate filters applied.
func (af *AppFilter) getEventNetworkTypes(fl *FilterList, eventIds []uuid.UUID) error {
	stmt := sqlf.Select("distinct toString(resource.network_type)").
		From("events").
		Where("id in (?)").
		Where("app_id = toUUID(?)").
		Where("timestamp >= ? and timestamp <= ?")

	defer stmt.Close()
	rows, err := server.Server.ChPool.Query(context.Background(), stmt.String(), eventIds, af.AppID, af.From, af.To)
	if err != nil {
		msg := `failed to query event network types`
		fmt.Println(msg, err)
		return err
	}

	for rows.Next() {
		var network_type string
		if err := rows.Scan(&network_type); err != nil {
			return err
		}
		fl.NetworkTypes = append(fl.NetworkTypes, network_type)
	}

	return rows.Err()
}

// getEventNetworkGenerations finds distinct values of network generations
// from a set of event IDs with appropriate filters applied.
func (af *AppFilter) getEventNetworkGenerations(fl *FilterList, eventIds []uuid.UUID) error {
	stmt := sqlf.Select("distinct toString(resource.network_generation)").
		From("events").
		Where("id in (?)").
		Where("app_id = toUUID(?)").
		Where("timestamp >= ? and timestamp <= ?")

	defer stmt.Close()
	rows, err := server.Server.ChPool.Query(context.Background(), stmt.String(), eventIds, af.AppID, af.From, af.To)
	if err != nil {
		msg := `failed to query event network generations`
		fmt.Println(msg, err)
		return err
	}

	for rows.Next() {
		var network_generation string
		if err := rows.Scan(&network_generation); err != nil {
			return err
		}
		fl.NetworkGenerations = append(fl.NetworkGenerations, network_generation)
	}

	return rows.Err()
}

// getEventDeviceLocales finds distinct values of device locales
// from a set of event IDs with appropriate filters applied.
func (af *AppFilter) getEventDeviceLocales(fl *FilterList, eventIds []uuid.UUID) error {
	stmt := sqlf.Select("distinct toString(resource.device_locale)").
		From("events").
		Where("id in (?)").
		Where("app_id = toUUID(?)").
		Where("timestamp >= ? and timestamp <= ?")

	defer stmt.Close()
	rows, err := server.Server.ChPool.Query(context.Background(), stmt.String(), eventIds, af.AppID, af.From, af.To)
	if err != nil {
		msg := `failed to query event device locales`
		fmt.Println(msg, err)
		return err
	}

	for rows.Next() {
		var device_locale string
		if err := rows.Scan(&device_locale); err != nil {
			return err
		}
		fl.DeviceLocales = append(fl.DeviceLocales, device_locale)
	}

	return rows.Err()
}

// getEventDeviceManufacturers finds distinct values of device manufacturers
// from a set of event IDs with appropriate filters applied.
func (af *AppFilter) getEventDeviceManufacturers(fl *FilterList, eventIds []uuid.UUID) error {
	stmt := sqlf.Select("distinct toString(resource.device_manufacturer)").
		From("events").
		Where("id in (?)").
		Where("app_id = toUUID(?)").
		Where("timestamp >= ? and timestamp <= ?")

	defer stmt.Close()
	rows, err := server.Server.ChPool.Query(context.Background(), stmt.String(), eventIds, af.AppID, af.From, af.To)
	if err != nil {
		msg := `failed to query event device manufacturers`
		fmt.Println(msg, err)
		return err
	}

	for rows.Next() {
		var device_manufacturer string
		if err := rows.Scan(&device_manufacturer); err != nil {
			return err
		}
		fl.DeviceManufacturers = append(fl.DeviceManufacturers, device_manufacturer)
	}

	return rows.Err()
}

// getEventDeviceNames finds distinct values of device names
// from a set of event IDs with appropriate filters applied.
func (af *AppFilter) getEventDeviceNames(fl *FilterList, eventIds []uuid.UUID) error {
	stmt := sqlf.Select("distinct toString(resource.device_name)").
		From("events").
		Where("id in (?)").
		Where("app_id = toUUID(?)").
		Where("timestamp >= ? and timestamp <= ?")

	defer stmt.Close()
	rows, err := server.Server.ChPool.Query(context.Background(), stmt.String(), eventIds, af.AppID, af.From, af.To)
	if err != nil {
		msg := `failed to query event device names`
		fmt.Println(msg, err)
		return err
	}

	for rows.Next() {
		var device_name string
		if err := rows.Scan(&device_name); err != nil {
			return err
		}
		fl.DeviceNames = append(fl.DeviceNames, device_name)
	}

	return rows.Err()
}
