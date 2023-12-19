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
	if af.To.Before(af.From) {
		return fmt.Errorf("`to` must be later time than `from`")
	}

	if af.From.After(time.Now().UTC()) {
		return fmt.Errorf("`from` cannot be later than now")
	}

	if af.From.IsZero() && !af.To.IsZero() {
		return fmt.Errorf("both `from` and `to` time must be set")
	}

	if af.To.IsZero() && !af.From.IsZero() {
		return fmt.Errorf("both `from` and `to` time must be set")
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
// within a time range.
func (af *AppFilter) getGenericFilters(fl *FilterList) error {
	if err := af.getAppVersions(fl); err != nil {
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

// getAppVersions finds distinct values of app versions from
// available events within a time range.
//
// Additionally, filters `exception` and `anr` event types.
func (af *AppFilter) getAppVersions(fl *FilterList) error {
	stmt := sqlf.Select("distinct toString(resource.app_version)").
		From("events").
		Where("app_id = toUUID(?)").
		Where("timestamp >= ? and timestamp <= ?")

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
	rows, err := server.Server.ChPool.Query(context.Background(), stmt.String(), af.AppID, af.From, af.To)
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

// getNetworkProviders finds distinct values of app network
// providers from available events within a time range.
//
// Additionally, filters `exception` and `anr` event types.
func (af *AppFilter) getNetworkProviders(fl *FilterList) error {
	stmt := sqlf.Select("distinct toString(resource.network_provider)").
		From("events").
		Where("app_id = toUUID(?)").
		Where("timestamp >= ? and timestamp <= ?")

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
	rows, err := server.Server.ChPool.Query(context.Background(), stmt.String(), af.AppID, af.From, af.To)
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
		Where("app_id = toUUID(?)").
		Where("timestamp >= ? and timestamp <= ?")

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
	rows, err := server.Server.ChPool.Query(context.Background(), stmt.String(), af.AppID, af.From, af.To)
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
		Where("app_id = toUUID(?)").
		Where("timestamp >= ? and timestamp <= ?")

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
	rows, err := server.Server.ChPool.Query(context.Background(), stmt.String(), af.AppID, af.From, af.To)
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
		Where("app_id = toUUID(?)").
		Where("timestamp >= ? and timestamp <= ?")

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
	rows, err := server.Server.ChPool.Query(context.Background(), stmt.String(), af.AppID, af.From, af.To)
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
		Where("app_id = toUUID(?)").
		Where("timestamp >= ? and timestamp <= ?")

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
	rows, err := server.Server.ChPool.Query(context.Background(), stmt.String(), af.AppID, af.From, af.To)
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
		Where("app_id = toUUID(?)").
		Where("timestamp >= ? and timestamp <= ?")

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
	rows, err := server.Server.ChPool.Query(context.Background(), stmt.String(), af.AppID, af.From, af.To)
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
