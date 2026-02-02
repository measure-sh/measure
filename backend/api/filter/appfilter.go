package filter

import (
	"backend/api/ambient"
	"backend/api/event"
	"backend/api/logcomment"
	"backend/api/opsys"
	"backend/api/pairs"
	"backend/api/server"
	"backend/api/text"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/blang/semver/v4"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
	"golang.org/x/sync/errgroup"
)

// DefaultDuration is the default time duration used
// for all filtering operations when an explicit
// duration is not provided.
const DefaultDuration = time.Hour * 24 * 7

// MaxPaginationLimit is the maximum limit value allowed
// for generic query operations.
const MaxPaginationLimit = 1000

// DefaultPaginationLimit is the number of items used
// as default for paginating items.
const DefaultPaginationLimit = 10

// defaultQueryCacheTTL is the default query cache
// TTL duration.
const defaultQueryCacheTTL = time.Minute * 10

// appFiltersTable is the name of the for event filters.
const appFiltersTable = "app_filters_new final"

// spanFiltersTable is the name of the table for span
// filters.
const spanFiltersTable = "span_filters final"

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

	// AppOSName is the OSName value of the app.
	AppOSName string

	// From represents the lower time bound of
	// the filter time range.
	From time.Time `form:"from" time_format:"2006-01-02T15:04:05.000Z" time_utc:"1"`

	// To represents the upper time bound of
	// the filter time range.
	To time.Time `form:"to" time_format:"2006-01-02T15:04:05.000Z" time_utc:"1"`

	// Timezone represents the timezone of the
	// client
	Timezone string `form:"timezone"`

	// FilterShortCode represents a short code for list
	// filters.
	FilterShortCode string `form:"filter_short_code"`

	// Versions is the list of version string
	// to be matched & filtered on.
	Versions []string `form:"versions"`

	// VersionCodes is the list of version code
	// to be matched & filtered on.
	VersionCodes []string `form:"version_codes"`

	// OsNames is the list of OS names
	// to be matched on & filtered on.
	OsNames []string `form:"os_names"`

	// OsVersions is the list of OS versions
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

	// BugReport indicates the filtering should
	// only consider bug report events.
	BugReport bool `form:"bug_report"`

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

	// BugReportStatuses represents the list of status of
	// a bug report to be filtered on.
	BugReportStatuses []int8 `form:"bug_report_statuses"`

	// Deprecated: Use Limit/Offset for paging.
	// KeyID is the anchor point for keyset
	// pagination.
	KeyID string `form:"key_id"`

	// FreeText is a free form text string that can be used
	// to filter over logs, exceptions, events etc
	FreeText string `form:"free_text"`

	// Deprecated: Use Limit/Offset for paging.
	// KeyTimestamp is the anchor point for
	// keyset pagination.
	KeyTimestamp time.Time `form:"key_timestamp"`

	// Limit is the count of matching rows to
	// return.
	Limit int `form:"limit"`

	// Offset if the count of matching rows to
	// skip.
	Offset int `form:"offset"`

	// Background represents if matching should
	// be applied to background events or sessions.
	//
	// A background session is defined as any session
	// that has at least 1 `lifecycle_app` event with
	// type as `background`.
	Background bool `form:"background"`

	// Foreground represents if matching should
	// be applied to foreground events or sessions.
	//
	// A foreground session is defined as any session
	// that has at least 1 `lifecycle_app` event with
	// type as `foreground`.
	Foreground bool `form:"foreground"`

	// UserInteraction represents if matching should
	// be applied to events or sessions pertaining
	// to user interactions, like gesture events.
	UserInteraction bool `form:"user_interaction"`

	// BiGraph represents if journey plot
	// constructions should be bidirectional.
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
	return json.Unmarshal([]byte(af.UDExpressionRaw), af.UDExpression)
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
			return fmt.Errorf("failed to parse %q: %v", `ud_expression`, err.Error())
		}

		if err := af.UDExpression.Validate(); err != nil {
			return fmt.Errorf("failed to validate %q: %v", `ud_expression`, err.Error())
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
func (af AppFilter) ValidateVersions() error {
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

// VersionPairs provides a convenient wrapper over versions
// and version codes representing them in paired-up way, like
// tuples. For many cases, a paired up version is more useful
// than individual version names and codes.
func (af AppFilter) VersionPairs() (versions *pairs.Pairs[string, string], err error) {
	versions, err = pairs.NewPairs(af.Versions, af.VersionCodes)
	if err != nil {
		return
	}
	return
}

// OSVersionPairs provides a convenient wrapper over OS name
// and OS version representing them in paired-up way, like
// tuples. For many cases, a paired up version is more useful
// than individual OS names and versions.
func (af AppFilter) OSVersionPairs() (osVersions *pairs.Pairs[string, string], err error) {
	osVersions, err = pairs.NewPairs(af.OsNames, af.OsVersions)
	if err != nil {
		return
	}
	return
}

// HasTimeRange checks if the time values are
// appropriately set.
func (af AppFilter) HasTimeRange() bool {
	return !af.From.IsZero() && !af.To.IsZero()
}

// HasKeyset checks if key id and key timestamp
// values are present and valid.
func (af AppFilter) HasKeyset() bool {
	return af.hasKeyID() && af.hasKeyTimestamp()
}

// HasPositiveLimit checks if limit is greater
// than zero.
func (af AppFilter) HasPositiveLimit() bool {
	return af.Limit > 0
}

// HasVersions returns true if at least one
// app version is requested.
func (af AppFilter) HasVersions() bool {
	return len(af.Versions) > 0 && len(af.VersionCodes) > 0
}

// HasOSVersions returns true if there at least
// one OS Version is requested.
func (af AppFilter) HasOSVersions() bool {
	return len(af.OsNames) > 0 && len(af.OsVersions) > 0
}

// HasMultiVersions checks if multiple versions
// are requested.
func (af AppFilter) HasMultiVersions() bool {
	return len(af.Versions) > 1 && len(af.VersionCodes) > 1
}

// HasCountries returns true if at least one
// country is requested.
func (af AppFilter) HasCountries() bool {
	return len(af.Countries) > 0
}

// HasNetworkProviders returns true if at least
// one network provider is requested.
func (af AppFilter) HasNetworkProviders() bool {
	return len(af.NetworkProviders) > 0
}

// HasNetworkTypes returns true if at least
// one network type is requested.
func (af AppFilter) HasNetworkTypes() bool {
	return len(af.NetworkTypes) > 0
}

// HasNetworkGenerations returns true if at least
// one network generation is requested.
func (af AppFilter) HasNetworkGenerations() bool {
	return len(af.NetworkGenerations) > 0
}

// HasDeviceLocales returns true if at least
// one device locale is requested.
func (af AppFilter) HasDeviceLocales() bool {
	return len(af.Locales) > 0
}

// HasDeviceManufacturers returns true if at least
// one device manufacturer is requested.
func (af AppFilter) HasDeviceManufacturers() bool {
	return len(af.DeviceManufacturers) > 0
}

// HasDeviceNames returns true if at least
// one device name is requested.
func (af AppFilter) HasDeviceNames() bool {
	return len(af.DeviceNames) > 0
}

// HasTimezone returns true if a timezone
// is requested.
func (af AppFilter) HasTimezone() bool {
	return af.Timezone != ""
}

// HasFreeText returns true if a free text
// keyword was supplied.
func (af AppFilter) HasFreeText() bool {
	return af.FreeText != ""
}

// HasSpanStatuses returns true if at least
// one span statuses are requested.
func (af AppFilter) HasSpanStatuses() bool {
	return len(af.SpanStatuses) > 0
}

// HasBugReportStatuses returns true if at least
// one bug report statuses are requested.
func (af AppFilter) HasBugReportStatuses() bool {
	return len(af.BugReportStatuses) > 0
}

// HasUDExpression returns true if a user
// defined expression was requested.
func (af *AppFilter) HasUDExpression() bool {
	return af.UDExpressionRaw != "" && af.UDExpression != nil
}

// LimitAbs returns the absolute value of limit
func (af AppFilter) LimitAbs() int {
	if !af.HasPositiveLimit() {
		return -af.Limit
	}
	return af.Limit
}

// GetGenericFilters finds distinct values of app versions, network type,
// network provider and other such event parameters from available events
// with appropriate filters applied.
func (af AppFilter) GetGenericFilters(ctx context.Context, fl *FilterList) error {
	var filterGroup errgroup.Group

	// each go routine isolates log comment &
	// clickhouse settings for safe concurrency
	filterGroup.Go(func() (err error) {
		lc := logcomment.New(2)
		settings := clickhouse.Settings{
			"log_comment": lc.MustPut(logcomment.Root, logcomment.Filters).String(),
			// only query level caching is supported in ClickHouse Cloud,
			// not at session level.
			"use_query_cache": gin.Mode() == gin.ReleaseMode,
			// cache for 10 mins
			"query_cache_ttl":   int(defaultQueryCacheTTL.Seconds()),
			"force_primary_key": gin.Mode() == gin.DebugMode,
		}
		ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "app_versions")

		versions, versionCodes, err := af.getAppVersions(ctx)
		if err != nil {
			return
		}
		fl.Versions = append(fl.Versions, versions...)
		fl.VersionCodes = append(fl.VersionCodes, versionCodes...)

		return
	})

	filterGroup.Go(func() (err error) {
		lc := logcomment.New(2)
		settings := clickhouse.Settings{
			"log_comment":     lc.MustPut(logcomment.Root, logcomment.Filters).String(),
			"use_query_cache": gin.Mode() == gin.ReleaseMode,
			// cache filters for 10 mins
			"query_cache_ttl": int(defaultQueryCacheTTL.Seconds()),
		}
		ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "os_versions")

		osNames, osVersions, err := af.getOSVersions(ctx)
		if err != nil {
			return
		}
		fl.OsNames = append(fl.OsNames, osNames...)
		fl.OsVersions = append(fl.OsVersions, osVersions...)

		return
	})

	filterGroup.Go(func() (err error) {
		lc := logcomment.New(2)
		settings := clickhouse.Settings{
			"log_comment":     lc.MustPut(logcomment.Root, logcomment.Filters).String(),
			"use_query_cache": gin.Mode() == gin.ReleaseMode,
			// cache filters for 10 mins
			"query_cache_ttl": int(defaultQueryCacheTTL.Seconds()),
		}
		ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "countries")

		countries, err := af.getCountries(ctx)
		if err != nil {
			return
		}
		fl.Countries = append(fl.Countries, countries...)

		return
	})

	filterGroup.Go(func() (err error) {
		lc := logcomment.New(2)
		settings := clickhouse.Settings{
			"log_comment":     lc.MustPut(logcomment.Root, logcomment.Filters).String(),
			"use_query_cache": gin.Mode() == gin.ReleaseMode,
			// cache filters for 10 mins
			"query_cache_ttl": int(defaultQueryCacheTTL.Seconds()),
		}
		ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "network_providers")

		networkProviders, err := af.getNetworkProviders(ctx)
		if err != nil {
			return
		}
		fl.NetworkProviders = append(fl.NetworkProviders, networkProviders...)

		return
	})

	filterGroup.Go(func() (err error) {
		lc := logcomment.New(2)
		settings := clickhouse.Settings{
			"log_comment":     lc.MustPut(logcomment.Root, logcomment.Filters).String(),
			"use_query_cache": gin.Mode() == gin.ReleaseMode,
			// cache filters for 10 mins
			"query_cache_ttl": int(defaultQueryCacheTTL.Seconds()),
		}
		ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "network_types")

		networkTypes, err := af.getNetworkTypes(ctx)
		if err != nil {
			return
		}
		fl.NetworkTypes = append(fl.NetworkTypes, networkTypes...)

		return
	})

	filterGroup.Go(func() (err error) {
		lc := logcomment.New(2)
		settings := clickhouse.Settings{
			"log_comment":     lc.MustPut(logcomment.Root, logcomment.Filters).String(),
			"use_query_cache": gin.Mode() == gin.ReleaseMode,
			// cache filters for 10 mins
			"query_cache_ttl": int(defaultQueryCacheTTL.Seconds()),
		}
		ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "network_generations")

		networkGenerations, err := af.getNetworkGenerations(ctx)
		if err != nil {
			return
		}
		fl.NetworkGenerations = append(fl.NetworkGenerations, networkGenerations...)

		return
	})

	filterGroup.Go(func() (err error) {
		lc := logcomment.New(2)
		settings := clickhouse.Settings{
			"log_comment":     lc.MustPut(logcomment.Root, logcomment.Filters).String(),
			"use_query_cache": gin.Mode() == gin.ReleaseMode,
			// cache filters for 10 mins
			"query_cache_ttl": int(defaultQueryCacheTTL.Seconds()),
		}
		ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "device_locales")

		deviceLocales, err := af.getDeviceLocales(ctx)
		if err != nil {
			return
		}
		fl.DeviceLocales = append(fl.DeviceLocales, deviceLocales...)

		return
	})

	filterGroup.Go(func() (err error) {
		lc := logcomment.New(2)
		settings := clickhouse.Settings{
			"log_comment":     lc.MustPut(logcomment.Root, logcomment.Filters).String(),
			"use_query_cache": gin.Mode() == gin.ReleaseMode,
			// cache filters for 10 mins
			"query_cache_ttl": int(defaultQueryCacheTTL.Seconds()),
		}
		ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "device_manufacturers")

		deviceManufacturers, err := af.getDeviceManufacturers(ctx)
		if err != nil {
			return
		}
		fl.DeviceManufacturers = append(fl.DeviceManufacturers, deviceManufacturers...)

		return
	})

	filterGroup.Go(func() (err error) {
		lc := logcomment.New(2)
		settings := clickhouse.Settings{
			"log_comment":     lc.MustPut(logcomment.Root, logcomment.Filters).String(),
			"use_query_cache": gin.Mode() == gin.ReleaseMode,
			// cache filters for 10 mins
			"query_cache_ttl": int(defaultQueryCacheTTL.Seconds()),
		}
		ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "device_names")

		deviceNames, err := af.getDeviceNames(ctx)
		if err != nil {
			return
		}
		fl.DeviceNames = append(fl.DeviceNames, deviceNames...)

		return
	})

	if err := filterGroup.Wait(); err != nil {
		return err
	}

	return nil
}

// GetUserDefinedAttrKeys provides list of unique user defined
// attribute keys and its data types by matching a subset of
// filters.
func (af AppFilter) GetUserDefinedAttrKeys(ctx context.Context, fl *FilterList) (err error) {
	if af.UDAttrKeys {
		keytypes, err := af.getUDAttrKeys(ctx)
		if err != nil {
			return err
		}
		fl.UDKeyTypes = append(fl.UDKeyTypes, keytypes...)
	}

	return
}

// Deprecated: Use limit/offset for paging.
// hasKeyID checks if key id is a valid non-empty
// value.
func (af AppFilter) hasKeyID() bool {
	return af.KeyID != ""
}

// Deprecated: Use limit/offset for paging.
// hasKeyTimestamp checks if key timestamp is a valid non-empty
// value.
func (af AppFilter) hasKeyTimestamp() bool {
	return !time.Time.IsZero(af.KeyTimestamp)
}

// getAppVersions finds distinct pairs of app versions &
// app build no from available filters.
//
// Additionally, filters for `exception` and `anr` event
// types.
func (af AppFilter) getAppVersions(ctx context.Context) (versions, versionCodes []string, err error) {
	table := appFiltersTable

	if af.Span {
		table = spanFiltersTable
	}

	teamId, err := ambient.TeamId(ctx)
	if err != nil {
		return
	}

	stmt := sqlf.
		From(table).
		Select("app_version.1 as version").
		Select("app_version.2 as code").
		Where("team_id = toUUID(?)", teamId).
		Where("app_id = toUUID(?)", af.AppID).
		GroupBy("version").
		GroupBy("code").
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

	v := &Versions{}

	for rows.Next() {
		var version string
		var code string
		if err = rows.Scan(&version, &code); err != nil {
			return
		}

		v.Add(version, code)
	}

	// attempt to sort versions depending on
	// app os requirements and conventions
	switch opsys.ToFamily(af.AppOSName) {
	case opsys.AppleFamily:
		if !v.IsValidSemver() {
			break
		}

		if err = v.SemverSortByVersionDesc(); err != nil {
			return
		}
	}

	versions = v.Versions()
	versionCodes = v.Codes()

	err = rows.Err()

	return
}

// getOSVersions finds distinct values of os versions
// from available filters.
//
// Additionally, filters `exception` and `anr` event types.
func (af AppFilter) getOSVersions(ctx context.Context) (osNames, osVersions []string, err error) {
	table := appFiltersTable

	if af.Span {
		table = spanFiltersTable
	}

	teamId, err := ambient.TeamId(ctx)
	if err != nil {
		return
	}

	stmt := sqlf.
		From(table).
		Select("os_version.1 as name").
		Select("os_version.2 as version").
		Where("team_id = toUUID(?)", teamId).
		Where("app_id = toUUID(?)", af.AppID).
		GroupBy("name").
		GroupBy("version").
		OrderBy("version desc, name")

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
// from available filters.
//
// Additionally, filters `exception` and `anr` event types.
func (af AppFilter) getCountries(ctx context.Context) (countries []string, err error) {
	table := appFiltersTable

	if af.Span {
		table = spanFiltersTable
	}

	teamId, err := ambient.TeamId(ctx)
	if err != nil {
		return
	}

	stmt := sqlf.
		From(table).
		Select("country_code").
		Where("team_id = toUUID(?)", teamId).
		Where("app_id = toUUID(?)", af.AppID).
		GroupBy("country_code").
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
// providers from available filters.
//
// Additionally, filters `exception` and `anr` event types.
func (af AppFilter) getNetworkProviders(ctx context.Context) (networkProviders []string, err error) {
	table := appFiltersTable

	if af.Span {
		table = spanFiltersTable
	}

	teamId, err := ambient.TeamId(ctx)
	if err != nil {
		return
	}

	stmt := sqlf.
		From(table).
		Select("network_provider").
		Where("team_id = toUUID(?)", teamId).
		Where("app_id = toUUID(?)", af.AppID).
		GroupBy("network_provider").
		OrderBy("network_provider")

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
// types from available filters.
//
// Additionally, filters `exception` and `anr` event types.
func (af AppFilter) getNetworkTypes(ctx context.Context) (networkTypes []string, err error) {
	table := appFiltersTable

	if af.Span {
		table = spanFiltersTable
	}

	teamId, err := ambient.TeamId(ctx)
	if err != nil {
		return
	}

	stmt := sqlf.
		From(table).
		Select("network_type").
		Where("team_id = toUUID(?)", teamId).
		Where("app_id = toUUID(?)", af.AppID).
		GroupBy("network_type").
		OrderBy("network_type")

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
// generations from available filters.
//
// Additionally, filters `exception` and `anr` event types.
func (af AppFilter) getNetworkGenerations(ctx context.Context) (networkGenerations []string, err error) {
	table := appFiltersTable

	if af.Span {
		table = spanFiltersTable
	}

	teamId, err := ambient.TeamId(ctx)
	if err != nil {
		return
	}

	stmt := sqlf.
		From(table).
		Select("network_generation").
		Where("team_id = toUUID(?)", teamId).
		Where("app_id = toUUID(?)", af.AppID).
		GroupBy("network_generation").
		OrderBy("network_generation")

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
// locales from available filters.
//
// Additionally, filters `exception` and `anr` event types.
func (af AppFilter) getDeviceLocales(ctx context.Context) (deviceLocales []string, err error) {
	table := appFiltersTable

	if af.Span {
		table = spanFiltersTable
	}

	teamId, err := ambient.TeamId(ctx)
	if err != nil {
		return
	}

	stmt := sqlf.
		From(table).
		Select("device_locale").
		Where("team_id = toUUID(?)", teamId).
		Where("app_id = toUUID(?)", af.AppID).
		GroupBy("device_locale").
		OrderBy("device_locale")

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
// manufacturers from available filters.
//
// Additionally, filters `exception` and `anr` event types.
func (af AppFilter) getDeviceManufacturers(ctx context.Context) (deviceManufacturers []string, err error) {
	table := appFiltersTable

	if af.Span {
		table = spanFiltersTable
	}

	teamId, err := ambient.TeamId(ctx)
	if err != nil {
		return
	}

	stmt := sqlf.
		From(table).
		Select("device_manufacturer").
		Where("team_id = toUUID(?)", teamId).
		Where("app_id = toUUID(?)", af.AppID).
		GroupBy("device_manufacturer").
		OrderBy("device_manufacturer")

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
// names from available filters.
//
// Additionally, filters `exception` and `anr` event types.
func (af AppFilter) getDeviceNames(ctx context.Context) (deviceNames []string, err error) {
	table := appFiltersTable

	if af.Span {
		table = spanFiltersTable
	}

	teamId, err := ambient.TeamId(ctx)
	if err != nil {
		return
	}

	stmt := sqlf.
		From(table).
		Select("device_name").
		Where("team_id = toUUID(?)", teamId).
		Where("app_id = toUUID(?)", af.AppID).
		GroupBy("device_name").
		OrderBy("device_name")

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
func (af AppFilter) getUDAttrKeys(ctx context.Context) (keytypes []event.UDKeyType, err error) {
	table := "user_def_attrs_new final"

	if af.Span {
		table = "span_user_def_attrs_new final"
	}

	teamId, err := ambient.TeamId(ctx)
	if err != nil {
		return
	}

	stmt := sqlf.From(table).
		Select("key").
		Select("argMax(type, timestamp) as type").
		Where("team_id = toUUID(?)", teamId).
		Where("app_id = toUUID(?)", af.AppID).
		GroupBy("key").
		OrderBy("key").
		// most granules will be read anyway
		// applying skip indexes unlikely to
		// benefit
		// clickhouse may waste effort reading
		// & analyzing skip indexes in vain
		Clause("settings use_skip_indexes = 0")

	defer stmt.Close()

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
func (af AppFilter) GetExcludedVersions(ctx context.Context) (versions Versions, err error) {
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

	versions = exclude(allVersions, allCodes, af.Versions, af.VersionCodes)

	return
}

// Add adds a version name and code pair
// to versions.
func (v *Versions) Add(name, code string) {
	v.names = append(v.names, name)
	v.codes = append(v.codes, code)
}

// SemverSortByVersionDesc sorts version names in
// descending semver order keeping version code in
// lock-step with version name.
// Assumes version name is valid semver.
func (v *Versions) SemverSortByVersionDesc() (err error) {
	if len(v.names) < 1 {
		return
	}

	type pair struct {
		ver  semver.Version
		name string
		code string
	}

	pairs := make([]pair, len(v.names))

	for i, name := range v.names {
		semver, err := semver.Parse(name)
		if err != nil {
			return err
		}
		pairs[i] = pair{
			ver:  semver,
			name: name,
			code: v.codes[i],
		}
	}

	sort.Slice(pairs, func(i, j int) bool {
		return pairs[i].ver.GT(pairs[j].ver)
	})

	sortedNames := make([]string, len(pairs))
	sortedCodes := make([]string, len(pairs))

	for i, p := range pairs {
		sortedNames[i] = p.name
		sortedCodes[i] = p.code
	}

	v.names = sortedNames
	v.codes = sortedCodes

	return
}

// IsValidSemver determines if all version names
// adhere to semver specification.
func (v Versions) IsValidSemver() bool {
	if len(v.names) < 1 {
		return false
	}

	for _, name := range v.names {
		if _, err := semver.Parse(name); err != nil {
			return false
		}
	}
	return true
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

// exclude figures out the set of excluded versions
// from sets of all versions and sets of selected
// versions.
func exclude(allV, allC, selV, selC []string) (versions Versions) {
	selCount := make(map[string]int)
	for i := range selV {
		key := selV[i] + "\x00" + selC[i]
		selCount[key]++
	}

	for i := range allV {
		key := allV[i] + "\x00" + allC[i]
		if selCount[key] > 0 {
			selCount[key]--
			continue
		}
		versions.Add(allV[i], allC[i])
	}

	return
}
