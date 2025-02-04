package filter

import (
	"backend/api/event"
	"backend/api/pairs"
	"backend/api/server"
	"backend/api/text"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
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

// Operator represents a comparison operator
// like `eq` for `equal` or `gte` for `greater
// than or equal` used for filtering various
// entities.
type Operator struct {
	Code string
	Type event.AttrType
}

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

	// Timezone represents the timezone of the
	// client
	Timezone string `form:"timezone"`

	// Represents a short code for list filters
	FilterShortCode string `form:"filter_short_code"`

	// Versions is the list of version string
	// to be matched & filtered on.
	Versions []string `form:"versions"`

	// VersionCodes is the list of version code
	// to be matched & filtered on.
	VersionCodes []string `form:"version_codes"`

	// OsNames is the list of os names
	// to be matched on & filtered on.
	OsNames []string `form:"os_names"`

	// OsVersions is the list of os versions
	// to be matched on & filtered on.
	OsVersions []string `form:"os_versions"`

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

	// Crash indicates the filtering should
	// only consider unhandled exception events.
	Crash bool `form:"crash"`

	// ANR indicates the filtering should only
	// consider ANR events.
	ANR bool `form:"anr"`

	// UDAttrKeys indicates a request to receive
	// list of user defined attribute key &
	// types.
	UDAttrKeys bool `form:"ud_attr_keys"`

	// UDExpressionRaw contains the raw user defined
	// attribute expression as string.
	UDExpressionRaw string `form:"ud_expression"`

	// UDExpression contains the parsed user defined
	// attribute expression.
	UDExpression *event.UDExpression
	// Span indicates the filtering should only
	// consider spans.
	Span bool `form:"span"`

	// SpanStatuses represents the list of status of
	// a span to be filtered on.
	SpanStatuses []int8 `form:"span_statuses"`

	// KeyID is the anchor point for keyset
	// pagination.
	KeyID string `form:"key_id"`

	// FreeText is a free form text string that can be used
	// to filter over logs, exceptions, events etc
	FreeText string `form:"free_text"`

	// KeyTimestamp is the anchor point for
	// keyset pagination.
	KeyTimestamp time.Time `form:"key_timestamp"`

	// Limit is the count of matching rows to
	// return.
	Limit int `form:"limit"`

	// Offset if the count of matching rows to
	// skip.
	Offset int `form:"offset"`

	// BiGraph represents if journey plot
	// constructions should be bidirectional
	// or not.
	BiGraph bool `form:"bigraph"`
}

// FilterList holds various filter parameter values that are
// used in filtering operations of app's issue journey map,
// metrics, exceptions and ANRs.
type FilterList struct {
	Versions            []string          `json:"versions"`
	VersionCodes        []string          `json:"version_codes"`
	OsNames             []string          `json:"os_names"`
	OsVersions          []string          `json:"os_versions"`
	Countries           []string          `json:"countries"`
	NetworkProviders    []string          `json:"network_providers"`
	NetworkTypes        []string          `json:"network_types"`
	NetworkGenerations  []string          `json:"network_generations"`
	DeviceLocales       []string          `json:"locales"`
	DeviceManufacturers []string          `json:"device_manufacturers"`
	DeviceNames         []string          `json:"device_names"`
	UDKeyTypes          []event.UDKeyType `json:"ud_keytypes"`
	UDExpressionRaw     string            `json:"ud_expression"`
}

// Versions represents a list of
// (version, code) pairs.
type Versions struct {
	names, codes []string
}

// Validate validates each app filtering parameter and sets
// defaults for unspecified parameters. Returns error if any
// parameter is invalid or incomplete.
func (af *AppFilter) Validate() error {
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

	if af.Limit == 0 {
		return errors.New("`limit` cannot be zero")
	}

	if af.Limit > MaxPaginationLimit {
		return fmt.Errorf("`limit` cannot be more than %d", MaxPaginationLimit)
	}

	if af.UDExpressionRaw != "" {
		if err := af.parseUDExpression(); err != nil {
			return fmt.Errorf("`ud_expresssion` is invalid")
		}

		if err := af.UDExpression.Validate(); err != nil {
			return fmt.Errorf("`ud_expression` is invalid. %s", err.Error())
		}
	}

	for _, status := range af.SpanStatuses {
		if status < 0 || status > 2 {
			return fmt.Errorf("`span_statuses` values must be 0 (Unset), 1 (Ok) or 2 (Error)")
		}
	}

	return nil
}

// ValidateVersions validates presence of valid
// version name and version code.
func (af *AppFilter) ValidateVersions() error {
	presence := len(af.Versions) > 0 && len(af.VersionCodes) > 0
	arity := len(af.Versions) == len(af.VersionCodes)

	if !presence {
		return fmt.Errorf(`%q and %q both are required`, "versions", "version_codes")
	}
	if !arity {
		return fmt.Errorf(`%q and %q both should be of same length`, "versions", "version_codes")
	}

	return nil
}

// VersionPairs provides a convinient wrapper over versions
// and version codes representing them in paired-up way, like
// tuples. For many cases, a paired up version is more useful
// than individual version names and codes.
func (af *AppFilter) VersionPairs() (versions *pairs.Pairs[string, string], err error) {
	versions, err = pairs.NewPairs(af.Versions, af.VersionCodes)
	if err != nil {
		return
	}
	return
}

// OSVersionPairs provides a convinient wrapper over OS name
// and OS version representing them in paired-up way, like
// tuples. For many cases, a paired up version is more useful
// than individual OS names and versions.
func (af *AppFilter) OSVersionPairs() (osVersions *pairs.Pairs[string, string], err error) {
	osVersions, err = pairs.NewPairs(af.OsNames, af.OsVersions)
	if err != nil {
		return
	}
	return
}

// Expand populates app filters by fetching stored filters
// via short code if short code exists, otherwise splits, trims
// formats existing available filters.
func (af *AppFilter) Expand(ctx context.Context) (err error) {
	var filters *FilterList
	if af.FilterShortCode != "" {
		filters, err = GetFiltersFromCode(ctx, af.FilterShortCode, af.AppID)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return
		}

		// it's critical to set err to nil
		err = nil
	}

	if filters != nil {
		if len(filters.Versions) > 0 {
			af.Versions = filters.Versions
		}
		if len(filters.VersionCodes) > 0 {
			af.VersionCodes = filters.VersionCodes
		}
		if len(filters.OsNames) > 0 {
			af.OsNames = filters.OsNames
		}
		if len(filters.OsVersions) > 0 {
			af.OsVersions = filters.OsVersions
		}
		if len(filters.Countries) > 0 {
			af.Countries = filters.Countries
		}
		if len(filters.DeviceNames) > 0 {
			af.DeviceNames = filters.DeviceNames
		}
		if len(filters.DeviceManufacturers) > 0 {
			af.DeviceManufacturers = filters.DeviceManufacturers
		}
		if len(filters.DeviceLocales) > 0 {
			af.Locales = filters.DeviceLocales
		}
		if len(filters.NetworkProviders) > 0 {
			af.NetworkProviders = filters.NetworkProviders
		}
		if len(filters.NetworkTypes) > 0 {
			af.NetworkTypes = filters.NetworkTypes
		}
		if len(filters.NetworkGenerations) > 0 {
			af.NetworkGenerations = filters.NetworkGenerations
		}
		if filters.UDExpressionRaw != "" {
			af.UDExpressionRaw = filters.UDExpressionRaw
		}
		return
	}

	// split and trim whitespace from each filter
	if len(af.Versions) > 0 {
		af.Versions = text.SplitTrimEmpty(af.Versions[0], ",")
	}

	if len(af.VersionCodes) > 0 {
		af.VersionCodes = text.SplitTrimEmpty(af.VersionCodes[0], ",")
	}

	if len(af.OsNames) > 0 {
		af.OsNames = text.SplitTrimEmpty(af.OsNames[0], ",")
	}

	if len(af.OsVersions) > 0 {
		af.OsVersions = text.SplitTrimEmpty(af.OsVersions[0], ",")
	}

	if len(af.Countries) > 0 {
		af.Countries = text.SplitTrimEmpty(af.Countries[0], ",")
	}

	if len(af.DeviceNames) > 0 {
		af.DeviceNames = text.SplitTrimEmpty(af.DeviceNames[0], ",")
	}

	if len(af.DeviceManufacturers) > 0 {
		af.DeviceManufacturers = text.SplitTrimEmpty(af.DeviceManufacturers[0], ",")
	}

	if len(af.Locales) > 0 {
		af.Locales = text.SplitTrimEmpty(af.Locales[0], ",")
	}

	if len(af.NetworkProviders) > 0 {
		af.NetworkProviders = text.SplitTrimEmpty(af.NetworkProviders[0], ",")
	}

	if len(af.NetworkTypes) > 0 {
		af.NetworkTypes = text.SplitTrimEmpty(af.NetworkTypes[0], ",")
	}

	if len(af.NetworkGenerations) > 0 {
		af.NetworkGenerations = text.SplitTrimEmpty(af.NetworkGenerations[0], ",")
	}

	if len(af.UDExpressionRaw) > 0 {
		af.UDExpressionRaw = strings.TrimSpace(af.UDExpressionRaw)
	}

	return
}

// parseUDExpression parses the raw user defined
// attribute expression value.
func (af *AppFilter) parseUDExpression() (err error) {
	af.UDExpression = &event.UDExpression{}
	if err = json.Unmarshal([]byte(af.UDExpressionRaw), af.UDExpression); err != nil {
		return
	}
	return
}

// HasTimeRange checks if the time values are
// appropriately set.
func (af *AppFilter) HasTimeRange() bool {
	return !af.From.IsZero() && !af.To.IsZero()
}

// HasKeyset checks if key id and key timestamp
// values are present and valid.
func (af *AppFilter) HasKeyset() bool {
	return af.hasKeyID() && af.hasKeyTimestamp()
}

// HasPositiveLimit checks if limit is greater
// than zero.
func (af *AppFilter) HasPositiveLimit() bool {
	return af.Limit > 0
}

// HasVersions returns true if at least one
// app version is requested.
func (af *AppFilter) HasVersions() bool {
	return len(af.Versions) > 0 && len(af.VersionCodes) > 0
}

// HasOSVersions returns true if there at least
// one OS Version is requested.
func (af *AppFilter) HasOSVersions() bool {
	return len(af.OsNames) > 0 && len(af.OsVersions) > 0
}

// HasMultiVersions checks if multiple versions
// are requested.
func (af *AppFilter) HasMultiVersions() bool {
	return len(af.Versions) > 1 && len(af.VersionCodes) > 1
}

// HasCountries returns true if at least one
// country is requested.
func (af *AppFilter) HasCountries() bool {
	return len(af.Countries) > 0
}

// HasNetworkProviders returns true if at least
// one network provider is requested.
func (af *AppFilter) HasNetworkProviders() bool {
	return len(af.NetworkProviders) > 0
}

// HasNetworkTypes returns true if at least
// one network type is requested.
func (af *AppFilter) HasNetworkTypes() bool {
	return len(af.NetworkTypes) > 0
}

// HasNetworkGenerations returns true if at least
// one network generation is requested.
func (af *AppFilter) HasNetworkGenerations() bool {
	return len(af.NetworkGenerations) > 0
}

// HasDeviceLocales returns true if at least
// one device locale is requested.
func (af *AppFilter) HasDeviceLocales() bool {
	return len(af.Locales) > 0
}

// HasDeviceManufacturers returns true if at least
// one device manufacturer is requested.
func (af *AppFilter) HasDeviceManufacturers() bool {
	return len(af.DeviceManufacturers) > 0
}

// HasDeviceNames returns true if at least
// one device name is requested.
func (af *AppFilter) HasDeviceNames() bool {
	return len(af.DeviceNames) > 0
}

// HasTimezone returns true if a timezone
// is requested.
func (af *AppFilter) HasTimezone() bool {
	return af.Timezone != ""
}

// HasUDExpression returns true if a user
// defined expression was requested.
func (af *AppFilter) HasUDExpression() bool {
	return af.UDExpressionRaw != "" && af.UDExpression != nil
}

// LimitAbs returns the absolute value of limit
func (af *AppFilter) LimitAbs() int {
	if !af.HasPositiveLimit() {
		return -af.Limit
	}
	return af.Limit
}

// ExtendLimit extends the limit by one
// in a signed way.
func (af *AppFilter) ExtendLimit() int {
	if af.HasPositiveLimit() {
		return af.Limit + 1
	} else {
		return af.Limit - 1
	}
}

// SetDefaultTimeRange sets the time range to last
// default duration from current UTC time
func (af *AppFilter) SetDefaultTimeRange() {
	to := time.Now().UTC()
	from := to.Add(-DefaultDuration)

	af.From = from
	af.To = to
}

// GetGenericFilters finds distinct values of app versions, network type,
// network provider and other such event parameters from available events
// with appropriate filters applied.
func (af *AppFilter) GetGenericFilters(ctx context.Context, fl *FilterList) error {
	versions, versionCodes, err := af.getAppVersions(ctx)
	if err != nil {
		return err
	}
	fl.Versions = append(fl.Versions, versions...)
	fl.VersionCodes = append(fl.VersionCodes, versionCodes...)

	osNames, osVersions, err := af.getOsVersions(ctx)
	if err != nil {
		return err
	}
	fl.OsNames = append(fl.OsNames, osNames...)
	fl.OsVersions = append(fl.OsVersions, osVersions...)

	countries, err := af.getCountries(ctx)
	if err != nil {
		return err
	}
	fl.Countries = append(fl.Countries, countries...)

	networkProviders, err := af.getNetworkProviders(ctx)
	if err != nil {
		return err
	}
	fl.NetworkProviders = append(fl.NetworkProviders, networkProviders...)

	networkTypes, err := af.getNetworkTypes(ctx)
	if err != nil {
		return err
	}
	fl.NetworkTypes = append(fl.NetworkTypes, networkTypes...)

	networkGenerations, err := af.getNetworkGenerations(ctx)
	if err != nil {
		return err
	}
	fl.NetworkGenerations = append(fl.NetworkGenerations, networkGenerations...)

	deviceLocales, err := af.getDeviceLocales(ctx)
	if err != nil {
		return err
	}
	fl.DeviceLocales = append(fl.DeviceLocales, deviceLocales...)

	deviceManufacturers, err := af.getDeviceManufacturers(ctx)
	if err != nil {
		return err
	}
	fl.DeviceManufacturers = append(fl.DeviceManufacturers, deviceManufacturers...)

	deviceNames, err := af.getDeviceNames(ctx)
	if err != nil {
		return err
	}
	fl.DeviceNames = append(fl.DeviceNames, deviceNames...)

	return nil
}

// GetUserDefinedAttrKeys provides list of unique user defined
// attribute keys and its data types by matching a subset of
// filters.
func (af *AppFilter) GetUserDefinedAttrKeys(ctx context.Context, fl *FilterList) (err error) {
	if af.UDAttrKeys {
		keytypes, err := af.getUDAttrKeys(ctx)
		if err != nil {
			return err
		}
		fl.UDKeyTypes = append(fl.UDKeyTypes, keytypes...)
	}

	return
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

// getAppVersions finds distinct pairs of app versions &
// app build no from available events.
//
// Additionally, filters for `exception` and `anr` event
// types.
func (af *AppFilter) getAppVersions(ctx context.Context) (versions, versionCodes []string, err error) {
	var table_name string
	if af.Span {
		table_name = "span_filters"
	} else {
		table_name = "app_filters"
	}

	stmt := sqlf.
		From(table_name).
		Select("distinct toString(tupleElement(app_version, 1)) as version, toString(tupleElement(app_version, 2)) as code").
		Where("app_id = toUUID(?)", af.AppID).
		OrderBy("code desc, version")

	defer stmt.Close()

	if af.Crash && !af.Span {
		stmt.Where("exception=true")
	}

	if af.ANR && !af.Span {
		stmt.Where("anr=true")
	}

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var version string
		var code string
		if err = rows.Scan(&version, &code); err != nil {
			return
		}
		versions = append(versions, version)
		versionCodes = append(versionCodes, code)
	}

	err = rows.Err()

	return
}

// getOsVersions finds distinct values of os versions
// from available events.
//
// Additionally, filters `exception` and `anr` event types.
func (af *AppFilter) getOsVersions(ctx context.Context) (osNames, osVersions []string, err error) {
	var table_name string
	if af.Span {
		table_name = "span_filters"
	} else {
		table_name = "app_filters"
	}

	stmt := sqlf.
		From(table_name).
		Select("distinct toString(tupleElement(os_version, 1)) as name, toString(tupleElement(os_version, 2)) as version").
		GroupBy("name, version").
		OrderBy("version desc, name").
		Where("app_id = toUUID(?)", af.AppID)

	defer stmt.Close()

	if af.Crash && !af.Span {
		stmt.Where("exception=true")
	}

	if af.ANR && !af.Span {
		stmt.Where("anr=true")
	}

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var osName string
		var osVersion string
		if err = rows.Scan(&osName, &osVersion); err != nil {
			return
		}
		osNames = append(osNames, osName)
		osVersions = append(osVersions, osVersion)
	}

	err = rows.Err()

	return
}

// getCountries finds distinct values of country codes
// from available events.
//
// Additionally, filters `exception` and `anr` event types.
func (af *AppFilter) getCountries(ctx context.Context) (countries []string, err error) {
	var table_name string
	if af.Span {
		table_name = "span_filters"
	} else {
		table_name = "app_filters"
	}

	stmt := sqlf.
		From(table_name).
		Select("distinct country_code").
		Where("app_id = toUUID(?)", af.AppID).
		OrderBy("country_code")

	defer stmt.Close()

	if af.Crash && !af.Span {
		stmt.Where("exception=true")
	}

	if af.ANR && !af.Span {
		stmt.Where("anr=true")
	}

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var country string
		if err = rows.Scan(&country); err != nil {
			return
		}
		countries = append(countries, country)
	}

	err = rows.Err()

	return
}

// getNetworkProviders finds distinct values of app network
// providers from available events.
//
// Additionally, filters `exception` and `anr` event types.
func (af *AppFilter) getNetworkProviders(ctx context.Context) (networkProviders []string, err error) {
	var table_name string
	if af.Span {
		table_name = "span_filters"
	} else {
		table_name = "app_filters"
	}

	stmt := sqlf.
		From(table_name).
		Select("distinct network_provider").
		OrderBy("network_provider").
		Where("app_id = toUUID(?)", af.AppID)

	defer stmt.Close()

	if af.Crash && !af.Span {
		stmt.Where("exception=true")
	}

	if af.ANR && !af.Span {
		stmt.Where("anr=true")
	}

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var networkProvider string
		if err = rows.Scan(&networkProvider); err != nil {
			return
		}
		networkProviders = append(networkProviders, networkProvider)
	}

	err = rows.Err()

	return
}

// getNetworkTypes finds distinct values of app network
// types from available events.
//
// Additionally, filters `exception` and `anr` event types.
func (af *AppFilter) getNetworkTypes(ctx context.Context) (networkTypes []string, err error) {
	var table_name string
	if af.Span {
		table_name = "span_filters"
	} else {
		table_name = "app_filters"
	}

	stmt := sqlf.
		From(table_name).
		Select("distinct network_type").
		OrderBy("network_type").
		Where("app_id = toUUID(?)", af.AppID)

	defer stmt.Close()

	if af.Crash && !af.Span {
		stmt.Where("exception=true")
	}

	if af.ANR && !af.Span {
		stmt.Where("anr=true")
	}

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var networkType string
		if err = rows.Scan(&networkType); err != nil {
			return
		}
		networkTypes = append(networkTypes, networkType)
	}

	err = rows.Err()

	return
}

// getNetworkGenerations finds distinct values of app network
// generations from available events.
//
// Additionally, filters `exception` and `anr` event types.
func (af *AppFilter) getNetworkGenerations(ctx context.Context) (networkGenerations []string, err error) {
	var table_name string
	if af.Span {
		table_name = "span_filters"
	} else {
		table_name = "app_filters"
	}

	stmt := sqlf.
		From(table_name).
		Select("distinct network_generation").
		OrderBy("network_generation").
		Where("app_id = toUUID(?)", af.AppID)

	defer stmt.Close()

	if af.Crash && !af.Span {
		stmt.Where("exception=true")
	}

	if af.ANR && !af.Span {
		stmt.Where("anr=true")
	}

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var generation string
		if err = rows.Scan(&generation); err != nil {
			return
		}
		if generation == "" {
			continue
		}
		networkGenerations = append(networkGenerations, generation)
	}

	err = rows.Err()

	return
}

// getDeviceLocales finds distinct values of app device
// locales from available events.
//
// Additionally, filters `exception` and `anr` event types.
func (af *AppFilter) getDeviceLocales(ctx context.Context) (deviceLocales []string, err error) {
	var table_name string
	if af.Span {
		table_name = "span_filters"
	} else {
		table_name = "app_filters"
	}

	stmt := sqlf.
		From(table_name).
		Select("distinct device_locale").
		OrderBy("device_locale").
		Where("app_id = toUUID(?)", af.AppID)

	defer stmt.Close()

	if af.Crash && !af.Span {
		stmt.Where("exception=true")
	}

	if af.ANR && !af.Span {
		stmt.Where("anr=true")
	}

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var locale string
		if err = rows.Scan(&locale); err != nil {
			return
		}
		deviceLocales = append(deviceLocales, locale)
	}

	err = rows.Err()

	return
}

// getDeviceManufacturers finds distinct values of app device
// manufacturers from available events.
//
// Additionally, filters `exception` and `anr` event types.
func (af *AppFilter) getDeviceManufacturers(ctx context.Context) (deviceManufacturers []string, err error) {
	var table_name string
	if af.Span {
		table_name = "span_filters"
	} else {
		table_name = "app_filters"
	}

	stmt := sqlf.
		From(table_name).
		Select("distinct device_manufacturer").
		OrderBy("device_manufacturer").
		Where("app_id = toUUID(?)", af.AppID)

	defer stmt.Close()

	if af.Crash && !af.Span {
		stmt.Where("exception=true")
	}

	if af.ANR && !af.Span {
		stmt.Where("anr=true")
	}

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var manufacturer string
		if err = rows.Scan(&manufacturer); err != nil {
			return
		}
		deviceManufacturers = append(deviceManufacturers, manufacturer)
	}

	err = rows.Err()

	return
}

// getDeviceNames finds distinct values of app device
// names from available events.
//
// Additionally, filters `exception` and `anr` event types.
func (af *AppFilter) getDeviceNames(ctx context.Context) (deviceNames []string, err error) {
	var table_name string
	if af.Span {
		table_name = "span_filters"
	} else {
		table_name = "app_filters"
	}

	stmt := sqlf.
		From(table_name).
		Select("distinct device_name").
		OrderBy("device_name").
		Where("app_id = toUUID(?)", af.AppID)

	defer stmt.Close()

	if af.Crash && !af.Span {
		stmt.Where("exception=true")
	}

	if af.ANR && !af.Span {
		stmt.Where("anr=true")
	}

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var name string
		if err = rows.Scan(&name); err != nil {
			return
		}
		deviceNames = append(deviceNames, name)
	}

	err = rows.Err()

	return
}

// getUDAttrKeys finds distinct user defined attribute
// key and its types.
func (af *AppFilter) getUDAttrKeys(ctx context.Context) (keytypes []event.UDKeyType, err error) {
	var table_name string
	if af.Span {
		table_name = "span_user_def_attrs"
	} else {
		table_name = "user_def_attrs"
	}

	stmt := sqlf.From(table_name).
		Select("distinct key").
		Select("toString(type) type").
		Clause("prewhere app_id = toUUID(?)", af.AppID).
		OrderBy("key")

	defer stmt.Close()

	if af.Crash {
		stmt.Where("exception = true")
	}

	if af.ANR {
		stmt.Where("anr = true")
	}

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var keytype event.UDKeyType
		if err = rows.Scan(&keytype.Key, &keytype.Type); err != nil {
			return
		}

		keytypes = append(keytypes, keytype)
	}

	err = rows.Err()

	return
}

// GetExcludedVersions computes list of app version
// and version codes that are excluded from app filter.
func (af *AppFilter) GetExcludedVersions(ctx context.Context) (versions Versions, err error) {
	allVersions, allCodes, err := af.getAppVersions(ctx)
	if err != nil {
		return
	}

	// If no versions are selected, treat it as if all versions were selected
	if len(af.Versions) == 0 || len(af.VersionCodes) == 0 {
		af.Versions = allVersions
		af.VersionCodes = allCodes
		return
	}

	count := len(allVersions)

	if count != len(allCodes) {
		err = fmt.Errorf("mismatch in length of versions and version codes detected")
		return
	}

	for i := 0; i < count; i++ {
		if !slices.Contains(af.Versions, allVersions[i]) && !slices.Contains(af.VersionCodes, allCodes[i]) {
			versions.Add(allVersions[i], allCodes[i])
		}
	}

	return
}

// Add adds a version name and code pair
// to versions.
func (v *Versions) Add(name, code string) {
	v.names = append(v.names, name)
	v.codes = append(v.codes, code)
}

// HasVersions returns true if at least
// 1 (version, code) pair exists.
func (v Versions) HasVersions() bool {
	return len(v.names) > 0
}

// Versions gets the version names.
func (v Versions) Versions() []string {
	return v.names
}

// Codes gets the version codes.
func (v Versions) Codes() []string {
	return v.codes
}
