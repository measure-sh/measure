package measure

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"slices"
	"sort"
	"strings"
	"time"

	"backend/api/ambient"
	"backend/api/config"
	"backend/api/event"
	"backend/api/filter"
	"backend/api/group"
	"backend/api/journey"
	"backend/api/logcomment"
	"backend/api/metrics"
	"backend/api/network"
	"backend/api/numeric"
	"backend/api/opsys"
	"backend/api/server"
	"backend/api/session"
	"backend/api/span"
	"backend/api/timeline"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/leporo/sqlf"
	"golang.org/x/sync/errgroup"
)

type App struct {
	ID           *uuid.UUID `json:"id"`
	TeamId       uuid.UUID  `json:"team_id"`
	AppName      string     `json:"name" binding:"required"`
	UniqueId     string     `json:"unique_identifier"`
	OSName       string     `json:"os_name"`
	APIKey       *APIKey    `json:"api_key"`
	Retention    int        `json:"retention"`
	FirstVersion string     `json:"first_version"`
	Onboarded    bool       `json:"onboarded"`
	OnboardedAt  time.Time  `json:"onboarded_at"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

type plotTimeGroupExpr struct {
	BucketExpr     string
	DatetimeFormat string
}

func getPlotTimeGroupExpr(tsExpr, plotTimeGroup string) (*plotTimeGroupExpr, error) {
	switch plotTimeGroup {
	case filter.PlotTimeGroupMinutes:
		return &plotTimeGroupExpr{
			BucketExpr:     fmt.Sprintf("toStartOfMinute(toTimeZone(%s, ?))", tsExpr),
			DatetimeFormat: "%Y-%m-%dT%H:%i:%S",
		}, nil
	case filter.PlotTimeGroupHours:
		return &plotTimeGroupExpr{
			BucketExpr:     fmt.Sprintf("toStartOfHour(toTimeZone(%s, ?))", tsExpr),
			DatetimeFormat: "%Y-%m-%dT%H:%i:%S",
		}, nil
	case filter.PlotTimeGroupDays:
		return &plotTimeGroupExpr{
			BucketExpr:     fmt.Sprintf("toDate(toTimeZone(%s, ?))", tsExpr),
			DatetimeFormat: "%Y-%m-%d",
		}, nil
	case filter.PlotTimeGroupMonths:
		return &plotTimeGroupExpr{
			BucketExpr:     fmt.Sprintf("toStartOfMonth(toTimeZone(%s, ?))", tsExpr),
			DatetimeFormat: "%Y-%m-01",
		}, nil
	default:
		return nil, fmt.Errorf("unsupported plot time group %q", plotTimeGroup)
	}
}

func (a App) MarshalJSON() ([]byte, error) {
	type Alias App
	return json.Marshal(&struct {
		*Alias
		OSName      *string    `json:"os_name"`
		OnboardedAt *time.Time `json:"onboarded_at"`
		UniqueId    *string    `json:"unique_identifier"`
		Retention   *int       `json:"retention"`
	}{
		OSName: func() *string {
			if a.OSName == "" {
				return nil
			}
			return &a.OSName
		}(),
		UniqueId: func() *string {
			if a.UniqueId == "" {
				return nil
			}
			return &a.UniqueId
		}(),
		OnboardedAt: func() *time.Time {
			if a.OnboardedAt.IsZero() {
				return nil
			}
			return &a.OnboardedAt
		}(),
		Retention: func() *int {
			return &a.Retention
		}(),
		Alias: (*Alias)(&a),
	})
}

func (a App) rename() error {
	stmt := sqlf.PostgreSQL.Update("apps").
		Set("app_name", a.AppName).
		Set("updated_at", time.Now()).
		Where("id = ?", a.ID)
	defer stmt.Close()

	_, err := server.Server.PgPool.Exec(context.Background(), stmt.String(), stmt.Args()...)
	if err != nil {
		return err
	}

	return nil
}

func (a App) getAppRetention() (int, error) {
	stmt := sqlf.PostgreSQL.Select("retention").
		From("apps").
		Where("id = ?", a.ID)
	defer stmt.Close()

	var retention int
	if err := server.Server.PgPool.QueryRow(context.Background(), stmt.String(), stmt.Args()...).Scan(&retention); err != nil {
		return 0, err
	}

	return retention, nil
}

func (a App) updateRetention(retention int) error {
	stmt := sqlf.PostgreSQL.Update("apps").
		Set("retention", retention).
		Set("updated_at", time.Now()).
		Where("id = ?", a.ID)
	defer stmt.Close()

	_, err := server.Server.PgPool.Exec(context.Background(), stmt.String(), stmt.Args()...)
	if err != nil {
		return err
	}

	return nil
}

// IssueGroupExists checks if the group exists by its
// fingerprint and type.
func (a App) IssueGroupExists(ctx context.Context, groupType group.GroupType, fingerprint string) (ok bool, err error) {
	table := "unhandled_exception_groups"

	if groupType == group.GroupTypeANR {
		table = "anr_groups"
	}

	stmt := sqlf.
		From(table).
		Select("1").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("id = ?", fingerprint).
		Limit(1)

	defer stmt.Close()

	err = server.Server.RchPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&ok)

	return
}

// GetExceptionGroupPlotInstances computes crash instances of the exception group.
func (a App) GetExceptionGroupPlotInstances(ctx context.Context, fingerprint string, af *filter.AppFilter) (instances []event.IssueInstance, err error) {
	if af.Timezone == "" {
		return nil, errors.New("missing timezone filter")
	}

	if !af.HasPlotTimeGroup() {
		af.SetDefaultPlotTimeGroup()
	}

	groupExpr, err := getPlotTimeGroupExpr("timestamp", af.PlotTimeGroup)
	if err != nil {
		return nil, err
	}

	stmt := sqlf.
		From(`events`).
		Select(groupExpr.BucketExpr+" as datetime_bucket", af.Timezone).
		Select("formatDateTime(datetime_bucket, ?) as datetime", groupExpr.DatetimeFormat).
		Select("concat(attribute.app_version, ' ', '(', attribute.app_build,')') as version").
		Select("count(id) as instances").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("timestamp >= ? and timestamp <= ?", af.From, af.To).
		Where("type = ?", event.TypeException).
		Where("exception.handled = ?", false).
		Where("exception.fingerprint = ?", fingerprint)

	if af.HasVersions() {
		stmt.Where("attribute.app_version").In(af.Versions)
		stmt.Where("attribute.app_build").In(af.VersionCodes)
	}

	if af.HasOSVersions() {
		stmt.Where("attribute.os_name").In(af.OsNames)
		stmt.Where("attribute.os_version").In(af.OsVersions)
	}

	if af.HasCountries() {
		stmt.Where("inet.country_code").In(af.Countries)
	}

	if af.HasNetworkProviders() {
		stmt.Where("attribute.network_provider").In(af.NetworkProviders)
	}

	if af.HasNetworkTypes() {
		stmt.Where("attribute.network_type").In(af.NetworkTypes)
	}

	if af.HasNetworkGenerations() {
		stmt.Where("attribute.network_generation").In(af.NetworkGenerations)
	}

	if af.HasDeviceLocales() {
		stmt.Where("attribute.device_locale").In(af.Locales)
	}

	if af.HasDeviceManufacturers() {
		stmt.Where("attribute.device_manufacturer").In(af.DeviceManufacturers)
	}

	if af.HasDeviceNames() {
		stmt.Where("attribute.device_name").In(af.DeviceNames)
	}

	stmt.GroupBy("version, datetime_bucket").
		OrderBy("version, datetime_bucket")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	defer rows.Close()

	for rows.Next() {
		var instance event.IssueInstance
		var datetimeBucket time.Time
		if err := rows.Scan(&datetimeBucket, &instance.DateTime, &instance.Version, &instance.Instances); err != nil {
			return nil, err
		}
		instances = append(instances, instance)
	}

	err = rows.Err()

	return
}

// GetExceptionGroupsWithFilter fetches exception groups
// of an app.
func (a App) GetExceptionGroupsWithFilter(ctx context.Context, af *filter.AppFilter) (groups []group.ExceptionGroup, next, previous bool, err error) {
	stmt := sqlf.
		From("unhandled_exception_groups final").
		Select("app_id").
		Select("id").
		Select("argMax(type, timestamp)").
		Select("argMax(message, timestamp)").
		Select("argMax(method_name, timestamp)").
		Select("argMax(file_name, timestamp)").
		Select("argMax(line_number, timestamp)").
		Select("max(timestamp)").
		Select("sumMerge(count) as event_count").
		Select("round((event_count * 100.0) / sum(event_count) over (), 2) as contribution").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		// Capture all the exception groups that received new exceptions
		// after the "from" date & were created before the "to" date.
		Where("timestamp >= ? and timestamp <= ?", af.From, af.To).
		GroupBy("team_id").
		GroupBy("app_id").
		GroupBy("id").
		// Don't consider exception groups that do not
		// have any exception events yet.
		// Also avoids division by zero errors.
		Having("event_count > 0").
		OrderBy("event_count desc")

	if af.HasVersions() {
		stmt.Where("app_version.1 in ?", af.Versions)
		stmt.Where("app_version.2 in ?", af.VersionCodes)
	}

	if af.HasOSVersions() {
		osVersions, errOSVersions := af.OSVersionPairs()
		if errOSVersions != nil {
			err = errOSVersions
			return
		}

		stmt.Having("hasAll(groupUniqArrayMerge(os_versions), [?])", osVersions.Parameterize())
	}

	if af.HasCountries() {
		stmt.Having("hasAll(groupUniqArrayMerge(countries), ?)", af.Countries)
	}

	if af.HasNetworkProviders() {
		stmt.Having("hasAll(groupUniqArrayMerge(network_providers), ?)", af.NetworkProviders)
	}

	if af.HasNetworkTypes() {
		stmt.Having("hasAll(groupUniqArrayMerge(network_types), ?)", af.NetworkTypes)
	}

	if af.HasNetworkGenerations() {
		stmt.Having("hasAll(groupUniqArrayMerge(network_generations), ?)", af.NetworkGenerations)
	}

	if af.HasDeviceLocales() {
		stmt.Having("hasAll(groupUniqArrayMerge(device_locales), ?)", af.Locales)
	}

	if af.HasDeviceManufacturers() {
		stmt.Having("hasAll(groupUniqArrayMerge(device_manufacturers), ?)", af.DeviceManufacturers)
	}

	if af.HasDeviceNames() {
		stmt.Having("hasAll(groupUniqArrayMerge(device_names), ?)", af.DeviceNames)
	}

	if af.Limit > 0 {
		stmt.Limit(uint64(af.Limit) + 1)
	}

	if af.Offset >= 0 {
		stmt.Offset(uint64(af.Offset))
	}

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	defer rows.Close()

	if err = rows.Err(); err != nil {
		return
	}

	for rows.Next() {
		var g group.ExceptionGroup
		if err = rows.Scan(
			&g.AppID,
			&g.ID,
			&g.Type,
			&g.Message,
			&g.MethodName,
			&g.FileName,
			&g.LineNumber,
			&g.UpdatedAt,
			&g.Count,
			&g.Percentage,
		); err != nil {
			return
		}

		groups = append(groups, g)
	}

	resultLen := len(groups)

	// Set pagination next & previous flags
	if resultLen > af.Limit {
		groups = groups[:resultLen-1]
		next = true
	}

	if af.Offset > 0 {
		previous = true
	}

	return
}

// GetExceptionPlotInstances queries aggregated exception
// instances and crash free sessions by datetime and filters.
func (a App) GetExceptionPlotInstances(ctx context.Context, af *filter.AppFilter) (issueInstances []event.IssueInstance, err error) {
	if af.Timezone == "" {
		return nil, errors.New("missing timezone filter")
	}

	if !af.HasPlotTimeGroup() {
		af.SetDefaultPlotTimeGroup()
	}

	groupExpr, err := getPlotTimeGroupExpr("timestamp", af.PlotTimeGroup)
	if err != nil {
		return nil, err
	}

	stmt := sqlf.
		From("events final").
		Select(groupExpr.BucketExpr+" as datetime_bucket", af.Timezone).
		Select("formatDateTime(datetime_bucket, ?) as datetime", groupExpr.DatetimeFormat).
		Select("concat(attribute.app_version, '', '(', attribute.app_build, ')') as app_version").
		Select("count() as total_exceptions").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("timestamp >= ? and timestamp <= ?", af.From, af.To).
		Where("type = ?", event.TypeException).
		Where("exception.handled = false")

	defer stmt.Close()

	if af.HasVersions() {
		stmt.Where("attribute.app_version").In(af.Versions)
		stmt.Where("attribute.app_build").In(af.VersionCodes)
	}

	if af.HasOSVersions() {
		stmt.Where("attribute.os_name").In(af.OsNames)
		stmt.Where("attribute.os_version").In(af.OsVersions)
	}

	if af.HasCountries() {
		stmt.Where("inet.country_code").In(af.Countries)
	}

	if af.HasNetworkProviders() {
		stmt.Where("attribute.network_provider").In(af.NetworkProviders)
	}

	if af.HasNetworkTypes() {
		stmt.Where("attribute.network_type").In(af.NetworkTypes)
	}

	if af.HasNetworkGenerations() {
		stmt.Where("attribute.network_generation").In(af.NetworkGenerations)
	}

	if af.HasDeviceLocales() {
		stmt.Where("attribute.device_locale").In(af.Locales)
	}

	if af.HasDeviceManufacturers() {
		stmt.Where("attribute.device_manufacturer").In(af.DeviceManufacturers)
	}

	if af.HasDeviceNames() {
		stmt.Where("attribute.device_name").In(af.DeviceNames)
	}

	stmt.GroupBy("app_version, datetime_bucket").
		OrderBy("app_version, datetime_bucket")

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var instance event.IssueInstance
		var datetimeBucket time.Time
		if err := rows.Scan(&datetimeBucket, &instance.DateTime, &instance.Version, &instance.Instances); err != nil {
			return nil, err
		}

		if *instance.Instances > 0 {
			zero := float64(0)
			instance.IssueFreeSessions = &zero
			issueInstances = append(issueInstances, instance)
		}
	}

	err = rows.Err()

	return
}

// GetExceptionAttributesDistribution computes the data required for
// plotting crash attribute distribution.
func (a App) GetExceptionAttributesDistribution(ctx context.Context, fingerprint string, af *filter.AppFilter) (distribution event.IssueDistribution, err error) {
	stmt := sqlf.
		From("events").
		Select("concat(attribute.app_version, ' (', attribute.app_build, ')') as app_version").
		Select("concat(attribute.os_name, ' ', attribute.os_version) as os_version").
		Select("inet.country_code as country").
		Select("attribute.network_type as network_type").
		Select("attribute.device_locale as locale").
		Select("concat(attribute.device_manufacturer, ' - ', attribute.device_name) as device").
		Select("count(id) as count").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("exception.fingerprint = ?", fingerprint).
		Where("exception.handled = false").
		Where("type = ?", event.TypeException).
		Where("timestamp >= ? and timestamp <= ?", af.From, af.To).
		GroupBy("app_version").
		GroupBy("os_version").
		GroupBy("country").
		GroupBy("network_type").
		GroupBy("locale").
		GroupBy("device")

	if af.HasVersions() {
		stmt.Where("attribute.app_version").In(af.Versions)
		stmt.Where("attribute.app_build").In(af.VersionCodes)
	}

	if af.HasOSVersions() {
		stmt.Where("attribute.os_name").In(af.OsNames)
		stmt.Where("attribute.os_version").In(af.OsVersions)
	}

	if af.HasCountries() {
		stmt.Where("inet.country_code").In(af.Countries)
	}

	if af.HasNetworkTypes() {
		stmt.Where("attribute.network_type").In(af.NetworkTypes)
	}

	if af.HasNetworkProviders() {
		stmt.Where("attribute.network_provider").In(af.NetworkProviders)
	}

	if af.HasNetworkGenerations() {
		stmt.Where("attribute.network_generation").In(af.NetworkGenerations)
	}

	if af.HasDeviceLocales() {
		stmt.Where("attribute.device_locale").In(af.Locales)
	}

	if af.HasDeviceManufacturers() {
		stmt.Where("attribute.device_manufacturer").In(af.DeviceManufacturers)
	}

	if af.HasDeviceNames() {
		stmt.Where("attribute.device_name").In(af.DeviceNames)
	}

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	defer rows.Close()

	distribution.AppVersion = make(map[string]uint64)
	distribution.OSVersion = make(map[string]uint64)
	distribution.Country = make(map[string]uint64)
	distribution.NetworkType = make(map[string]uint64)
	distribution.Locale = make(map[string]uint64)
	distribution.Device = make(map[string]uint64)

	// Parse each row in the result set.
	for rows.Next() {
		var (
			appVersion  string
			osVersion   string
			country     string
			networkType string
			locale      string
			device      string
			count       uint64
		)

		if err = rows.Scan(&appVersion, &osVersion, &country, &networkType, &locale, &device, &count); err != nil {
			return
		}

		// Update counts in the distribution map
		distribution.AppVersion[appVersion] += count
		distribution.OSVersion[osVersion] += count
		distribution.Country[country] += count
		distribution.NetworkType[networkType] += count
		distribution.Locale[locale] += count
		distribution.Device[device] += count
	}

	err = rows.Err()

	return
}

// GetExceptionsWithFilter fetches exception events for a matching
// exception fingerprint. Also matches filters
// and handles pagination.
func (a App) GetExceptionsWithFilter(ctx context.Context, fingerprint string, af *filter.AppFilter) (events []event.EventException, next, previous bool, err error) {
	stmt := sqlf.From("events").
		Select("id").
		Select("type").
		Select("timestamp").
		Select("session_id").
		Select("attribute.app_version as app_version").
		Select("attribute.app_build as app_build").
		Select("attribute.device_manufacturer as device_manufacturer").
		Select("attribute.device_model as device_model").
		Select("attribute.network_type as network_type").
		Select("exception.exceptions as exceptions").
		Select("exception.threads as threads").
		Select("exception.framework as framework").
		Select("attachments").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("attribute.app_version in ?", af.Versions).
		Where("attribute.app_build in ?", af.VersionCodes).
		Where("type = ?", event.TypeException).
		Where("exception.fingerprint = ?", fingerprint).
		Where("exception.handled = false").
		Where("timestamp >= ? and timestamp <= ?", af.From, af.To)

	if af.HasOSVersions() {
		stmt.Where("attribute.os_name in ?", af.OsNames)
		stmt.Where("attribute.os_version in ?", af.OsVersions)
	}

	if af.HasCountries() {
		stmt.Where("inet.country_code in ?", af.Countries)
	}

	if af.HasDeviceNames() {
		stmt.Where("attribute.device_name in ?", af.DeviceNames)
	}

	if af.HasDeviceManufacturers() {
		stmt.Where("attribute.device_manufacturer in ?", af.DeviceManufacturers)
	}

	if af.HasDeviceLocales() {
		stmt.Where("attribute.device_locale in ?", af.Locales)
	}

	if af.HasNetworkTypes() {
		stmt.Where("attribute.network_type in ?", af.NetworkTypes)
	}

	if af.HasNetworkProviders() {
		stmt.Where("attribute.network_provider in ?", af.NetworkProviders)
	}

	if af.HasNetworkGenerations() {
		stmt.Where("attribute.network_generation in ?", af.NetworkGenerations)
	}

	if af.Limit > 0 {
		stmt.Limit(uint64(af.Limit) + 1)
	}

	if af.Offset >= 0 {
		stmt.Offset(uint64(af.Offset))
	}

	stmt.OrderBy("timestamp")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var e event.EventException
		var exceptions string
		var threads string
		var attachments string
		if err = rows.Scan(
			&e.ID,
			&e.Type,
			&e.Timestamp,
			&e.SessionID,
			&e.Attribute.AppVersion,
			&e.Attribute.AppBuild,
			&e.Attribute.DeviceManufacturer,
			&e.Attribute.DeviceModel,
			&e.Attribute.NetworkType,
			&exceptions,
			&threads,
			&e.Exception.Framework,
			&attachments,
		); err != nil {
			return
		}

		if err = json.Unmarshal([]byte(exceptions), &e.Exception.Exceptions); err != nil {
			return
		}

		if err = json.Unmarshal([]byte(threads), &e.Exception.Threads); err != nil {
			return
		}

		if err = json.Unmarshal([]byte(attachments), &e.Attachments); err != nil {
			return
		}

		e.ComputeView()
		events = append(events, e)
	}

	resultLen := len(events)

	// Set pagination next & previous flags
	if resultLen > af.Limit {
		events = events[:resultLen-1]
		next = true
	}

	if af.Offset > 0 {
		previous = true
	}

	return
}

// GetANRGroupPlotInstances computes crash instances of the exception group.
func (a App) GetANRGroupPlotInstances(ctx context.Context, fingerprint string, af *filter.AppFilter) (instances []event.IssueInstance, err error) {
	if af.Timezone == "" {
		return nil, errors.New("missing timezone filter")
	}

	if !af.HasPlotTimeGroup() {
		af.SetDefaultPlotTimeGroup()
	}

	groupExpr, err := getPlotTimeGroupExpr("timestamp", af.PlotTimeGroup)
	if err != nil {
		return nil, err
	}

	stmt := sqlf.
		From(`events`).
		Select(groupExpr.BucketExpr+" as datetime_bucket", af.Timezone).
		Select("formatDateTime(datetime_bucket, ?) as datetime", groupExpr.DatetimeFormat).
		Select("concat(attribute.app_version, ' ', '(', attribute.app_build,')') as version").
		Select("count(id) as instances").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("timestamp >= ? and timestamp <= ?", af.From, af.To).
		Where("type = ?", event.TypeANR).
		Where("anr.fingerprint = ?", fingerprint)

	if af.HasVersions() {
		stmt.Where("attribute.app_version").In(af.Versions)
		stmt.Where("attribute.app_build").In(af.VersionCodes)
	}

	if af.HasOSVersions() {
		stmt.Where("attribute.os_name").In(af.OsNames)
		stmt.Where("attribute.os_version").In(af.OsVersions)
	}

	if af.HasCountries() {
		stmt.Where("inet.country_code").In(af.Countries)
	}

	if af.HasNetworkProviders() {
		stmt.Where("attribute.network_provider").In(af.NetworkProviders)
	}

	if af.HasNetworkTypes() {
		stmt.Where("attribute.network_type").In(af.NetworkTypes)
	}

	if af.HasNetworkGenerations() {
		stmt.Where("attribute.network_generation").In(af.NetworkGenerations)
	}

	if af.HasDeviceLocales() {
		stmt.Where("attribute.device_locale").In(af.Locales)
	}

	if af.HasDeviceManufacturers() {
		stmt.Where("attribute.device_manufacturer").In(af.DeviceManufacturers)
	}

	if af.HasDeviceNames() {
		stmt.Where("attribute.device_name").In(af.DeviceNames)
	}

	stmt.GroupBy("version, datetime_bucket").
		OrderBy("version, datetime_bucket")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	defer rows.Close()

	for rows.Next() {
		var instance event.IssueInstance
		var datetimeBucket time.Time
		if err := rows.Scan(&datetimeBucket, &instance.DateTime, &instance.Version, &instance.Instances); err != nil {
			return nil, err
		}
		instances = append(instances, instance)
	}

	err = rows.Err()

	return
}

// GetANRPlotInstances queries aggregated exception
// instances and crash free sessions by datetime and filters.
func (a App) GetANRPlotInstances(ctx context.Context, af *filter.AppFilter) (issueInstances []event.IssueInstance, err error) {
	if af.Timezone == "" {
		return nil, errors.New("missing timezone filter")
	}

	if !af.HasPlotTimeGroup() {
		af.SetDefaultPlotTimeGroup()
	}

	groupExpr, err := getPlotTimeGroupExpr("timestamp", af.PlotTimeGroup)
	if err != nil {
		return nil, err
	}

	stmt := sqlf.
		From("events final").
		Select(groupExpr.BucketExpr+" as datetime_bucket", af.Timezone).
		Select("formatDateTime(datetime_bucket, ?) as datetime", groupExpr.DatetimeFormat).
		Select("concat(attribute.app_version, '', '(', attribute.app_build, ')') as app_version").
		Select("count() as total_anrs").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("timestamp >= ? and timestamp <= ?", af.From, af.To).
		Where("type = ?", event.TypeANR)

	defer stmt.Close()

	if af.HasVersions() {
		stmt.Where("attribute.app_version").In(af.Versions)
		stmt.Where("attribute.app_build").In(af.VersionCodes)
	}

	if af.HasOSVersions() {
		stmt.Where("attribute.os_name").In(af.OsNames)
		stmt.Where("attribute.os_version").In(af.OsVersions)
	}

	if af.HasCountries() {
		stmt.Where("inet.country_code").In(af.Countries)
	}

	if af.HasNetworkProviders() {
		stmt.Where("attribute.network_provider").In(af.NetworkProviders)
	}

	if af.HasNetworkTypes() {
		stmt.Where("attribute.network_type").In(af.NetworkTypes)
	}

	if af.HasNetworkGenerations() {
		stmt.Where("attribute.network_generation").In(af.NetworkGenerations)
	}

	if af.HasDeviceLocales() {
		stmt.Where("attribute.device_locale").In(af.Locales)
	}

	if af.HasDeviceManufacturers() {
		stmt.Where("attribute.device_manufacturer").In(af.DeviceManufacturers)
	}

	if af.HasDeviceNames() {
		stmt.Where("attribute.device_name").In(af.DeviceNames)
	}

	stmt.GroupBy("app_version, datetime_bucket").
		OrderBy("app_version, datetime_bucket")

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var instance event.IssueInstance
		var datetimeBucket time.Time
		if err := rows.Scan(&datetimeBucket, &instance.DateTime, &instance.Version, &instance.Instances); err != nil {
			return nil, err
		}

		if *instance.Instances > 0 {
			zero := float64(0)
			instance.IssueFreeSessions = &zero
			issueInstances = append(issueInstances, instance)
		}
	}

	err = rows.Err()

	return
}

// GetANRAttributesDistribution computes the data required for
// plotting crash attribute distribution.
func (a App) GetANRAttributesDistribution(ctx context.Context, fingerprint string, af *filter.AppFilter) (distribution event.IssueDistribution, err error) {
	stmt := sqlf.
		From("events").
		Select("concat(attribute.app_version, ' (', attribute.app_build, ')') as app_version").
		Select("concat(attribute.os_name, ' ', attribute.os_version) as os_version").
		Select("inet.country_code as country").
		Select("attribute.network_type as network_type").
		Select("attribute.device_locale as locale").
		Select("concat(attribute.device_manufacturer, ' - ', attribute.device_name) as device").
		Select("count(id) as count").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("anr.fingerprint = ?", fingerprint).
		Where("type = ?", event.TypeANR).
		Where("timestamp >= ? and timestamp <= ?", af.From, af.To).
		GroupBy("app_version").
		GroupBy("os_version").
		GroupBy("country").
		GroupBy("network_type").
		GroupBy("locale").
		GroupBy("device")

	if af.HasVersions() {
		stmt.Where("attribute.app_version").In(af.Versions)
		stmt.Where("attribute.app_build").In(af.VersionCodes)
	}

	if af.HasOSVersions() {
		stmt.Where("attribute.os_name").In(af.OsNames)
		stmt.Where("attribute.os_version").In(af.OsVersions)
	}

	if af.HasCountries() {
		stmt.Where("inet.country_code").In(af.Countries)
	}

	if af.HasNetworkTypes() {
		stmt.Where("attribute.network_type").In(af.NetworkTypes)
	}

	if af.HasNetworkProviders() {
		stmt.Where("attribute.network_provider").In(af.NetworkProviders)
	}

	if af.HasNetworkGenerations() {
		stmt.Where("attribute.network_generation").In(af.NetworkGenerations)
	}

	if af.HasDeviceLocales() {
		stmt.Where("attribute.device_locale").In(af.Locales)
	}

	if af.HasDeviceManufacturers() {
		stmt.Where("attribute.device_manufacturer").In(af.DeviceManufacturers)
	}

	if af.HasDeviceNames() {
		stmt.Where("attribute.device_name").In(af.DeviceNames)
	}

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	defer rows.Close()

	distribution.AppVersion = make(map[string]uint64)
	distribution.OSVersion = make(map[string]uint64)
	distribution.Country = make(map[string]uint64)
	distribution.NetworkType = make(map[string]uint64)
	distribution.Locale = make(map[string]uint64)
	distribution.Device = make(map[string]uint64)

	// Parse each row in the result set.
	for rows.Next() {
		var (
			appVersion  string
			osVersion   string
			country     string
			networkType string
			locale      string
			device      string
			count       uint64
		)

		if err = rows.Scan(&appVersion, &osVersion, &country, &networkType, &locale, &device, &count); err != nil {
			return
		}

		// Update counts in the distribution map
		distribution.AppVersion[appVersion] += count
		distribution.OSVersion[osVersion] += count
		distribution.Country[country] += count
		distribution.NetworkType[networkType] += count
		distribution.Locale[locale] += count
		distribution.Device[device] += count
	}

	err = rows.Err()

	return
}

// GetANRGroupsWithFilter fetches ANR groups of an app.
func (a App) GetANRGroupsWithFilter(ctx context.Context, af *filter.AppFilter) (groups []group.ANRGroup, next, previous bool, err error) {
	stmt := sqlf.
		From("anr_groups final").
		Select("app_id").
		Select("id").
		Select("argMax(type, timestamp)").
		Select("argMax(message, timestamp)").
		Select("argMax(method_name, timestamp)").
		Select("argMax(file_name, timestamp)").
		Select("argMax(line_number, timestamp)").
		Select("max(timestamp)").
		Select("sumMerge(count) as event_count").
		Select("round((event_count * 100.0) / sum(event_count) over (), 2) as contribution").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		// Capture all the exception groups that received new exceptions
		// after the "from" date & were created before the "to" date.
		Where("timestamp >= ? and timestamp <= ?", af.From, af.To).
		GroupBy("team_id").
		GroupBy("app_id").
		GroupBy("id").
		// Don't consider exception groups that do not
		// have any exception events yet.
		// Also avoids division by zero errors.
		Having("event_count > 0").
		OrderBy("event_count desc")

	if af.HasVersions() {
		stmt.Where("app_version.1 in ?", af.Versions)
		stmt.Where("app_version.2 in ?", af.VersionCodes)
	}

	if af.HasOSVersions() {
		osVersions, errOSVersions := af.OSVersionPairs()
		if errOSVersions != nil {
			err = errOSVersions
			return
		}

		stmt.Having("hasAll(groupUniqArrayMerge(os_versions), [?])", osVersions.Parameterize())
	}

	if af.HasCountries() {
		stmt.Having("hasAll(groupUniqArrayMerge(countries), ?)", af.Countries)
	}

	if af.HasNetworkProviders() {
		stmt.Having("hasAll(groupUniqArrayMerge(network_providers), ?)", af.NetworkProviders)
	}

	if af.HasNetworkTypes() {
		stmt.Having("hasAll(groupUniqArrayMerge(network_types), ?)", af.NetworkTypes)
	}

	if af.HasNetworkGenerations() {
		stmt.Having("hasAll(groupUniqArrayMerge(network_generations), ?)", af.NetworkGenerations)
	}

	if af.HasDeviceLocales() {
		stmt.Having("hasAll(groupUniqArrayMerge(device_locales), ?)", af.Locales)
	}

	if af.HasDeviceManufacturers() {
		stmt.Having("hasAll(groupUniqArrayMerge(device_manufacturers), ?)", af.DeviceManufacturers)
	}

	if af.HasDeviceNames() {
		stmt.Having("hasAll(groupUniqArrayMerge(device_names), ?)", af.DeviceNames)
	}

	if af.Limit > 0 {
		stmt.Limit(uint64(af.Limit) + 1)
	}

	if af.Offset >= 0 {
		stmt.Offset(uint64(af.Offset))
	}

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	defer rows.Close()

	if err = rows.Err(); err != nil {
		return
	}

	for rows.Next() {
		var g group.ANRGroup
		if err = rows.Scan(
			&g.AppID,
			&g.ID,
			&g.Type,
			&g.Message,
			&g.MethodName,
			&g.FileName,
			&g.LineNumber,
			&g.UpdatedAt,
			&g.Count,
			&g.Percentage,
		); err != nil {
			return
		}

		groups = append(groups, g)
	}

	resultLen := len(groups)

	// Set pagination next & previous flags
	if resultLen > af.Limit {
		groups = groups[:resultLen-1]
		next = true
	}

	if af.Offset > 0 {
		previous = true
	}
	return
}

// GetANRsWithFilter fetches ANR events for a matching ANR fingerprint.
// Also matches filters and handles pagination.
func (a App) GetANRsWithFilter(ctx context.Context, fingerprint string, af *filter.AppFilter) (events []event.EventANR, next, previous bool, err error) {
	stmt := sqlf.From("events").
		Select("id").
		Select("type").
		Select("timestamp").
		Select("session_id").
		Select("attribute.app_version as app_version").
		Select("attribute.app_build as app_build").
		Select("attribute.device_manufacturer as device_manufacturer").
		Select("attribute.device_model as device_model").
		Select("attribute.network_type as network_type").
		Select("anr.exceptions as exceptions").
		Select("anr.threads as threads").
		Select("attachments").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("attribute.app_version in ?", af.Versions).
		Where("attribute.app_build in ?", af.VersionCodes).
		Where("type = ?", event.TypeANR).
		Where("anr.fingerprint = ?", fingerprint).
		Where("timestamp >= ? and timestamp <= ?", af.From, af.To)

	if af.HasOSVersions() {
		stmt.Where("attribute.os_name in ?", af.OsNames)
		stmt.Where("attribute.os_version in ?", af.OsVersions)
	}

	if af.HasCountries() {
		stmt.Where("inet.country_code in ?", af.Countries)
	}

	if af.HasDeviceNames() {
		stmt.Where("attribute.device_name in ?", af.DeviceNames)
	}

	if af.HasDeviceManufacturers() {
		stmt.Where("attribute.device_manufacturer in ?", af.DeviceManufacturers)
	}

	if af.HasDeviceLocales() {
		stmt.Where("attribute.device_locale in ?", af.Locales)
	}

	if af.HasNetworkTypes() {
		stmt.Where("attribute.network_type in ?", af.NetworkTypes)
	}

	if af.HasNetworkProviders() {
		stmt.Where("attribute.network_provider in ?", af.NetworkProviders)
	}

	if af.HasNetworkGenerations() {
		stmt.Where("attribute.network_generation in ?", af.NetworkGenerations)
	}

	if af.Limit > 0 {
		stmt.Limit(uint64(af.Limit) + 1)
	}

	if af.Offset >= 0 {
		stmt.Offset(uint64(af.Offset))
	}

	stmt.OrderBy("timestamp")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var e event.EventANR
		var exceptions string
		var threads string
		var attachments string
		if err = rows.Scan(
			&e.ID,
			&e.Type,
			&e.Timestamp,
			&e.SessionID,
			&e.Attribute.AppVersion,
			&e.Attribute.AppBuild,
			&e.Attribute.DeviceManufacturer,
			&e.Attribute.DeviceModel,
			&e.Attribute.NetworkType,
			&exceptions,
			&threads,
			&attachments,
		); err != nil {
			return
		}

		if err = json.Unmarshal([]byte(exceptions), &e.ANR.Exceptions); err != nil {
			return
		}

		if err = json.Unmarshal([]byte(threads), &e.ANR.Threads); err != nil {
			return
		}

		if err = json.Unmarshal([]byte(attachments), &e.Attachments); err != nil {
			return
		}

		e.ComputeView()
		events = append(events, e)
	}

	resultLen := len(events)

	// Set pagination next & previous flags
	if resultLen > af.Limit {
		events = events[:resultLen-1]
		next = true
	}

	if af.Offset > 0 {
		previous = true
	}

	return
}

// GetSizeMetrics computes app size of the selected app version
// and delta size change between app size of the selected app version
// and average size of unselected app versions.
//
// Computation bails out if there are no events for selected app
// version.
func (a App) GetSizeMetrics(ctx context.Context, af *filter.AppFilter, versions filter.Versions) (size *metrics.SizeMetric, err error) {
	size = &metrics.SizeMetric{}

	// bail out if app has not been onboarded
	if !a.Onboarded {
		size.SetNaNs()
		return
	}

	avgSizeStmt := sqlf.PostgreSQL.
		From("build_sizes").
		Select("round(coalesce(avg(build_size), 2), 0) as average_size").
		Where("app_id = ?", af.AppID)

	if versions.HasVersions() {
		var names []any
		var codes []any

		for _, v := range versions.Versions() {
			names = append(names, v)
		}

		for _, v := range versions.Codes() {
			codes = append(codes, v)
		}

		avgSizeStmt.
			Where("version_name").In(names...).
			Where("version_code").In(codes...)
	}

	sizeStmt := sqlf.PostgreSQL.
		With("avg_size", avgSizeStmt).
		Select("t1.average_size as average_app_size").
		Select("t2.build_size as selected_app_size").
		Select("(t2.build_size - t1.average_size) as delta").
		From("avg_size as t1 cross join build_sizes as t2").
		Where("app_id = ?", af.AppID).
		Where("version_name = ?", af.Versions[0]).
		Where("version_code = ?", af.VersionCodes[0])

	defer sizeStmt.Close()

	if err := server.Server.PgPool.QueryRow(ctx, sizeStmt.String(), sizeStmt.Args()...).Scan(&size.AverageAppSize, &size.SelectedAppSize, &size.Delta); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		} else {
			return nil, err
		}
	}

	return
}

// GetIssueFreeMetrics computes crash and anr free sessions
// percentage and its deltas.
//
// - Crash free sessions
// - Perceived crash free sessions
// - ANR free sessions
// - Perceived ANR free sessions
func (a App) GetIssueFreeMetrics(
	ctx context.Context,
	af *filter.AppFilter,
	unselectedVersions filter.Versions,
) (
	crashFree *metrics.CrashFreeSession,
	perceivedCrashFree *metrics.PerceivedCrashFreeSession,
	anrFree *metrics.ANRFreeSession,
	perceivedANRFree *metrics.PerceivedANRFreeSession,
	err error,
) {
	crashFree = &metrics.CrashFreeSession{}
	perceivedCrashFree = &metrics.PerceivedCrashFreeSession{}

	switch a.OSName {
	case opsys.Android:
		anrFree = &metrics.ANRFreeSession{}
		perceivedANRFree = &metrics.PerceivedANRFreeSession{}
	}

	selectedVersions, err := af.VersionPairs()
	if err != nil {
		return
	}

	stmt := sqlf.From(config.AppMetricsTable).
		Select("uniqMergeIf(unique_sessions, app_version in (?)) as selected_sessions", selectedVersions.Parameterize()).
		Select("uniqMergeIf(unique_sessions, app_version not in (?)) as unselected_sessions", selectedVersions.Parameterize()).
		Select("uniqMergeIf(crash_sessions, app_version in (?)) as selected_crash_sessions", selectedVersions.Parameterize()).
		Select("uniqMergeIf(crash_sessions, app_version not in (?)) as unselected_crash_sessions", selectedVersions.Parameterize()).
		Select("uniqMergeIf(perceived_crash_sessions, app_version in (?)) as selected_perceived_crash_sessions", selectedVersions.Parameterize()).
		Select("uniqMergeIf(perceived_crash_sessions, app_version not in (?)) as unselected_perceived_crash_sessions", selectedVersions.Parameterize())

	switch a.OSName {
	case opsys.Android:
		stmt.
			Select("uniqMergeIf(anr_sessions, app_version in (?)) as selected_anr_sessions", selectedVersions.Parameterize()).
			Select("uniqMergeIf(anr_sessions, app_version not in (?)) as unselected_anr_sessions", selectedVersions.Parameterize()).
			Select("uniqMergeIf(perceived_anr_sessions, app_version in (?)) as selected_perceived_anr_sessions", selectedVersions.Parameterize()).
			Select("uniqMergeIf(perceived_anr_sessions, app_version not in (?)) as unselected_perceived_anr_sessions", selectedVersions.Parameterize())
	}

	stmt.
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", af.AppID).
		Where("timestamp >= ? and timestamp <= ?", af.From, af.To)

	defer stmt.Close()

	var (
		selected, unselected                             uint64
		crashSelected, crashUnselected                   uint64
		perceivedCrashSelected, perceivedCrashUnselected uint64
		anrSelected, anrUnselected                       uint64
		perceivedANRSelected, perceivedANRUnselected     uint64
		crashFreeUnselected                              float64
		perceivedCrashFreeUnselected                     float64
		anrFreeUnselected                                float64
		perceivedANRFreeUnselected                       float64
	)

	dest := []any{
		&selected,
		&unselected,
		&crashSelected,
		&crashUnselected,
		&perceivedCrashSelected,
		&perceivedCrashUnselected,
	}

	switch a.OSName {
	case opsys.Android:
		dest = append(dest, &anrSelected, &anrUnselected, &perceivedANRSelected, &perceivedANRUnselected)
	}

	if err = server.Server.ChPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(dest...); err != nil {
		return
	}

	if selected == 0 {
		crashFree.CrashFreeSessions = math.NaN()
		perceivedCrashFree.CrashFreeSessions = math.NaN()

		switch a.OSName {
		case opsys.Android:
			anrFree.ANRFreeSessions = math.NaN()
			perceivedANRFree.ANRFreeSessions = math.NaN()
		}
	} else {
		crashFree.CrashFreeSessions = numeric.RoundTwoDecimalsFloat64((1 - (float64(crashSelected) / float64(selected))) * 100)
		perceivedCrashFree.CrashFreeSessions = numeric.RoundTwoDecimalsFloat64((1 - (float64(perceivedCrashSelected) / float64(selected))) * 100)

		switch a.OSName {
		case opsys.Android:
			anrFree.ANRFreeSessions = numeric.RoundTwoDecimalsFloat64((1 - (float64(anrSelected) / float64(selected))) * 100)
			perceivedANRFree.ANRFreeSessions = numeric.RoundTwoDecimalsFloat64((1 - (float64(perceivedANRSelected) / float64(selected))) * 100)
		}
	}

	if unselected == 0 {
		crashFreeUnselected = math.NaN()
		perceivedCrashFreeUnselected = math.NaN()

		switch a.OSName {
		case opsys.Android:
			anrFreeUnselected = math.NaN()
			perceivedANRFreeUnselected = math.NaN()
		}
	} else {
		crashFreeUnselected = numeric.RoundTwoDecimalsFloat64((1 - (float64(crashUnselected) / float64(unselected))) * 100)
		perceivedCrashFreeUnselected = numeric.RoundTwoDecimalsFloat64((1 - (float64(perceivedCrashUnselected) / float64(unselected))) * 100)

		switch a.OSName {
		case opsys.Android:
			anrFreeUnselected = numeric.RoundTwoDecimalsFloat64((1 - (float64(anrUnselected) / float64(unselected))) * 100)
			perceivedANRFreeUnselected = numeric.RoundTwoDecimalsFloat64((1 - (float64(perceivedANRUnselected) / float64(unselected))) * 100)
		}
	}

	// compute delta
	if unselectedVersions.HasVersions() {
		// avoid division by zero
		if crashFreeUnselected != 0 {
			// Round to two decimal places
			crashFree.Delta = numeric.RoundTwoDecimalsFloat64(crashFree.CrashFreeSessions / crashFreeUnselected)
		} else {
			crashFree.Delta = 1
		}

		if perceivedCrashFreeUnselected != 0 {
			crashFree.Delta = numeric.RoundTwoDecimalsFloat64(perceivedCrashFree.CrashFreeSessions / perceivedCrashFreeUnselected)
		} else {
			perceivedCrashFree.Delta = 1
		}

		switch a.OSName {
		case opsys.Android:
			if anrFreeUnselected != 0 {
				anrFree.Delta = numeric.RoundTwoDecimalsFloat64(anrFree.ANRFreeSessions / anrFreeUnselected)
			} else {
				anrFree.Delta = 1
			}

			if perceivedANRFreeUnselected != 0 {
				perceivedANRFree.Delta = numeric.RoundTwoDecimalsFloat64(perceivedANRFree.ANRFreeSessions / perceivedANRFreeUnselected)
			} else {
				perceivedANRFree.Delta = 1
			}
		}

	} else {
		// because if there are no unselected
		// app versions, then:
		// crash free sessions of unselected app versions = crash free sessions of selected app versions
		// ratio between the two, will be always 1
		if crashFree.CrashFreeSessions != 0 {
			crashFree.Delta = 1
		}

		if perceivedCrashFree.CrashFreeSessions != 0 {
			perceivedCrashFree.Delta = 1
		}

		switch a.OSName {
		case opsys.Android:
			if anrFree.ANRFreeSessions != 0 {
				anrFree.Delta = 1
			}

			if perceivedANRFree.ANRFreeSessions != 0 {
				perceivedANRFree.Delta = 1
			}
		}
	}

	crashFree.SetNaNs()
	perceivedCrashFree.SetNaNs()

	switch a.OSName {
	case opsys.Android:
		anrFree.SetNaNs()
		perceivedANRFree.SetNaNs()
	}

	return
}

// GetAdoptionMetrics computes adoption by computing sessions
// for selected versions and sessions of all versions for an app.
func (a App) GetAdoptionMetrics(ctx context.Context, af *filter.AppFilter) (adoption *metrics.SessionAdoption, err error) {
	adoption = &metrics.SessionAdoption{}
	selectedVersions, err := af.VersionPairs()
	if err != nil {
		return
	}

	stmt := sqlf.From(config.AppMetricsTable).
		Select("uniqMergeIf(unique_sessions, app_version in (?)) as selected_sessions", selectedVersions.Parameterize()).
		Select("uniqMerge(unique_sessions) as all_sessions").
		Select("round((selected_sessions / all_sessions) * 100, 2) as adoption").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", af.AppID).
		Where("timestamp >= ? and timestamp <= ?", af.From, af.To)

	defer stmt.Close()

	if err = server.Server.ChPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&adoption.SelectedVersion, &adoption.AllVersions, &adoption.Adoption); err != nil {
		return
	}

	adoption.SetNaNs()

	return
}

// GetLaunchMetrics computes cold, warm and hot launch quantiles
// and deltas while respecting all applicable app filters.
// Deltas are computed between launch metric values of selected and
// unselected app versions.
func (a App) GetLaunchMetrics(ctx context.Context, af *filter.AppFilter) (launch *metrics.LaunchMetric, err error) {
	launch = &metrics.LaunchMetric{}

	selectedVersions, err := af.VersionPairs()

	withStmt := sqlf.From(config.AppMetricsTable).
		Select("quantileMergeIf(0.95)(cold_launch_p95, app_version not in (?)) as cold_launch_p95", selectedVersions.Parameterize()).
		Select("quantileMergeIf(0.95)(warm_launch_p95, app_version not in (?)) as warm_launch_p95", selectedVersions.Parameterize()).
		Select("quantileMergeIf(0.95)(hot_launch_p95, app_version not in (?)) as hot_launch_p95", selectedVersions.Parameterize()).
		Where("app_id = toUUID(?)", af.AppID).
		Where("timestamp >= ? and timestamp <= ?", af.From, af.To)

	defer withStmt.Close()

	stmt := sqlf.New(fmt.Sprintf("with (%s) as unselected select", withStmt.String()), withStmt.Args()...).
		Select("round(quantileMergeIf(0.95)(cold_launch_p95, app_version in (?)), 2) as selected_cold_launch_p95", selectedVersions.Parameterize()).
		Select("round(quantileMergeIf(0.95)(warm_launch_p95, app_version in (?)), 2) as selected_warm_launch_p95", selectedVersions.Parameterize()).
		Select("round(quantileMergeIf(0.95)(hot_launch_p95, app_version in (?)), 2) as selected_hot_launch_p95", selectedVersions.Parameterize()).
		Select("round((selected_cold_launch_p95 / unselected.cold_launch_p95), 2) as cold_delta").
		Select("round((selected_warm_launch_p95 / unselected.warm_launch_p95), 2) as warm_delta").
		Select("round((selected_hot_launch_p95 / unselected.hot_launch_p95), 2) as hot_delta").
		From(config.AppMetricsTable).
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", af.AppID).
		Where("timestamp >= ? and timestamp <= ?", af.From, af.To)

	defer stmt.Close()

	if err = server.Server.ChPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(
		&launch.ColdLaunchP95,
		&launch.WarmLaunchP95,
		&launch.HotLaunchP95,
		&launch.ColdDelta,
		&launch.WarmDelta,
		&launch.HotDelta,
	); err != nil {
		return
	}

	launch.SetNaNs()

	return
}

// GetSessionsInstancesPlot provides aggregated session instances
// matching various filters.
func (a App) GetSessionsInstancesPlot(ctx context.Context, af *filter.AppFilter) (sessionInstances []session.SessionInstance, err error) {
	if af.Timezone == "" {
		return nil, errors.New("missing timezone filter")
	}

	if !af.HasPlotTimeGroup() {
		af.SetDefaultPlotTimeGroup()
	}

	groupExpr, err := getPlotTimeGroupExpr("start_time", af.PlotTimeGroup)
	if err != nil {
		return nil, err
	}

	base := sqlf.From("sessions").
		Select("session_id").
		Select("min(first_event_timestamp) as start_time").
		Select("app_version").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("first_event_timestamp >= ? and last_event_timestamp <= ?", af.From, af.To)

	if af.HasFreeText() {
		base.
			Select("groupUniqArrayArray(user_ids) as user_ids").
			Select("groupUniqArrayArray(unique_types) as unique_types").
			Select("groupUniqArrayArray(unique_custom_type_names) as unique_custom_type_names").
			Select("groupUniqArrayArray(unique_strings) as unique_strings").
			Select("groupUniqArrayArray(unique_view_classnames) as unique_view_classnames").
			Select("groupUniqArrayArray(unique_subview_classnames) as unique_subview_classnames").
			Select("groupUniqArrayArray(unique_unhandled_exceptions) as unique_unhandled_exceptions").
			Select("groupUniqArrayArray(unique_handled_exceptions) as unique_handled_exceptions").
			Select("groupUniqArrayArray(unique_errors) as unique_errors").
			Select("groupUniqArrayArray(unique_anrs) as unique_anrs").
			Select("groupUniqArrayArray(unique_click_targets) as unique_click_targets").
			Select("groupUniqArrayArray(unique_longclick_targets) as unique_longclick_targets").
			Select("groupUniqArrayArray(unique_scroll_targets) as unique_scroll_targets")
	}

	if af.HasVersions() {
		// critical to filter on individual columns to hit
		// binary search using primary key(s)
		base.Where("app_version.1 in ?", af.Versions)
		base.Where("app_version.2 in ?", af.VersionCodes)
	}

	// Timeline selection parameters
	//
	// Allow the user to mix & match fine-grained
	// timeline selection parameters.
	{
		orExprs := []string{}
		andExprs := []string{}

		if af.Crash {
			orExprs = append(orExprs, "crash_count >= 1")
		}

		if af.ANR {
			orExprs = append(orExprs, "anr_count >= 1")
		}

		if af.BugReport {
			orExprs = append(orExprs, "bug_report_count >= 1")
		}

		// wrap the entire condition in parenthesis as
		// to evaluate as a whole
		if af.UserInteraction {
			orExprs = append(orExprs, "(event_type_counts['gesture_click'] >= 1 or event_type_counts['gesture_long_click'] >= 1 or event_type_counts['gesture_scroll'] >= 1)")
		}

		// only apply background or foreground as AND
		// if either of them are true
		//
		// background or foreground inclusion is orthogonal
		// to the rest of the filters like crash, anr, bug_report or user_interaction.
		//
		// if both background and foreground are true, then
		// we don't need to filter, inlcude everything
		if af.Background != af.Foreground {
			if af.Foreground {
				andExprs = append(andExprs, "foreground_count >= 1")
			}
			if af.Background {
				andExprs = append(andExprs, "background_count >= 1")
			}
		}

		if len(orExprs) > 0 {
			cond := strings.Join(orExprs, " or ")
			base.Where("(" + cond + ")")
		}

		if len(andExprs) > 0 {
			cond := strings.Join(andExprs, " and ")
			base.Where("(" + cond + ")")
		}
	}

	if af.HasOSVersions() {
		selectedOSVersions, err := af.OSVersionPairs()
		if err != nil {
			return nil, err
		}

		base.Where("os_version in (?)", selectedOSVersions.Parameterize())
	}

	if af.HasCountries() {
		base.Where("hasAll(country_codes, ?)", af.Countries)
	}

	if af.HasNetworkProviders() {
		base.Where("hasAll(network_providers, ?)", af.NetworkProviders)
	}

	if af.HasNetworkTypes() {
		base.Where("hasAll(network_types, ?)", af.NetworkTypes)
	}

	if af.HasNetworkGenerations() {
		base.Where("hasAll(network_generations, ?)", af.NetworkGenerations)
	}

	if af.HasDeviceLocales() {
		base.Where("hasAll(device_locales, ?)", af.Locales)
	}

	if af.HasDeviceManufacturers() {
		base.Where("device_manufacturer").In(af.DeviceManufacturers)
	}

	if af.HasDeviceNames() {
		base.Where("device_name").In(af.DeviceNames)
	}

	if af.HasUDExpression() && !af.UDExpression.Empty() {
		subQuery := sqlf.
			From("user_def_attrs").
			Select("session_id").
			Where("team_id = toUUID(?)", a.TeamId).
			Where("app_id = toUUID(?)", a.ID).
			Where("timestamp >= ? and timestamp <= ?", af.From, af.To)

		if af.HasVersions() {
			base.Where("app_version.1 in ?", af.Versions)
			base.Where("app_version.2 in ?", af.VersionCodes)
		}

		if af.HasOSVersions() {
			selectedOSVersions, err := af.OSVersionPairs()
			if err != nil {
				return nil, err
			}

			base.Where("os_version in (?)", selectedOSVersions.Parameterize())
		}

		af.UDExpression.Augment(subQuery)
		subQuery.GroupBy("session_id")
		base.SubQuery("session_id in (", ")", subQuery)
	}

	base.
		GroupBy("session_id").
		GroupBy("app_version")

	stmt := sqlf.
		With("base", base).
		From("base").
		Select("count() as instances").
		Select(groupExpr.BucketExpr+" as datetime_bucket", af.Timezone).
		Select("formatDateTime(datetime_bucket, ?) as datetime", groupExpr.DatetimeFormat).
		Select("concat(app_version.1, ' ', '(', app_version.2, ')') as app_version_fmt").
		GroupBy("app_version, datetime_bucket").
		OrderBy("datetime_bucket, app_version.2 desc")

	defer stmt.Close()

	// filter sessions that partially match the user
	// supplied keyword inside various session events.
	//
	// matches user id & session id exactly, not partially.
	if af.HasFreeText() {
		partial := fmt.Sprintf("%%%s%%", af.FreeText)

		stmtMatch := sqlf.
			New("").
			SubQuery("(", ")", sqlf.
				New("").
				Clause("arrayExists(x -> x ilike ?, user_ids)", af.FreeText).
				Clause("or").
				Clause("toString(session_id) ilike ?", af.FreeText).
				Clause("or").
				Clause("arrayExists(x -> x ilike ?, unique_types)", partial).
				Clause("or").
				Clause("arrayExists(x -> x ilike ?, unique_custom_type_names)", partial).
				Clause("or").
				Clause("arrayExists(x -> x ilike ?, unique_strings)", partial).
				Clause("or").
				Clause("arrayExists(x -> x ilike ?, unique_view_classnames)", partial).
				Clause("or").
				Clause("arrayExists(x -> x ilike ?, unique_subview_classnames)", partial).
				Clause("or").
				Clause("arrayExists(x -> (x.type ilike ? or x.message ilike ? or x.file_name ilike ? or x.class_name ilike ? or x.method_name ilike ?), unique_unhandled_exceptions)", slices.Repeat([]any{partial}, 5)...).
				Clause("or").
				Clause("arrayExists(x -> (x.type ilike ? or x.message ilike ? or x.file_name ilike ? or x.class_name ilike ? or x.method_name ilike ?), unique_handled_exceptions)", slices.Repeat([]any{partial}, 5)...).
				Clause("or").
				Clause("arrayExists(x -> x ilike ?, unique_errors)", partial).
				Clause("or").
				Clause("arrayExists(x -> (x.type ilike ? or x.message ilike ? or x.file_name ilike ? or x.class_name ilike ? or x.method_name ilike ?), unique_anrs)", slices.Repeat([]any{partial}, 5)...).
				Clause("or").
				Clause("arrayExists(x -> (x.1 ilike ? or x.2 ilike ?), unique_click_targets)", partial, partial).
				Clause("or").
				Clause("arrayExists(x -> (x.1 ilike ? or x.2 ilike ?), unique_longclick_targets)", partial, partial).
				Clause("or").
				Clause("arrayExists(x -> (x.1 ilike ? or x.2 ilike ?), unique_scroll_targets)", partial, partial),
			)

		stmt.Where(stmtMatch.String(), stmtMatch.Args()...)
	}

	rows, err := server.Server.RchPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var sessionInstance session.SessionInstance
		var datetimeBucket time.Time
		if err = rows.Scan(&sessionInstance.Instances, &datetimeBucket, &sessionInstance.DateTime, &sessionInstance.Version); err != nil {
			return
		}

		sessionInstances = append(sessionInstances, sessionInstance)
	}

	err = rows.Err()

	return
}

// GetSessionsWithFilter provides sessions that matches various
// filter criteria in a paginated fashion.
func (a App) GetSessionsWithFilter(ctx context.Context, af *filter.AppFilter) (sessions []SessionDisplay, next, previous bool, err error) {
	base := sqlf.
		From("sessions").
		Select("session_id").
		Select("app_version.1 as app_version_major").
		Select("app_version.2 as app_version_minor").
		Select("device_name").
		Select("device_model").
		Select("device_manufacturer").
		Select("os_version.1 as os_version_major").
		Select("os_version.2 as os_version_minor").
		Select("min(first_event_timestamp) as start_time").
		Select("max(last_event_timestamp) as end_time").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("first_event_timestamp >= ? and last_event_timestamp <= ?", af.From, af.To)

	if af.HasFreeText() {
		base.
			Select("groupUniqArrayArray(user_ids) as user_ids").
			Select("groupUniqArrayArray(unique_types) as unique_types").
			Select("groupUniqArrayArray(unique_custom_type_names) as unique_custom_type_names").
			Select("groupUniqArrayArray(unique_strings) as unique_strings").
			Select("groupUniqArrayArray(unique_view_classnames) as unique_view_classnames").
			Select("groupUniqArrayArray(unique_subview_classnames) as unique_subview_classnames").
			Select("groupUniqArrayArray(unique_unhandled_exceptions) as unique_unhandled_exceptions").
			Select("groupUniqArrayArray(unique_handled_exceptions) as unique_handled_exceptions").
			Select("groupUniqArrayArray(unique_errors) as unique_errors").
			Select("groupUniqArrayArray(unique_anrs) as unique_anrs").
			Select("groupUniqArrayArray(unique_click_targets) as unique_click_targets").
			Select("groupUniqArrayArray(unique_longclick_targets) as unique_longclick_targets").
			Select("groupUniqArrayArray(unique_scroll_targets) as unique_scroll_targets")
	}

	if af.HasVersions() {
		// critical to filter on individual columns to hit
		// binary search using primary key(s)
		base.Where("app_version.1 in ?", af.Versions)
		base.Where("app_version.2 in ?", af.VersionCodes)
	}

	// Timeline selection parameters
	//
	// Allow the user to mix & match fine-grained
	// timeline selection parameters.
	{
		orExprs := []string{}
		andExprs := []string{}

		if af.Crash {
			orExprs = append(orExprs, "crash_count >= 1")
		}

		if af.ANR {
			orExprs = append(orExprs, "anr_count >= 1")
		}

		if af.BugReport {
			orExprs = append(orExprs, "bug_report_count >= 1")
		}

		// wrap the entire condition in parenthesis as
		// to evaluate as a whole
		if af.UserInteraction {
			orExprs = append(orExprs, "(event_type_counts['gesture_click'] >= 1 or event_type_counts['gesture_long_click'] >= 1 or event_type_counts['gesture_scroll'] >= 1)")
		}

		// only apply background or foreground as AND
		// if either of them are true
		//
		// background or foreground inclusion is orthogonal
		// to the rest of the filters like crash, anr, bug_report or user_interaction.
		//
		// if both background and foreground are true, then
		// we don't need to filter, inlcude everything
		if af.Background != af.Foreground {
			if af.Foreground {
				andExprs = append(andExprs, "foreground_count >= 1")
			}
			if af.Background {
				andExprs = append(andExprs, "background_count >= 1")
			}
		}

		if len(orExprs) > 0 {
			cond := strings.Join(orExprs, " or ")
			base.Where("(" + cond + ")")
		}

		if len(andExprs) > 0 {
			cond := strings.Join(andExprs, " and ")
			base.Where("(" + cond + ")")
		}
	}

	if af.HasOSVersions() {
		selectedOSVersions, err := af.OSVersionPairs()
		if err != nil {
			return sessions, next, previous, err
		}

		base.Where("os_version in (?)", selectedOSVersions.Parameterize())
	}

	if af.HasCountries() {
		base.Where("hasAll(country_codes, ?)", af.Countries)
	}

	if af.HasNetworkProviders() {
		base.Where("hasAll(network_providers, ?)", af.NetworkProviders)
	}

	if af.HasNetworkTypes() {
		base.Where("hasAll(network_types, ?)", af.NetworkTypes)
	}

	if af.HasNetworkGenerations() {
		base.Where("hasAll(network_generations, ?)", af.NetworkGenerations)
	}

	if af.HasDeviceLocales() {
		base.Where("hasAll(device_locales, ?)", af.Locales)
	}

	if af.HasDeviceManufacturers() {
		base.Where("device_manufacturer").In(af.DeviceManufacturers)
	}

	if af.HasDeviceNames() {
		base.Where("device_name").In(af.DeviceNames)
	}

	if af.HasUDExpression() && !af.UDExpression.Empty() {
		subQuery := sqlf.
			From("user_def_attrs").
			Select("session_id").
			Where("team_id = toUUID(?)", a.TeamId).
			Where("app_id = toUUID(?)", a.ID).
			Where("timestamp >= ? and timestamp <= ?", af.From, af.To)

		if af.HasVersions() {
			base.Where("app_version.1 in ?", af.Versions)
			base.Where("app_version.2 in ?", af.VersionCodes)
		}

		if af.HasOSVersions() {
			selectedOSVersions, err := af.OSVersionPairs()
			if err != nil {
				return sessions, next, previous, err
			}

			base.Where("os_version in (?)", selectedOSVersions.Parameterize())
		}

		af.UDExpression.Augment(subQuery)
		subQuery.GroupBy("session_id")
		base.SubQuery("session_id in (", ")", subQuery)
	}

	base.
		GroupBy("session_id").
		GroupBy("app_version").
		GroupBy("os_version").
		GroupBy("device_name").
		GroupBy("device_model").
		GroupBy("device_manufacturer")

	stmt := sqlf.With("base", base).
		From("base").
		Select("session_id").
		Select("app_version_major").
		Select("app_version_minor").
		Select("os_version_major").
		Select("os_version_minor").
		Select("device_name").
		Select("device_model").
		Select("device_manufacturer").
		Select("start_time").
		Select("end_time").

		// show latest sessions on top
		OrderBy("start_time desc").

		// if start_time is same for two
		// consecutive sessions in order
		// use session_id as a tie-breaker
		//
		// clickhouse sorts UUIDs lexicographically
		// so, the resultant order doesn't matter so
		// long there is an order.
		OrderBy("session_id desc")

	defer stmt.Close()

	// paginate
	{
		if af.Limit > 0 {
			stmt.Limit(uint64(af.Limit) + 1)
		}

		if af.Offset >= 0 {
			stmt.Offset(uint64(af.Offset))
		}
	}

	// filter sessions that partially match the user
	// supplied keyword inside various session events.
	//
	// matches user id & session id exactly, not partially.
	if af.HasFreeText() {
		partial := fmt.Sprintf("%%%s%%", af.FreeText)

		stmtMatch := sqlf.
			New("").
			SubQuery("(", ")", sqlf.
				New("").
				Clause("arrayExists(x -> x like ?, user_ids)", af.FreeText).
				Clause("or").
				Clause("toString(session_id) like ?", af.FreeText).
				Clause("or").
				Clause("arrayExists(x -> x like ?, unique_types)", partial).
				Clause("or").
				Clause("arrayExists(x -> x like ?, unique_custom_type_names)", partial).
				Clause("or").
				Clause("arrayExists(x -> x ilike ?, unique_strings)", partial).
				Clause("or").
				Clause("arrayExists(x -> x ilike ?, unique_view_classnames)", partial).
				Clause("or").
				Clause("arrayExists(x -> x ilike ?, unique_subview_classnames)", partial).
				Clause("or").
				Clause("arrayExists(x -> (x.type ilike ? or x.message ilike ? or x.file_name ilike ? or x.class_name ilike ? or x.method_name ilike ?), unique_unhandled_exceptions)", slices.Repeat([]any{partial}, 5)...).
				Clause("or").
				Clause("arrayExists(x -> (x.type ilike ? or x.message ilike ? or x.file_name ilike ? or x.class_name ilike ? or x.method_name ilike ?), unique_handled_exceptions)", slices.Repeat([]any{partial}, 5)...).
				Clause("or").
				Clause("arrayExists(x -> x ilike ?, unique_errors)", partial).
				Clause("or").
				Clause("arrayExists(x -> (x.type ilike ? or x.message ilike ? or x.file_name ilike ? or x.class_name ilike ? or x.method_name ilike ?), unique_anrs)", slices.Repeat([]any{partial}, 5)...).
				Clause("or").
				Clause("arrayExists(x -> (x.1 ilike ? or x.2 ilike ?), unique_click_targets)", partial, partial).
				Clause("or").
				Clause("arrayExists(x -> (x.1 ilike ? or x.2 ilike ?), unique_longclick_targets)", partial, partial).
				Clause("or").
				Clause("arrayExists(x -> (x.1 ilike ? or x.2 ilike ?), unique_scroll_targets)", partial, partial),
			)

		stmt.Select("user_ids").
			Select("unique_types").
			Select("unique_custom_type_names").
			Select("unique_strings").
			Select("unique_view_classnames").
			Select("unique_subview_classnames").
			Select("unique_unhandled_exceptions").
			Select("unique_handled_exceptions").
			Select("unique_errors").
			Select("unique_anrs").
			Select("unique_click_targets").
			Select("unique_longclick_targets").
			Select("unique_scroll_targets")

		stmt.Where(stmtMatch.String(), stmtMatch.Args()...)
	}

	rows, err := server.Server.RchPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var uniqueUserIds, uniqueTypes, uniqueCustomTypeNames,
			uniqueStrings, uniqueViewClassnames, uniqueSubviewClassnames, uniqueErrors []string
		uniqueUnhandledExceptions := []map[string]string{}
		uniqueHandledExceptions := []map[string]string{}
		uniqueANRs := []map[string]string{}
		rawClickTargets := []clickhouse.ArraySet{}
		rawLongclickTargets := []clickhouse.ArraySet{}
		rawScrollTargets := []clickhouse.ArraySet{}

		var sess SessionDisplay
		sess.Session = new(Session)
		sess.Attribute = new(event.Attribute)
		sess.AppID = af.AppID

		dest := []any{
			&sess.SessionID,
			&sess.Attribute.AppVersion,
			&sess.Attribute.AppBuild,
			&sess.Attribute.OSName,
			&sess.Attribute.OSVersion,
			&sess.Attribute.DeviceName,
			&sess.Attribute.DeviceModel,
			&sess.Attribute.DeviceManufacturer,
			&sess.FirstEventTime,
			&sess.LastEventTime,
		}

		if af.HasFreeText() {
			dest = append(
				dest,
				&uniqueUserIds,
				&uniqueTypes,
				&uniqueCustomTypeNames,
				&uniqueStrings,
				&uniqueViewClassnames,
				&uniqueSubviewClassnames,
				&uniqueUnhandledExceptions,
				&uniqueHandledExceptions,
				&uniqueErrors,
				&uniqueANRs,
				&rawClickTargets,
				&rawLongclickTargets,
				&rawScrollTargets,
			)
		}

		if err = rows.Scan(dest...); err != nil {
			fmt.Println(err)
			return
		}

		if err = rows.Err(); err != nil {
			return
		}

		// convert array of tuple types
		uniqueClickTargets := make([][]string, len(rawClickTargets))
		for i, tuple := range rawClickTargets {
			uniqueClickTargets[i] = []string{tuple[0].(string), tuple[1].(string)}
		}

		uniqueLongclickTargets := make([][]string, len(rawLongclickTargets))
		for i, tuple := range rawLongclickTargets {
			uniqueLongclickTargets[i] = []string{tuple[0].(string), tuple[1].(string)}
		}

		uniqueScrollTargets := make([][]string, len(rawScrollTargets))
		for i, tuple := range rawScrollTargets {
			uniqueScrollTargets[i] = []string{tuple[0].(string), tuple[1].(string)}
		}

		if len(uniqueUserIds) > 0 {
			sess.Attribute.UserID = uniqueUserIds[0]
		}

		// set duration
		sess.Duration = time.Duration(sess.LastEventTime.Sub(*sess.FirstEventTime).Milliseconds())

		// set matched free text results
		sess.MatchedFreeText = session.ExtractMatches(
			af.FreeText,
			sess.Attribute.UserID,
			sess.SessionID.String(),
			uniqueTypes,
			uniqueCustomTypeNames,
			uniqueStrings,
			uniqueViewClassnames,
			uniqueSubviewClassnames,
			uniqueErrors,
			uniqueUnhandledExceptions,
			uniqueHandledExceptions,
			uniqueANRs,
			uniqueClickTargets,
			uniqueLongclickTargets,
			uniqueScrollTargets,
		)

		sessions = append(sessions, sess)
	}

	err = rows.Err()

	resultLen := len(sessions)

	// set pagination next & previous flags
	if resultLen > af.Limit {
		sessions = sessions[:resultLen-1]
		next = true
	}

	if af.Offset > 0 {
		previous = true
	}

	return
}

// FetchRootSpanNames returns list of root span names for a given app id
func (a App) FetchRootSpanNames(ctx context.Context) (traceNames []string, err error) {
	stmt := sqlf.
		From("spans").
		Select("span_name").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("parent_id = ''").
		GroupBy("span_name").
		OrderBy("max(start_time) desc").
		Limit(5000)

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var traceName string

		if err = rows.Scan(&traceName); err != nil {
			fmt.Println(err)
			return
		}

		traceNames = append(traceNames, traceName)
	}

	err = rows.Err()

	return
}

// FetchTracesForSessionId returns list of traces for a given app id and session id
func (a App) FetchTracesForSessionId(ctx context.Context, sessionID uuid.UUID) (sessionTraces []span.TraceSessionTimelineDisplay, err error) {
	stmt := sqlf.
		Select("span_name").
		Select("trace_id").
		Select("attribute.app_version.1 as version").
		Select("attribute.app_version.2 as code").
		Select("attribute.user_id").
		Select("attribute.thread_name").
		Select("attribute.device_manufacturer").
		Select("attribute.device_model").
		Select("attribute.network_type").
		Select("start_time").
		Select("end_time").
		From("spans final").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("session_id = toUUID(?)", sessionID).
		Where("parent_id = ''").
		OrderBy("start_time desc")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		sessionTrace := span.TraceSessionTimelineDisplay{}

		if err = rows.Scan(
			&sessionTrace.TraceName,
			&sessionTrace.TraceID,
			&sessionTrace.AppVersion,
			&sessionTrace.AppBuild,
			&sessionTrace.UserID,
			&sessionTrace.ThreadName,
			&sessionTrace.DeviceManufacturer,
			&sessionTrace.DeviceModel,
			&sessionTrace.NetworkType,
			&sessionTrace.StartTime,
			&sessionTrace.EndTime,
		); err != nil {
			fmt.Println(err)
			return
		}

		sessionTrace.Duration = time.Duration(sessionTrace.EndTime.Sub(sessionTrace.StartTime).Milliseconds())

		sessionTraces = append(sessionTraces, sessionTrace)
	}

	err = rows.Err()

	return
}

// GetSpansForSpanNameWithFilter provides list of spans for the given span name that matches various
// filter criteria in a paginated fashion.
func (a App) GetSpansForSpanNameWithFilter(ctx context.Context, spanName string, af *filter.AppFilter) (rootSpans []span.RootSpanDisplay, next, previous bool, err error) {
	stmt := sqlf.
		From("spans final").
		Select("app_id").
		Select("toString(span_name)").
		Select("toString(span_id)").
		Select("toString(trace_id)").
		Select("status").
		Select("start_time").
		Select("end_time").
		Select("tupleElement(attribute.app_version, 1)").
		Select("tupleElement(attribute.app_version, 2)").
		Select("tupleElement(attribute.os_version, 1)").
		Select("tupleElement(attribute.os_version, 2)").
		Select("attribute.device_manufacturer").
		Select("attribute.device_model").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("span_name = ?", spanName).
		Where("start_time >= ? and end_time <= ?", af.From, af.To)

	if af.HasSpanStatuses() {
		stmt.Where("status").In(af.SpanStatuses)
	}

	if af.HasVersions() {
		stmt.Where("`attribute.app_version`.1 in ?", af.Versions)
		stmt.Where("`attribute.app_version`.2 in ?", af.VersionCodes)
	}

	if af.HasOSVersions() {
		selectedOSVersions, err := af.OSVersionPairs()
		if err != nil {
			return rootSpans, next, previous, err
		}

		stmt.Where("attribute.os_version in (?)", selectedOSVersions.Parameterize())
	}

	if af.HasCountries() {
		stmt.Where("attribute.country_code in ?", af.Countries)
	}

	if af.HasNetworkProviders() {
		stmt.Where("attribute.network_provider in ?", af.NetworkProviders)
	}

	if af.HasNetworkTypes() {
		stmt.Where("attribute.network_type in ?", af.NetworkTypes)
	}

	if af.HasNetworkGenerations() {
		stmt.Where("attribute.network_generation in ?", af.NetworkGenerations)
	}

	if af.HasDeviceLocales() {
		stmt.Where("attribute.device_locale in ?", af.Locales)
	}

	if af.HasDeviceManufacturers() {
		stmt.Where("attribute.device_manufacturer in ?", af.DeviceManufacturers)
	}

	if af.HasDeviceNames() {
		stmt.Where("attribute.device_name in ?", af.DeviceNames)
	}

	if af.HasUDExpression() && !af.UDExpression.Empty() {
		subQuery := sqlf.
			From("span_user_def_attrs").
			Select("span_id").
			Where("team_id = toUUID(?)", a.TeamId).
			Where("app_id = toUUID(?)", a.ID).
			Where("timestamp >= ? and timestamp <= ?", af.From, af.To)

		if af.HasVersions() {
			subQuery.
				Where("app_version.1 in ?", af.Versions).
				Where("app_version.2 in ?", af.VersionCodes)
		}

		if af.HasOSVersions() {
			selectedOSVersions, errVersions := af.OSVersionPairs()
			if err != nil {
				err = errVersions
				return
			}

			subQuery.
				Where("os_version in (?)", selectedOSVersions.Parameterize())
		}

		af.UDExpression.Augment(subQuery)
		subQuery.GroupBy("span_id")
		stmt.SubQuery("span_id in (", ")", subQuery)
	}

	stmt.OrderBy("start_time desc")

	if af.Limit > 0 {
		stmt.Limit(uint64(af.Limit) + 1)
	}

	if af.Offset >= 0 {
		stmt.Offset(uint64(af.Offset))
	}

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	defer rows.Close()

	for rows.Next() {
		rootSpan := span.RootSpanDisplay{}

		if err = rows.Scan(&rootSpan.AppID, &rootSpan.SpanName, &rootSpan.SpanID, &rootSpan.TraceID, &rootSpan.Status, &rootSpan.StartTime, &rootSpan.EndTime, &rootSpan.AppVersion, &rootSpan.AppBuild, &rootSpan.OSName, &rootSpan.OSVersion, &rootSpan.DeviceManufacturer, &rootSpan.DeviceModel); err != nil {
			fmt.Println(err)
			return
		}

		if err = rows.Err(); err != nil {
			return
		}

		rootSpan.Duration = time.Duration(rootSpan.EndTime.Sub(rootSpan.StartTime).Milliseconds())

		rootSpans = append(rootSpans, rootSpan)
	}

	err = rows.Err()

	resultLen := len(rootSpans)

	// Set pagination next & previous flags
	if resultLen > af.Limit {
		rootSpans = rootSpans[:resultLen-1]
		next = true
	}
	if af.Offset > 0 {
		previous = true
	}

	return
}

// GetMetricsPlotForSpanNameWithFilter provides p50, p90, p95 and p99 duration metrics
// for the given span name with the applied filtering criteria
func (a App) GetMetricsPlotForSpanNameWithFilter(ctx context.Context, spanName string, af *filter.AppFilter) (spanMetricsPlotInstances []span.SpanMetricsPlotInstance, err error) {
	if !af.HasTimezone() {
		err = fmt.Errorf("timezone is required")
		return
	}

	if !af.HasPlotTimeGroup() {
		af.SetDefaultPlotTimeGroup()
	}

	groupExpr, err := getPlotTimeGroupExpr("timestamp", af.PlotTimeGroup)
	if err != nil {
		return nil, err
	}

	stmt := sqlf.
		From("span_metrics").
		Select("concat(tupleElement(app_version, 1), ' ', '(', tupleElement(app_version, 2), ')') app_version_fmt").
		Select(groupExpr.BucketExpr+" as datetime_bucket", af.Timezone).
		Select("formatDateTime(datetime_bucket, ?) as datetime", groupExpr.DatetimeFormat).
		Select("round(quantileMerge(0.50)(p50), 2) as p50").
		Select("round(quantileMerge(0.90)(p90), 2) as p90").
		Select("round(quantileMerge(0.95)(p95), 2) as p95").
		Select("round(quantileMerge(0.99)(p99), 2) as p99").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("span_name = ?", spanName).
		Where("timestamp >= ? and timestamp <= ?", af.From, af.To)

	if af.HasVersions() {
		stmt.Where("app_version.1 in ?", af.Versions)
		stmt.Where("app_version.2 in ?", af.VersionCodes)
	}

	if af.HasSpanStatuses() {
		stmt.Where("status").In(af.SpanStatuses)
	}

	if af.HasOSVersions() {
		selectedOSVersions, err := af.OSVersionPairs()
		if err != nil {
			return nil, err
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
		subQuery := sqlf.
			From("span_user_def_attrs").
			Select("span_id").
			Where("team_id = toUUID(?)", a.TeamId).
			Where("app_id = toUUID(?)", a.ID).
			Where("timestamp >= ? and timestamp <= ?", af.From, af.To)

		if af.HasVersions() {
			subQuery.
				Where("app_version.1 in ?", af.Versions).
				Where("app_version.2 in ?", af.VersionCodes)
		}

		if af.HasOSVersions() {
			selectedOSVersions, errVersions := af.OSVersionPairs()
			if err != nil {
				err = errVersions
				return
			}

			subQuery.
				Where("os_version in (?)", selectedOSVersions.Parameterize())
		}

		af.UDExpression.Augment(subQuery)
		subQuery.GroupBy("span_id")
		stmt.SubQuery("span_id in (", ")", subQuery)
	}

	stmt.GroupBy("app_version, datetime_bucket")
	stmt.OrderBy("datetime_bucket, tupleElement(app_version, 2) desc")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	defer rows.Close()

	for rows.Next() {
		var spanMetricsPlotInstance span.SpanMetricsPlotInstance
		var datetimeBucket time.Time
		if err = rows.Scan(&spanMetricsPlotInstance.Version, &datetimeBucket, &spanMetricsPlotInstance.DateTime, &spanMetricsPlotInstance.P50, &spanMetricsPlotInstance.P90, &spanMetricsPlotInstance.P95, &spanMetricsPlotInstance.P99); err != nil {
			return
		}

		spanMetricsPlotInstances = append(spanMetricsPlotInstances, spanMetricsPlotInstance)
	}

	err = rows.Err()

	return
}

// GetTrace constructs and returns a trace for
// a given traceId
func (a App) GetTrace(ctx context.Context, traceId string) (trace span.TraceDisplay, err error) {
	stmt := sqlf.
		From("spans final").
		Select("app_id").
		Select("toString(trace_id)").
		Select("session_id").
		Select("attribute.user_id").
		Select("toString(span_id)").
		Select("toString(span_name)").
		Select("toString(parent_id)").
		Select("start_time").
		Select("end_time").
		Select("status").
		Select("checkpoints").
		Select("tupleElement(attribute.app_version, 1)").
		Select("tupleElement(attribute.app_version, 2)").
		Select("tupleElement(attribute.os_version, 1)").
		Select("tupleElement(attribute.os_version, 2)").
		Select("attribute.device_manufacturer").
		Select("attribute.device_model").
		Select("attribute.network_type").
		Select("toString(attribute.thread_name)").
		Select("attribute.device_low_power_mode").
		Select("attribute.device_thermal_throttling_enabled").
		Select("user_defined_attribute").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("trace_id = ?", traceId).
		OrderBy("start_time desc")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	spans := []span.SpanField{}

	for rows.Next() {
		var rawCheckpoints [][]any
		var rawUserDefAttr map[string][]any
		s := span.SpanField{}

		if err = rows.Scan(&s.AppID, &s.TraceID, &s.SessionID, &s.Attributes.UserID, &s.SpanID, &s.SpanName, &s.ParentID, &s.StartTime, &s.EndTime, &s.Status, &rawCheckpoints, &s.Attributes.AppVersion, &s.Attributes.AppBuild, &s.Attributes.OSName, &s.Attributes.OSVersion, &s.Attributes.DeviceManufacturer, &s.Attributes.DeviceModel, &s.Attributes.NetworkType, &s.Attributes.ThreadName, &s.Attributes.LowPowerModeEnabled, &s.Attributes.ThermalThrottlingEnabled, &rawUserDefAttr); err != nil {
			fmt.Println(err)
			return
		}

		if err = rows.Err(); err != nil {
			return
		}

		// Map rawUserDefAttr
		if len(rawUserDefAttr) > 0 {
			s.UserDefinedAttribute.Scan(rawUserDefAttr)
		}

		// Map rawCheckpoints
		for _, cp := range rawCheckpoints {
			rawName, _ := cp[0].(string)
			name := strings.ReplaceAll(rawName, "\u0000", "")
			timestamp, _ := cp[1].(time.Time)
			s.CheckPoints = append(s.CheckPoints, span.CheckPointField{
				Name:      name,
				Timestamp: timestamp,
			})
		}

		spans = append(spans, s)
	}

	if len(spans) == 0 {
		return trace, fmt.Errorf("no spans found for traceId: %v", traceId)
	}

	spanDisplays := []span.SpanDisplay{}
	var minStartTime time.Time
	var maxEndTime time.Time

	for i, s := range spans {
		spanDisplay := span.SpanDisplay{
			SpanName:                 s.SpanName,
			SpanID:                   s.SpanID,
			ParentID:                 s.ParentID,
			Status:                   s.Status,
			StartTime:                s.StartTime,
			EndTime:                  s.EndTime,
			Duration:                 time.Duration(s.EndTime.Sub(s.StartTime).Milliseconds()),
			ThreadName:               s.Attributes.ThreadName,
			LowPowerModeEnabled:      s.Attributes.LowPowerModeEnabled,
			ThermalThrottlingEnabled: s.Attributes.ThermalThrottlingEnabled,
			UserDefinedAttribute:     s.UserDefinedAttribute,
			CheckPoints:              s.CheckPoints,
		}

		spanDisplays = append(spanDisplays, spanDisplay)

		// Initialize minStartTime and maxEndTime on the first iteration
		if i == 0 {
			minStartTime = s.StartTime
			maxEndTime = s.EndTime
		} else {
			// Update minStartTime and maxEndTime as necessary
			if s.StartTime.Before(minStartTime) {
				minStartTime = s.StartTime
			}
			if s.EndTime.After(maxEndTime) {
				maxEndTime = s.EndTime
			}
		}
	}

	trace.AppID = spans[0].AppID
	trace.TraceID = spans[0].TraceID
	trace.SessionID = spans[0].SessionID
	trace.UserID = spans[0].Attributes.UserID
	trace.StartTime = minStartTime
	trace.EndTime = maxEndTime
	trace.Duration = time.Duration(maxEndTime.Sub(minStartTime).Milliseconds())
	trace.AppVersion = spans[0].Attributes.AppVersion + "(" + spans[0].Attributes.AppBuild + ")"
	trace.OSVersion = spans[0].Attributes.OSName + " " + spans[0].Attributes.OSVersion
	trace.DeviceManufacturer = spans[0].Attributes.DeviceManufacturer
	trace.DeviceModel = spans[0].Attributes.DeviceModel
	trace.NetworkType = spans[0].Attributes.NetworkType
	trace.Spans = spanDisplays

	return
}

// GetBugReportsWithFilter provides bug reports that matches various
// filter criteria in a paginated fashion.
func (a App) GetBugReportsWithFilter(ctx context.Context, af *filter.AppFilter) (bugReports []BugReportDisplay, next, previous bool, err error) {
	stmt := sqlf.
		From("bug_reports final").
		Select("event_id").
		Select("session_id").
		Select("timestamp").
		Select("updated_at").
		Select("status").
		Select("description").
		Select("tupleElement(app_version, 1)").
		Select("tupleElement(app_version, 2)").
		Select("tupleElement(os_version, 1)").
		Select("tupleElement(os_version, 2)").
		Select("device_manufacturer").
		Select("device_name").
		Select("device_model").
		Select("user_id").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("timestamp >= ? and timestamp <= ?", af.From, af.To)

	defer stmt.Close()

	if af.HasVersions() {
		stmt.Where("app_version.1 in ?", af.Versions)
		stmt.Where("app_version.2 in ?", af.VersionCodes)
	}

	if af.Limit > 0 {
		stmt.Limit(uint64(af.Limit) + 1)
	}

	if af.Offset >= 0 {
		stmt.Offset(uint64(af.Offset))
	}

	if af.HasBugReportStatuses() {
		stmt.Where("status").In(af.BugReportStatuses)
	}

	if af.HasOSVersions() {
		selectedOSVersions, err := af.OSVersionPairs()
		if err != nil {
			return bugReports, next, previous, err
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
		subQuery := sqlf.
			From("user_def_attrs").
			Select("event_id").
			Where("team_id = toUUID(?)", a.TeamId).
			Where("app_id = toUUID(?)", a.ID).
			Where("bug_report = true").
			Where("timestamp >= ? and timestamp <= ?", af.From, af.To)

		if af.HasVersions() {
			subQuery.
				Where("app_version.1 in ?", af.Versions).
				Where("app_version.2 in ?", af.VersionCodes)
		}

		if af.HasOSVersions() {
			selectedOSVersions, errVersions := af.OSVersionPairs()
			if err != nil {
				err = errVersions
				return
			}

			subQuery.
				Where("os_version in (?)", selectedOSVersions.Parameterize())
		}

		af.UDExpression.Augment(subQuery)
		subQuery.GroupBy("event_id")
		stmt.SubQuery("event_id in (", ")", subQuery)
	}

	stmt.OrderBy("timestamp desc")

	if af.HasFreeText() {
		partial := fmt.Sprintf("%%%s%%", af.FreeText)

		stmtMatch := sqlf.
			New("").
			SubQuery("(", ")", sqlf.
				New("").
				Clause("user_id ilike ?", af.FreeText).
				Clause("or").
				Clause("toString(event_id) ilike ?", af.FreeText).
				Clause("or").
				Clause("toString(session_id) ilike ?", af.FreeText).
				Clause("or").
				Clause("description ilike ?", partial),
			)

		stmt.Where(stmtMatch.String(), stmtMatch.Args()...)
	}

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var bugReport BugReportDisplay
		bugReport.BugReport = new(BugReport)
		bugReport.Attribute = new(event.Attribute)
		bugReport.AppID = af.AppID

		dest := []any{
			&bugReport.EventID,
			&bugReport.SessionID,
			&bugReport.Timestamp,
			&bugReport.UpdatedAt,
			&bugReport.Status,
			&bugReport.Description,
			&bugReport.Attribute.AppVersion,
			&bugReport.Attribute.AppBuild,
			&bugReport.Attribute.OSName,
			&bugReport.Attribute.OSVersion,
			&bugReport.Attribute.DeviceManufacturer,
			&bugReport.Attribute.DeviceName,
			&bugReport.Attribute.DeviceModel,
			&bugReport.Attribute.UserID,
		}

		if err = rows.Scan(dest...); err != nil {
			fmt.Println(err)
			return
		}

		// set matched free text results
		bugReport.MatchedFreeText = extractMatches(af.FreeText, bugReport.Attribute.UserID, bugReport.EventID.String(), bugReport.SessionID.String(), bugReport.Description)

		bugReports = append(bugReports, bugReport)
	}

	err = rows.Err()

	resultLen := len(bugReports)

	// Set pagination next & previous flags
	if resultLen > af.Limit {
		bugReports = bugReports[:resultLen-1]
		next = true
	}
	if af.Offset > 0 {
		previous = true
	}

	return
}

// GetBugReportInstancesPlot provides aggregated bug report instances
// matching various filters.
func (a App) GetBugReportInstancesPlot(ctx context.Context, af *filter.AppFilter) (bugReportInstances []BugReportInstance, err error) {
	if af.Timezone == "" {
		return nil, errors.New("missing timezone filter")
	}

	if !af.HasPlotTimeGroup() {
		af.SetDefaultPlotTimeGroup()
	}

	groupExpr, err := getPlotTimeGroupExpr("timestamp", af.PlotTimeGroup)
	if err != nil {
		return nil, err
	}

	base := sqlf.From("bug_reports final").
		Select("event_id").
		Select("app_version").
		Select("timestamp").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("timestamp >= ? and timestamp <= ?", af.From, af.To)

	if af.HasVersions() {
		base.Where("app_version.1 in ?", af.Versions)
		base.Where("app_version.2 in ?", af.VersionCodes)
	}

	if af.HasBugReportStatuses() {
		base.Where("status").In(af.BugReportStatuses)
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

	if af.HasFreeText() {
		partial := fmt.Sprintf("%%%s%%", af.FreeText)

		stmtMatch := sqlf.
			New("").
			SubQuery("(", ")", sqlf.
				New("").
				Clause("user_id ilike ?", af.FreeText).
				Clause("or").
				Clause("toString(event_id) ilike ?", af.FreeText).
				Clause("or").
				Clause("toString(session_id) ilike ?", af.FreeText).
				Clause("or").
				Clause("description ilike ?", partial),
			)

		base.Where(stmtMatch.String(), stmtMatch.Args()...)
	}

	if af.HasUDExpression() && !af.UDExpression.Empty() {
		subQuery := sqlf.
			From("user_def_attrs").
			Select("event_id").
			Where("team_id = toUUID(?)", a.TeamId).
			Where("app_id = toUUID(?)", a.ID).
			Where("bug_report = true").
			Where("timestamp >= ? and timestamp <= ?", af.From, af.To)

		if af.HasVersions() {
			subQuery.
				Where("app_version.1 in ?", af.Versions).
				Where("app_version.2 in ?", af.VersionCodes)
		}

		if af.HasOSVersions() {
			selectedOSVersions, errVersions := af.OSVersionPairs()
			if err != nil {
				err = errVersions
				return
			}

			subQuery.
				Where("os_version in (?)", selectedOSVersions.Parameterize())
		}

		af.UDExpression.Augment(subQuery)
		subQuery.GroupBy("event_id")
		base.SubQuery("event_id in (", ")", subQuery)
	}

	base.OrderBy("timestamp desc")
	base.GroupBy("event_id")
	base.GroupBy("app_version")
	base.GroupBy("timestamp")

	stmt := sqlf.
		With("base", base).
		From("base").
		Select("uniq(event_id) instances").
		Select(groupExpr.BucketExpr+" as datetime_bucket", af.Timezone).
		Select("formatDateTime(datetime_bucket, ?) as datetime", groupExpr.DatetimeFormat).
		Select("concat(tupleElement(app_version, 1), ' ', '(', tupleElement(app_version, 2), ')') app_version_fmt").
		GroupBy("app_version, datetime_bucket").
		OrderBy("datetime_bucket, tupleElement(app_version, 2) desc")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var bugReportInstance BugReportInstance
		var datetimeBucket time.Time
		if err = rows.Scan(&bugReportInstance.Instances, &datetimeBucket, &bugReportInstance.DateTime, &bugReportInstance.Version); err != nil {
			return
		}

		bugReportInstances = append(bugReportInstances, bugReportInstance)
	}

	err = rows.Err()

	return
}

// GetBugReport fetches a bug report by its event id.
func (a App) GetBugReportById(ctx context.Context, bugReportId string) (bugReport BugReport, err error) {
	stmt := sqlf.
		From("bug_reports final").
		Select("event_id").
		Select("app_id").
		Select("session_id").
		Select("timestamp").
		Select("updated_at").
		Select("status").
		Select("description").
		Select("tupleElement(app_version, 1)").
		Select("tupleElement(app_version, 2)").
		Select("tupleElement(os_version, 1)").
		Select("tupleElement(os_version, 2)").
		Select("network_provider").
		Select("network_type").
		Select("network_generation").
		Select("device_locale").
		Select("device_manufacturer").
		Select("device_name").
		Select("device_model").
		Select("user_id").
		Select("device_low_power_mode").
		Select("device_thermal_throttling_enabled").
		Select("user_defined_attribute").
		Select("attachments").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("event_id = toUUID(?)", bugReportId)

	defer stmt.Close()

	row := server.Server.ChPool.QueryRow(ctx, stmt.String(), stmt.Args()...)

	if row.Err() != nil {
		err = row.Err()
		return
	}

	bugReport.Attribute = new(event.Attribute)
	var rawUserDefAttr map[string][]any
	var rawAttachments string

	dest := []any{
		&bugReport.EventID,
		&bugReport.AppID,
		&bugReport.SessionID,
		&bugReport.Timestamp,
		&bugReport.UpdatedAt,
		&bugReport.Status,
		&bugReport.Description,
		&bugReport.Attribute.AppVersion,
		&bugReport.Attribute.AppBuild,
		&bugReport.Attribute.OSName,
		&bugReport.Attribute.OSVersion,
		&bugReport.Attribute.NetworkProvider,
		&bugReport.Attribute.NetworkType,
		&bugReport.Attribute.NetworkGeneration,
		&bugReport.Attribute.DeviceLocale,
		&bugReport.Attribute.DeviceManufacturer,
		&bugReport.Attribute.DeviceName,
		&bugReport.Attribute.DeviceModel,
		&bugReport.Attribute.UserID,
		&bugReport.Attribute.DeviceLowPowerMode,
		&bugReport.Attribute.DeviceThermalThrottlingEnabled,
		&rawUserDefAttr,
		&rawAttachments,
	}

	if err = row.Scan(dest...); err != nil {
		fmt.Println(err)
		return
	}

	// Map rawUserDefAttr
	if len(rawUserDefAttr) > 0 {
		bugReport.UserDefinedAttribute.Scan(rawUserDefAttr)
	}

	// Map rawAttachments
	if err = json.Unmarshal([]byte(rawAttachments), &bugReport.Attachments); err != nil {
		return
	}

	// Presign attachment URLs
	if len(bugReport.Attachments) > 0 {
		for j := range bugReport.Attachments {
			if err = bugReport.Attachments[j].PreSignURL(ctx); err != nil {
				msg := `failed to generate URLs for attachment`
				fmt.Println(msg, err)
				return
			}
		}
	}

	return
}

// UpdateBugReportStatusById updates the status of a bug report by its event id.
func (a App) UpdateBugReportStatusById(ctx context.Context, bugReportId string, status uint8) (err error) {
	if status != 0 && status != 1 {
		return fmt.Errorf("invalid status %d. Should be 0 (closed) or 1 (open)", status)
	}

	stmt := sqlf.
		Update("bug_reports").
		Set("status", status).
		Set("updated_at", time.Now()).
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("event_id = ?", bugReportId)

	defer stmt.Close()

	if err = server.Server.ChPool.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
		return
	}

	return
}

// getJourneyEvents queries all relevant lifecycle
// and issue events involved in forming
// an implicit navigational journey.
func (a App) getJourneyEvents(ctx context.Context, af *filter.AppFilter, opts filter.JourneyOpts) (events []event.EventField, err error) {
	whereVals := []any{}

	switch opsys.ToFamily(a.OSName) {
	case opsys.Android:
		whereVals = append(
			whereVals,
			event.TypeLifecycleActivity,
			[]string{
				event.LifecycleActivityTypeCreated,
				event.LifecycleActivityTypeResumed,
			},
			event.TypeLifecycleFragment,
			[]string{
				event.LifecycleFragmentTypeAttached,
				event.LifecycleFragmentTypeResumed,
			},
		)
	case opsys.AppleFamily:
		whereVals = append(
			whereVals,
			event.TypeLifecycleViewController,
			[]string{
				event.LifecycleViewControllerTypeViewDidLoad,
				event.LifecycleViewControllerTypeViewDidAppear,
			},
			event.TypeLifecycleSwiftUI,
			[]string{
				event.LifecycleSwiftUITypeOnAppear,
			},
		)
	}

	whereVals = append(whereVals, event.TypeScreenView)

	if opts.All {
		switch opsys.ToFamily(a.OSName) {
		case opsys.Android:
			whereVals = append(whereVals, event.TypeException, false, event.TypeANR)
		case opsys.AppleFamily:
			whereVals = append(whereVals, event.TypeException, false)
		}
	} else if opts.Exceptions {
		whereVals = append(whereVals, event.TypeException, false)
	} else if opts.ANRs {
		switch a.OSName {
		case opsys.Android:
			whereVals = append(whereVals, event.TypeANR)
		}
	}

	stmt := sqlf.
		From(`journey`).
		Select(`id`).
		Select(`type`).
		Select(`timestamp`).
		Select(`session_id`).
		Select(`screen_view.name`).
		Select(`exception.fingerprint`).
		Select(`anr.fingerprint`).
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID)

	if af.HasVersions() {
		stmt.Where("app_version.1 in ?", af.Versions)
		stmt.Where("app_version.2 in ?", af.VersionCodes)
	}

	stmt.Where("timestamp >= ? and timestamp <= ?", af.From, af.To)

	switch opsys.ToFamily(a.OSName) {
	case opsys.Android:
		stmt.
			Select(`lifecycle_activity.type`).
			Select(`lifecycle_activity.class_name`).
			Select(`lifecycle_fragment.type`).
			Select(`lifecycle_fragment.class_name`).
			Select(`lifecycle_fragment.parent_activity`).
			Select(`lifecycle_fragment.parent_fragment`)
	case opsys.AppleFamily:
		stmt.
			Select(`lifecycle_view_controller.type`).
			Select(`lifecycle_view_controller.class_name`).
			Select(`lifecycle_swift_ui.type`).
			Select(`lifecycle_swift_ui.class_name`)
	}

	if opts.All {
		switch opsys.ToFamily(a.OSName) {
		case opsys.Android:
			stmt.Where("((type = ? and `lifecycle_activity.type` in ?) or (type = ? and `lifecycle_fragment.type` in ?) or (type = ?) or ((type = ? and `exception.handled` = ?) or type = ?))", whereVals...)
		case opsys.AppleFamily:
			stmt.Where("((type = ? and `lifecycle_view_controller.type` in ?) or (type = ? and `lifecycle_swift_ui.type` in ?) or (type = ?) or (type = ? and `exception.handled` = ?))", whereVals...)
		}
	} else if opts.Exceptions {
		stmt.Where("((type = ? and `lifecycle_activity.type` in ?) or (type = ? and `lifecycle_fragment.type` in ?) or (type = ?) or (type = ? and `exception.handled` = ?))", whereVals...)
	} else if opts.ANRs {
		switch a.OSName {
		case opsys.Android:
			stmt.Where("((type = ? and `lifecycle_activity.type` in ?) or (type = ? and `lifecycle_fragment.type` in ?) or (type = ?) or (type = ?))", whereVals...)
		}
	}

	if af.HasOSVersions() {
		stmt.Where("`attribute.os_name` in ?", af.OsNames)
		stmt.Where("`attribute.os_version` in ?", af.OsVersions)
	}

	if af.HasCountries() {
		stmt.Where("`inet.country_code` in ?", af.Countries)
	}

	if af.HasDeviceNames() {
		stmt.Where("`attribute.device_name` in ?", af.DeviceNames)
	}

	if af.HasDeviceManufacturers() {
		stmt.Where("`attribute.device_manufacturer` in ?", af.DeviceManufacturers)
	}

	if af.HasDeviceLocales() {
		stmt.Where("`attribute.device_locale` in ?", af.Locales)
	}

	if af.HasNetworkProviders() {
		stmt.Where("`attribute.network_provider` in ?", af.NetworkProviders)
	}

	if af.HasNetworkTypes() {
		stmt.Where("`attribute.network_type` in ?", af.NetworkTypes)
	}

	if af.HasNetworkGenerations() {
		stmt.Where("`attribute.network_generation` in ?", af.NetworkGenerations)
	}

	stmt.OrderBy(`timestamp`)

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var ev event.EventField
		var lifecycleActivityType string
		var lifecycleActivityClassName string
		var lifecycleFragmentType string
		var lifecycleFragmentClassName string
		var lifecycleFragmentParentActivity string
		var lifecycleFragmentParentFragment string
		var lifecycleViewControllerType string
		var lifecycleViewControllerClassName string
		var lifecycleSwiftUIType string
		var lifecycleSwiftUIClassName string
		var screenViewName string
		var exceptionFingerprint string
		var anrFingerprint string

		dest := []any{
			&ev.ID,
			&ev.Type,
			&ev.Timestamp,
			&ev.SessionID,
			&screenViewName,
			&exceptionFingerprint,
			&anrFingerprint,
		}

		switch opsys.ToFamily(a.OSName) {
		case opsys.Android:
			dest = append(
				dest,
				&lifecycleActivityType,
				&lifecycleActivityClassName,
				&lifecycleFragmentType,
				&lifecycleFragmentClassName,
				&lifecycleFragmentParentActivity,
				&lifecycleFragmentParentFragment,
			)
		case opsys.AppleFamily:
			dest = append(
				dest,
				&lifecycleViewControllerType,
				&lifecycleViewControllerClassName,
				&lifecycleSwiftUIType,
				&lifecycleSwiftUIClassName,
			)
		}

		if err := rows.Scan(dest...); err != nil {
			return nil, err
		}

		if ev.IsLifecycleActivity() {
			ev.LifecycleActivity = &event.LifecycleActivity{
				Type:      lifecycleActivityType,
				ClassName: lifecycleActivityClassName,
			}
		} else if ev.IsLifecycleFragment() {
			ev.LifecycleFragment = &event.LifecycleFragment{
				Type:           lifecycleFragmentType,
				ClassName:      lifecycleFragmentClassName,
				ParentActivity: lifecycleFragmentParentActivity,
				ParentFragment: lifecycleFragmentParentFragment,
			}
		} else if ev.IsLifecycleViewController() {
			ev.LifecycleViewController = &event.LifecycleViewController{
				Type:      lifecycleViewControllerType,
				ClassName: lifecycleViewControllerClassName,
			}
		} else if ev.IsLifecycleSwiftUI() {
			ev.LifecycleSwiftUI = &event.LifecycleSwiftUI{
				Type:      lifecycleSwiftUIType,
				ClassName: lifecycleSwiftUIClassName,
			}
		} else if ev.IsScreenView() {
			ev.ScreenView = &event.ScreenView{
				Name: screenViewName,
			}
		} else if ev.IsException() {
			ev.Exception = &event.Exception{
				Fingerprint: exceptionFingerprint,
			}
		} else if ev.IsANR() {
			ev.ANR = &event.ANR{
				Fingerprint: anrFingerprint,
			}
		}

		events = append(events, ev)
	}

	err = rows.Err()

	return
}

func (a *App) add(tx pgx.Tx) (*APIKey, error) {
	id := uuid.New()
	a.ID = &id

	_, err := tx.Exec(context.Background(), "insert into apps(id, team_id, app_name, retention, created_at, updated_at) values ($1, $2, $3, $4, $5, $6);", a.ID, a.TeamId, a.AppName, a.Retention, a.CreatedAt, a.UpdatedAt)

	if err != nil {
		return nil, err
	}

	apiKey, err := NewAPIKey(*a.ID)

	if err != nil {
		return nil, err
	}

	if err := apiKey.saveTx(tx); err != nil {
		return nil, err
	}

	return apiKey, nil
}

func (a *App) getWithTeam(id uuid.UUID) (*App, error) {
	var appName pgtype.Text
	var uniqueId pgtype.Text
	var osName pgtype.Text
	var firstVersion pgtype.Text
	var onboarded pgtype.Bool
	var onboardedAt pgtype.Timestamptz
	var apiKeyLastSeen pgtype.Timestamptz
	var apiKeyCreatedAt pgtype.Timestamptz
	var createdAt pgtype.Timestamptz
	var updatedAt pgtype.Timestamptz

	apiKey := new(APIKey)

	cols := []string{
		"apps.app_name",
		"apps.unique_identifier",
		"apps.os_name",
		"apps.first_version",
		"apps.onboarded",
		"apps.onboarded_at",
		"api_keys.key_prefix",
		"api_keys.key_value",
		"api_keys.checksum",
		"api_keys.last_seen",
		"api_keys.created_at",
		"apps.created_at",
		"apps.updated_at",
	}

	stmt := sqlf.PostgreSQL.
		Select(strings.Join(cols, ",")).
		From("apps").
		LeftJoin("api_keys", "api_keys.app_id = apps.id and api_keys.revoked = false").
		Where("apps.id = ? and apps.team_id = ?", nil, nil)

	defer stmt.Close()

	dest := []any{
		&appName,
		&uniqueId,
		&osName,
		&firstVersion,
		&onboarded,
		&onboardedAt,
		&apiKey.keyPrefix,
		&apiKey.keyValue,
		&apiKey.checksum,
		&apiKeyLastSeen,
		&apiKeyCreatedAt,
		&createdAt,
		&updatedAt,
	}

	if err := server.Server.PgPool.QueryRow(context.Background(), stmt.String(), id, a.TeamId).Scan(dest...); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		} else {
			return nil, err
		}
	}

	if appName.Valid {
		a.AppName = appName.String
	}

	if uniqueId.Valid {
		a.UniqueId = uniqueId.String
	} else {
		a.UniqueId = ""
	}

	if osName.Valid {
		a.OSName = osName.String
	} else {
		a.OSName = ""
	}

	if firstVersion.Valid {
		a.FirstVersion = firstVersion.String
	} else {
		a.FirstVersion = ""
	}

	if onboarded.Valid {
		a.Onboarded = onboarded.Bool
	}

	if onboardedAt.Valid {
		a.OnboardedAt = onboardedAt.Time
	}

	if apiKeyLastSeen.Valid {
		apiKey.lastSeen = apiKeyLastSeen.Time
	}

	if apiKeyCreatedAt.Valid {
		apiKey.createdAt = apiKeyCreatedAt.Time
	}

	if createdAt.Valid {
		a.CreatedAt = createdAt.Time
	}

	if updatedAt.Valid {
		a.UpdatedAt = updatedAt.Time
	}

	a.APIKey = apiKey

	return a, nil
}

func (a *App) getTeam(ctx context.Context) (*Team, error) {
	team := &Team{}

	stmt := sqlf.PostgreSQL.
		Select("team_id").
		From("apps").
		Where("id = ?", a.ID)

	defer stmt.Close()

	if err := server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&team.ID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		} else {
			return nil, err
		}
	}

	return team, nil
}

// Populate fills in all app values
// for the app.
func (a *App) Populate(ctx context.Context) (err error) {
	stmt := sqlf.PostgreSQL.From("apps").
		Select("team_id::UUID").
		Select("unique_identifier").
		Select("app_name").
		Select("os_name").
		Select("first_version").
		Select("onboarded").
		Select("onboarded_at").
		Select("created_at").
		Select("updated_at").
		Where("id = ?", a.ID)

	defer stmt.Close()

	return server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&a.TeamId, &a.UniqueId, &a.AppName, &a.OSName, &a.FirstVersion, &a.Onboarded, &a.OnboardedAt, &a.CreatedAt, &a.UpdatedAt)
}

func (a *App) Onboard(ctx context.Context, tx *pgx.Tx, uniqueIdentifier, osName, firstVersion string) error {
	now := time.Now()
	stmt := sqlf.PostgreSQL.Update("apps").
		Set("onboarded", true).
		Set("unique_identifier", uniqueIdentifier).
		Set("os_name", osName).
		Set("first_version", firstVersion).
		Set("onboarded_at", now).
		Set("updated_at", now).
		Where("id = ?", a.ID)

	defer stmt.Close()

	_, err := (*tx).Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return err
	}

	return nil
}

// GetSessionEvents fetches all the events of an app's session.
func (a *App) GetSessionEvents(ctx context.Context, sessionId uuid.UUID) (*Session, error) {
	sessionAppVersion := sqlf.From("sessions_index").
		Select("argMax(app_version, last_event_timestamp) as app_version").
		Select("min(first_event_timestamp) as start_time").
		Select("max(last_event_timestamp) as end_time").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("session_id = toUUID(?)", sessionId).
		Limit(1)

	cols := []string{
		`id`,
		`type`,
		`session_id`,
		`app_id`,
		`inet.ipv4`,
		`inet.ipv6`,
		`inet.country_code`,
		`timestamp`,
		`user_triggered`,
		`attachments`,
		`attribute.installation_id`,
		`attribute.app_version`,
		`attribute.app_build`,
		`attribute.app_unique_id`,
		`attribute.platform`,
		`attribute.measure_sdk_version`,
		`attribute.thread_name`,
		`attribute.user_id`,
		`attribute.device_name`,
		`attribute.device_model`,
		`attribute.device_manufacturer`,
		`attribute.device_type`,
		`attribute.device_is_foldable`,
		`attribute.device_is_physical`,
		`attribute.device_density_dpi`,
		`attribute.device_width_px`,
		`attribute.device_height_px`,
		`attribute.device_density`,
		`attribute.device_locale`,
		`attribute.os_name`,
		`attribute.os_version`,
		`attribute.network_type`,
		`attribute.network_generation`,
		`attribute.network_provider`,
		`user_defined_attribute`,
		`gesture_long_click.target`,
		`gesture_long_click.target_id`,
		`gesture_long_click.touch_down_time`,
		`gesture_long_click.touch_up_time`,
		`gesture_long_click.width`,
		`gesture_long_click.height`,
		`gesture_long_click.x`,
		`gesture_long_click.y`,
		`gesture_click.target`,
		`gesture_click.target_id`,
		`gesture_click.touch_down_time`,
		`gesture_click.touch_up_time`,
		`gesture_click.width`,
		`gesture_click.height`,
		`gesture_click.x`,
		`gesture_click.y`,
		`gesture_scroll.target`,
		`gesture_scroll.target_id`,
		`gesture_scroll.touch_down_time`,
		`gesture_scroll.touch_up_time`,
		`gesture_scroll.x`,
		`gesture_scroll.y`,
		`gesture_scroll.end_x`,
		`gesture_scroll.end_y`,
		`gesture_scroll.direction`,
		`exception.handled`,
		`exception.fingerprint`,
		`exception.foreground`,
		`exception.exceptions`,
		`exception.threads`,
		`exception.framework`,
		`lifecycle_app.type`,
		`cold_launch.process_start_uptime`,
		`cold_launch.process_start_requested_uptime`,
		`cold_launch.content_provider_attach_uptime`,
		`cold_launch.on_next_draw_uptime`,
		`cold_launch.launched_activity`,
		`cold_launch.has_saved_state`,
		`cold_launch.intent_data`,
		`cold_launch.duration`,
		`warm_launch.app_visible_uptime`,
		`warm_launch.process_start_uptime`,
		`warm_launch.process_start_requested_uptime`,
		`warm_launch.content_provider_attach_uptime`,
		`warm_launch.on_next_draw_uptime`,
		`warm_launch.launched_activity`,
		`warm_launch.has_saved_state`,
		`warm_launch.intent_data`,
		`warm_launch.duration`,
		`warm_launch.is_lukewarm`,
		`hot_launch.app_visible_uptime`,
		`hot_launch.on_next_draw_uptime`,
		`hot_launch.launched_activity`,
		`hot_launch.has_saved_state`,
		`hot_launch.intent_data`,
		`hot_launch.duration`,
		`network_change.network_type`,
		`network_change.previous_network_type`,
		`network_change.network_generation`,
		`network_change.previous_network_generation`,
		`network_change.network_provider`,
		`http.url`,
		`http.method`,
		`http.status_code`,
		`http.start_time`,
		`http.end_time`,
		`http_request_headers`,
		`http_response_headers`,
		`http.request_body`,
		`http.response_body`,
		`http.failure_reason`,
		`http.failure_description`,
		`http.client`,
		`cpu_usage.num_cores`,
		`cpu_usage.clock_speed`,
		`cpu_usage.start_time`,
		`cpu_usage.uptime`,
		`cpu_usage.utime`,
		`cpu_usage.cutime`,
		`cpu_usage.stime`,
		`cpu_usage.cstime`,
		`cpu_usage.interval`,
		`cpu_usage.percentage_usage`,
		`screen_view.name `,
		`bug_report.description`,
		`custom.name`,
	}

	switch opsys.ToFamily(a.OSName) {
	case opsys.Android:
		cols = append(cols, []string{
			`anr.fingerprint`,
			`anr.foreground`,
			`anr.exceptions`,
			`anr.threads`,
			`app_exit.reason`,
			`app_exit.importance`,
			`app_exit.trace`,
			`app_exit.process_name`,
			`app_exit.pid`,
			`string.severity_text`,
			`string.string`,
			`lifecycle_activity.type`,
			`lifecycle_activity.class_name`,
			`lifecycle_activity.intent`,
			`lifecycle_activity.saved_instance_state`,
			`lifecycle_fragment.type`,
			`lifecycle_fragment.class_name`,
			`lifecycle_fragment.parent_activity`,
			`lifecycle_fragment.parent_fragment`,
			`lifecycle_fragment.tag`,
			`memory_usage.java_max_heap`,
			`memory_usage.java_total_heap`,
			`memory_usage.java_free_heap`,
			`memory_usage.total_pss`,
			`memory_usage.rss`,
			`memory_usage.native_total_heap`,
			`memory_usage.native_free_heap`,
			`memory_usage.interval`,
			`low_memory.java_max_heap`,
			`low_memory.java_total_heap`,
			`low_memory.java_free_heap`,
			`low_memory.total_pss`,
			`low_memory.rss`,
			`low_memory.native_total_heap`,
			`low_memory.native_free_heap`,
			`trim_memory.level`,
			`navigation.to`,
			`navigation.from`,
			`navigation.source`,
		}...)
	case opsys.AppleFamily:
		cols = append(cols, []string{
			`exception.error`,
			`lifecycle_view_controller.type`,
			`lifecycle_view_controller.class_name`,
			`lifecycle_swift_ui.type`,
			`lifecycle_swift_ui.class_name`,
			`memory_usage_absolute.max_memory`,
			`memory_usage_absolute.used_memory`,
			`memory_usage_absolute.interval`,
		}...)
	}

	// We look up the app version from sessions_index table
	// to speed up the query to fetch events for the session
	//
	// This allows us to stay on the fast binary search path
	// using the table's native ORDER BY sequence.
	stmt := sqlf.From("events").
		With("session_app_version", sessionAppVersion)

	defer stmt.Close()

	for i := range cols {
		stmt.Select(cols[i])
	}

	stmt.Where("team_id = toUUID(?)", a.TeamId)
	stmt.Where("app_id = toUUID(?)", a.ID)
	stmt.Where("attribute.app_version in (select app_version.1 from session_app_version)")
	stmt.Where("attribute.app_build in (select app_version.2 from session_app_version)")
	stmt.Where("timestamp >= (select start_time from session_app_version) and timestamp <= (select end_time from session_app_version)")
	stmt.Where("session_id = toUUID(?)", sessionId)
	stmt.OrderBy("timestamp")

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)

	if err != nil {
		return nil, err
	}

	var session Session
	var firstUserID string

	for rows.Next() {
		var ev event.EventField
		var anr event.ANR
		var exception event.Exception
		var exceptionExceptions string
		var exceptionThreads string
		var anrExceptions string
		var anrThreads string
		var attachments string

		var appExit event.AppExit
		var logString event.LogString
		var gestureLongClick event.GestureLongClick
		var gestureClick event.GestureClick
		var gestureScroll event.GestureScroll
		var lifecycleActivity event.LifecycleActivity
		var lifecycleFragment event.LifecycleFragment
		var lifecycleApp event.LifecycleApp
		var coldLaunch event.ColdLaunch
		var warmLaunch event.WarmLaunch
		var hotLaunch event.HotLaunch
		var networkChange event.NetworkChange
		var http event.Http
		var memoryUsage event.MemoryUsage
		var lowMemory event.LowMemory
		var trimMemory event.TrimMemory
		var cpuUsage event.CPUUsage
		var navigation event.Navigation
		var screenView event.ScreenView
		var userDefAttr map[string][]any
		var bugReport event.BugReport
		var custom event.Custom

		var coldLaunchDuration uint32
		var warmLaunchDuration uint32
		var hotLaunchDuration uint32

		var exceptionError string
		var lifecycleViewController event.LifecycleViewController
		var lifecycleSwiftUI event.LifecycleSwiftUI
		var memoryUsageAbs event.MemoryUsageAbs

		dest := []any{
			&ev.ID,
			&ev.Type,
			&session.SessionID,
			&session.AppID,
			&ev.IPv4,
			&ev.IPv6,
			&ev.CountryCode,
			&ev.Timestamp,
			&ev.UserTriggered,
			&attachments,

			// attribute
			&ev.Attribute.InstallationID,
			&ev.Attribute.AppVersion,
			&ev.Attribute.AppBuild,
			&ev.Attribute.AppUniqueID,
			&ev.Attribute.Platform,
			&ev.Attribute.MeasureSDKVersion,
			&ev.Attribute.ThreadName,
			&ev.Attribute.UserID,
			&ev.Attribute.DeviceName,
			&ev.Attribute.DeviceModel,
			&ev.Attribute.DeviceManufacturer,
			&ev.Attribute.DeviceType,
			&ev.Attribute.DeviceIsFoldable,
			&ev.Attribute.DeviceIsPhysical,
			&ev.Attribute.DeviceDensityDPI,
			&ev.Attribute.DeviceWidthPX,
			&ev.Attribute.DeviceHeightPX,
			&ev.Attribute.DeviceDensity,
			&ev.Attribute.DeviceLocale,
			&ev.Attribute.OSName,
			&ev.Attribute.OSVersion,
			&ev.Attribute.NetworkType,
			&ev.Attribute.NetworkGeneration,
			&ev.Attribute.NetworkProvider,

			// user defined attributes
			&userDefAttr,

			// gesture long click
			&gestureLongClick.Target,
			&gestureLongClick.TargetID,
			&gestureLongClick.TouchDownTime,
			&gestureLongClick.TouchUpTime,
			&gestureLongClick.Width,
			&gestureLongClick.Height,
			&gestureLongClick.X,
			&gestureLongClick.Y,

			// gesture click
			&gestureClick.Target,
			&gestureClick.TargetID,
			&gestureClick.TouchDownTime,
			&gestureClick.TouchUpTime,
			&gestureClick.Width,
			&gestureClick.Height,
			&gestureClick.X,
			&gestureClick.Y,

			// gesture scroll
			&gestureScroll.Target,
			&gestureScroll.TargetID,
			&gestureScroll.TouchDownTime,
			&gestureScroll.TouchUpTime,
			&gestureScroll.X,
			&gestureScroll.Y,
			&gestureScroll.EndX,
			&gestureScroll.EndY,
			&gestureScroll.Direction,

			// excpetion
			&exception.Handled,
			&exception.Fingerprint,
			&exception.Foreground,
			&exceptionExceptions,
			&exceptionThreads,
			&exception.Framework,

			// lifecycle app
			&lifecycleApp.Type,

			// cold launch
			&coldLaunch.ProcessStartUptime,
			&coldLaunch.ProcessStartRequestedUptime,
			&coldLaunch.ContentProviderAttachUptime,
			&coldLaunch.OnNextDrawUptime,
			&coldLaunch.LaunchedActivity,
			&coldLaunch.HasSavedState,
			&coldLaunch.IntentData,
			&coldLaunchDuration,

			// warm launch
			&warmLaunch.AppVisibleUptime,
			&warmLaunch.ProcessStartUptime,
			&warmLaunch.ProcessStartRequestedUptime,
			&warmLaunch.ContentProviderAttachUptime,
			&warmLaunch.OnNextDrawUptime,
			&warmLaunch.LaunchedActivity,
			&warmLaunch.HasSavedState,
			&warmLaunch.IntentData,
			&warmLaunchDuration,
			&warmLaunch.IsLukewarm,

			// hot launch
			&hotLaunch.AppVisibleUptime,
			&hotLaunch.OnNextDrawUptime,
			&hotLaunch.LaunchedActivity,
			&hotLaunch.HasSavedState,
			&hotLaunch.IntentData,
			&hotLaunchDuration,

			// network change
			&networkChange.NetworkType,
			&networkChange.PreviousNetworkType,
			&networkChange.NetworkGeneration,
			&networkChange.PreviousNetworkGeneration,
			&networkChange.NetworkProvider,

			// http
			&http.URL,
			&http.Method,
			&http.StatusCode,
			&http.StartTime,
			&http.EndTime,
			&http.RequestHeaders,
			&http.ResponseHeaders,
			&http.RequestBody,
			&http.ResponseBody,
			&http.FailureReason,
			&http.FailureDescription,
			&http.Client,

			// cpu usage
			&cpuUsage.NumCores,
			&cpuUsage.ClockSpeed,
			&cpuUsage.StartTime,
			&cpuUsage.Uptime,
			&cpuUsage.UTime,
			&cpuUsage.CUTime,
			&cpuUsage.STime,
			&cpuUsage.CSTime,
			&cpuUsage.Interval,
			&cpuUsage.PercentageUsage,

			// screen view
			&screenView.Name,

			// bug report
			&bugReport.Description,

			// custom
			&custom.Name,
		}

		switch opsys.ToFamily(a.OSName) {
		case opsys.Android:
			dest = append(dest, []any{
				// anr
				&anr.Fingerprint,
				&anr.Foreground,
				&anrExceptions,
				&anrThreads,

				// app exit
				&appExit.Reason,
				&appExit.Importance,
				&appExit.Trace,
				&appExit.ProcessName,
				&appExit.PID,

				// log string
				&logString.SeverityText,
				&logString.String,

				// lifecycle activity
				&lifecycleActivity.Type,
				&lifecycleActivity.ClassName,
				&lifecycleActivity.Intent,
				&lifecycleActivity.SavedInstanceState,

				// lifecycle fragment
				&lifecycleFragment.Type,
				&lifecycleFragment.ClassName,
				&lifecycleFragment.ParentActivity,
				&lifecycleFragment.ParentFragment,
				&lifecycleFragment.Tag,

				// memory usage
				&memoryUsage.JavaMaxHeap,
				&memoryUsage.JavaTotalHeap,
				&memoryUsage.JavaFreeHeap,
				&memoryUsage.TotalPSS,
				&memoryUsage.RSS,
				&memoryUsage.NativeTotalHeap,
				&memoryUsage.NativeFreeHeap,
				&memoryUsage.Interval,

				// low memory
				&lowMemory.JavaMaxHeap,
				&lowMemory.JavaTotalHeap,
				&lowMemory.JavaFreeHeap,
				&lowMemory.TotalPSS,
				&lowMemory.RSS,
				&lowMemory.NativeTotalHeap,
				&lowMemory.NativeFreeHeap,

				// trim memory
				&trimMemory.Level,

				// navigation
				&navigation.To,
				&navigation.From,
				&navigation.Source,
			}...)
		case opsys.AppleFamily:
			dest = append(dest, []any{
				&exceptionError,
				&lifecycleViewController.Type,
				&lifecycleViewController.ClassName,
				&lifecycleSwiftUI.Type,
				&lifecycleSwiftUI.ClassName,
				&memoryUsageAbs.MaxMemory,
				&memoryUsageAbs.UsedMemory,
				&memoryUsageAbs.Interval,
			}...)
		}

		if err := rows.Scan(dest...); err != nil {
			return nil, err
		}

		// Capture first non-empty user ID (add this after the scan)
		if firstUserID == "" && ev.Attribute.UserID != "" {
			firstUserID = ev.Attribute.UserID
		}

		// populate user defined attribute
		if len(userDefAttr) > 0 {
			ev.UserDefinedAttribute.Scan(userDefAttr)
		}

		switch ev.Type {
		case event.TypeANR:
			if err := json.Unmarshal([]byte(anrExceptions), &anr.Exceptions); err != nil {
				return nil, err
			}
			if err := json.Unmarshal([]byte(anrThreads), &anr.Threads); err != nil {
				return nil, err
			}
			if err := json.Unmarshal([]byte(attachments), &ev.Attachments); err != nil {
				return nil, err
			}
			ev.ANR = &anr
			session.Events = append(session.Events, ev)
		case event.TypeException:
			if err := json.Unmarshal([]byte(exceptionExceptions), &exception.Exceptions); err != nil {
				return nil, err
			}

			if err := json.Unmarshal([]byte(exceptionThreads), &exception.Threads); err != nil {
				return nil, err
			}

			if err := json.Unmarshal([]byte(attachments), &ev.Attachments); err != nil {
				return nil, err
			}

			// for now, only unmarshal exception.error for Apple
			// family of OSes. support can - of course, be extended
			// to other OSes on a "need to" basis.
			switch opsys.ToFamily(a.OSName) {
			case opsys.AppleFamily:
				fmt.Println("exceptionError", exceptionError)
				if exceptionError != "" {
					if err := json.Unmarshal([]byte(exceptionError), &exception.Error); err != nil {
						return nil, err
					}
				}
			}

			ev.Exception = &exception
			session.Events = append(session.Events, ev)
		case event.TypeAppExit:
			ev.AppExit = &appExit
			session.Events = append(session.Events, ev)
		case event.TypeString:
			ev.LogString = &logString
			session.Events = append(session.Events, ev)
		case event.TypeGestureLongClick:
			// only unmarshal attachments if more than
			// 8 characters
			if len(attachments) > 8 {
				if err := json.Unmarshal([]byte(attachments), &ev.Attachments); err != nil {
					return nil, err
				}
			}
			ev.GestureLongClick = &gestureLongClick
			session.Events = append(session.Events, ev)
		case event.TypeGestureClick:
			// only unmarshal attachments if more than
			// 8 characters
			if len(attachments) > 8 {
				if err := json.Unmarshal([]byte(attachments), &ev.Attachments); err != nil {
					return nil, err
				}
			}
			if err := json.Unmarshal([]byte(attachments), &ev.Attachments); err != nil {
				return nil, err
			}
			ev.GestureClick = &gestureClick
			session.Events = append(session.Events, ev)
		case event.TypeGestureScroll:
			// only unmarshal attachments if more than
			// 8 characters
			if len(attachments) > 8 {
				if err := json.Unmarshal([]byte(attachments), &ev.Attachments); err != nil {
					return nil, err
				}
			}
			ev.GestureScroll = &gestureScroll
			session.Events = append(session.Events, ev)
		case event.TypeLifecycleActivity:
			ev.LifecycleActivity = &lifecycleActivity
			session.Events = append(session.Events, ev)
		case event.TypeLifecycleFragment:
			ev.LifecycleFragment = &lifecycleFragment
			session.Events = append(session.Events, ev)
		case event.TypeLifecycleApp:
			ev.LifecycleApp = &lifecycleApp
			session.Events = append(session.Events, ev)
		case event.TypeColdLaunch:
			ev.ColdLaunch = &coldLaunch
			ev.ColdLaunch.Duration = time.Duration(coldLaunchDuration)
			session.Events = append(session.Events, ev)
		case event.TypeWarmLaunch:
			ev.WarmLaunch = &warmLaunch
			ev.WarmLaunch.Duration = time.Duration(warmLaunchDuration)
			session.Events = append(session.Events, ev)
		case event.TypeHotLaunch:
			ev.HotLaunch = &hotLaunch
			ev.HotLaunch.Duration = time.Duration(hotLaunchDuration)
			session.Events = append(session.Events, ev)
		case event.TypeNetworkChange:
			ev.NetworkChange = &networkChange
			session.Events = append(session.Events, ev)
		case event.TypeHttp:
			ev.Http = &http
			session.Events = append(session.Events, ev)
		case event.TypeMemoryUsage:
			ev.MemoryUsage = &memoryUsage
			session.Events = append(session.Events, ev)
		case event.TypeLowMemory:
			ev.LowMemory = &lowMemory
			session.Events = append(session.Events, ev)
		case event.TypeTrimMemory:
			ev.TrimMemory = &trimMemory
			session.Events = append(session.Events, ev)
		case event.TypeCPUUsage:
			ev.CPUUsage = &cpuUsage
			session.Events = append(session.Events, ev)
		case event.TypeNavigation:
			ev.Navigation = &navigation
			session.Events = append(session.Events, ev)
		case event.TypeScreenView:
			ev.ScreenView = &screenView
			session.Events = append(session.Events, ev)
		case event.TypeBugReport:
			if err := json.Unmarshal([]byte(attachments), &ev.Attachments); err != nil {
				return nil, err
			}
			ev.BugReport = &bugReport
			session.Events = append(session.Events, ev)
		case event.TypeCustom:
			ev.Custom = &custom
			session.Events = append(session.Events, ev)
		case event.TypeLifecycleViewController:
			ev.LifecycleViewController = &lifecycleViewController
			session.Events = append(session.Events, ev)
		case event.TypeLifecycleSwiftUI:
			ev.LifecycleSwiftUI = &lifecycleSwiftUI
			session.Events = append(session.Events, ev)
		case event.TypeMemoryUsageAbs:
			ev.MemoryUsageAbs = &memoryUsageAbs
			session.Events = append(session.Events, ev)
		default:
			continue
		}
	}

	// attach session's first event attribute
	// as the session's attributes
	if len(session.Events) > 0 {
		attr := session.Events[0].Attribute
		// Override with the first non-empty user ID we found
		if firstUserID != "" {
			attr.UserID = firstUserID
		}
		session.Attribute = &attr
	}

	return &session, nil
}

func NewApp(teamId uuid.UUID) *App {
	now := time.Now()
	id := uuid.New()
	return &App{
		ID:        &id,
		TeamId:    teamId,
		Retention: FREE_PLAN_MAX_RETENTION_DAYS,
		CreatedAt: now,
		UpdatedAt: now,
	}
}

// SelectApp selects app by its id.
func SelectApp(ctx context.Context, id uuid.UUID) (app *App, err error) {
	var onboarded pgtype.Bool
	var uniqueId pgtype.Text
	var os pgtype.Text
	var firstVersion pgtype.Text

	stmt := sqlf.PostgreSQL.
		Select("id").
		Select("team_id").
		Select("onboarded").
		Select("unique_identifier").
		Select("os_name").
		Select("first_version").
		From("apps").
		Where("id = ?", id)

	defer stmt.Close()

	if app == nil {
		app = &App{}
	}

	if err := server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&app.ID, &app.TeamId, &onboarded, &uniqueId, &os, &firstVersion); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		} else {
			return nil, err
		}
	}

	if onboarded.Valid {
		app.Onboarded = onboarded.Bool
	} else {
		app.Onboarded = false
	}

	if uniqueId.Valid {
		app.UniqueId = uniqueId.String
	} else {
		app.UniqueId = ""
	}

	if os.Valid {
		app.OSName = os.String
	} else {
		app.OSName = ""
	}

	if firstVersion.Valid {
		app.FirstVersion = firstVersion.String
	} else {
		app.FirstVersion = ""
	}

	return
}

func GetAppJourney(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		fmt.Println(err.Error())
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "app journey request validation failed"

	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := App{
		ID: &id,
	}

	if err := app.Populate(ctx); err != nil {
		msg := `failed to fetch app details`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError

		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
			msg = fmt.Sprintf(`app with id %q does not exist`, app.ID)
		}

		c.JSON(status, gin.H{
			"error": msg,
		})

		return
	}

	team := &Team{
		ID: &app.TeamId,
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	ctx = ambient.WithTeamId(ctx, *team.ID)

	msg = `failed to compute app's journey`
	opts := filter.JourneyOpts{
		All: true,
	}

	lc := logcomment.New(2)
	lc.MustPut(logcomment.Root, logcomment.Journeys)

	settings := clickhouse.Settings{
		"log_comment": lc.String(),
		"max_threads": 32,
	}

	ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "journey_events")
	journeyEvents, err := app.getJourneyEvents(ctx, &af, opts)
	if err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	var issueEvents []event.EventField

	for i := range journeyEvents {
		if journeyEvents[i].IsUnhandledException() {
			issueEvents = append(issueEvents, journeyEvents[i])
		}
		if app.OSName == opsys.Android && journeyEvents[i].IsANR() {
			issueEvents = append(issueEvents, journeyEvents[i])
		}
	}

	var journeyGraph journey.Journey
	type Link struct {
		Source string `json:"source"`
		Target string `json:"target"`
		Value  int    `json:"value"`
	}

	type Issue struct {
		ID    string `json:"id"`
		Title string `json:"title"`
		Count uint64 `json:"count"`
	}

	type Node struct {
		ID     string `json:"id"`
		Issues gin.H  `json:"issues"`
	}

	var nodes []Node
	var links []Link

	switch opsys.ToFamily(app.OSName) {
	case opsys.Android:
		journeyGraph = journey.NewJourneyAndroid(journeyEvents, &journey.Options{
			BiGraph: af.BiGraph,
		})
	case opsys.AppleFamily:
		journeyGraph = journey.NewJourneyiOS(journeyEvents, &journey.Options{
			BiGraph: af.BiGraph,
		})
	}

	switch j := journeyGraph.(type) {
	case *journey.JourneyAndroid:
		// if err := j.SetNodeExceptionGroups(func(eventIds []uuid.UUID) (exceptionGroups []group.ExceptionGroup, err error) {
		// 	// do not hit database if no event ids
		// 	// to query
		// 	if len(eventIds) == 0 {
		// 		return
		// 	}

		// 	ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "exception_groups_from_ids")

		// 	exceptionGroups, err = group.GetExceptionGroupsFromExceptionIds(ctx, &af, eventIds)
		// 	if err != nil {
		// 		return
		// 	}

		// 	return
		// }); err != nil {
		// 	fmt.Println(msg, err)
		// 	c.JSON(http.StatusInternalServerError, gin.H{
		// 		"error": msg,
		// 	})
		// 	return
		// }

		// if err := j.SetNodeANRGroups(func(eventIds []uuid.UUID) (anrGroups []group.ANRGroup, err error) {
		// 	// do not hit database if no event ids
		// 	// to query
		// 	if len(eventIds) == 0 {
		// 		return
		// 	}

		// 	ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "anr_groups_from_ids")

		// 	anrGroups, err = group.GetANRGroupsFromANRIds(ctx, &af, eventIds)
		// 	if err != nil {
		// 		return
		// 	}

		// 	return
		// }); err != nil {
		// 	fmt.Println(msg, err)
		// 	c.JSON(http.StatusInternalServerError, gin.H{
		// 		"error": msg,
		// 	})
		// 	return
		// }

		if err := j.SetExceptionGroups(ctx, &af); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}

		if err := j.SetANRGroups(ctx, &af); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}

		for v := range j.Graph.Order() {
			j.Graph.Visit(v, func(w int, c int64) bool {
				var link Link
				link.Source = j.GetNodeName(v)
				link.Target = j.GetNodeName(w)
				link.Value = j.GetEdgeSessionCount(v, w)
				links = append(links, link)
				return false
			})
		}

		for _, v := range j.GetNodeVertices() {
			var node Node
			name := j.GetNodeName(v)
			exceptionGroups := j.GetNodeExceptionGroups(name)
			crashes := []Issue{}

			for i := range exceptionGroups {
				issue := Issue{
					ID:    exceptionGroups[i].ID,
					Title: exceptionGroups[i].GetDisplayTitle(),
					// Count: j.GetNodeExceptionCount(v, exceptionGroups[i].ID),
					Count: exceptionGroups[i].Count,
				}
				crashes = append(crashes, issue)
			}

			// crashes are shown in descending order
			sort.Slice(crashes, func(i, j int) bool {
				return crashes[i].Count > crashes[j].Count
			})

			anrGroups := j.GetNodeANRGroups(name)
			anrs := []Issue{}

			for i := range anrGroups {
				issue := Issue{
					ID:    anrGroups[i].ID,
					Title: anrGroups[i].GetDisplayTitle(),
					// Count: j.GetNodeANRCount(v, anrGroups[i].ID),
					Count: anrGroups[i].Count,
				}
				anrs = append(anrs, issue)
			}

			// ANRs are shown in descending order
			sort.Slice(anrs, func(i, j int) bool {
				return anrs[i].Count > anrs[j].Count
			})

			node.ID = name
			node.Issues = gin.H{
				"crashes": crashes,
				"anrs":    anrs,
			}
			nodes = append(nodes, node)
		}
	case *journey.JourneyiOS:
		// if err := j.SetNodeExceptionGroups(func(eventIds []uuid.UUID) (exceptionGroups []group.ExceptionGroup, err error) {
		// 	// do not hit database if no event ids
		// 	// to query
		// 	if len(eventIds) == 0 {
		// 		return
		// 	}

		// 	ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "exception_groups_from_ids")

		// 	exceptionGroups, err = group.GetExceptionGroupsFromExceptionIds(ctx, &af, eventIds)
		// 	if err != nil {
		// 		return
		// 	}

		// 	return
		// }); err != nil {
		// 	fmt.Println(msg, err)
		// 	c.JSON(http.StatusInternalServerError, gin.H{
		// 		"error": msg,
		// 	})
		// 	return
		// }

		if err := j.SetExceptionGroups(ctx, &af); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}

		for v := range j.Graph.Order() {
			j.Graph.Visit(v, func(w int, c int64) bool {
				var link Link
				link.Source = j.GetNodeName(v)
				link.Target = j.GetNodeName(w)
				link.Value = j.GetEdgeSessionCount(v, w)
				links = append(links, link)
				return false
			})
		}

		for _, v := range j.GetNodeVertices() {
			var node Node
			name := j.GetNodeName(v)
			exceptionGroups := j.GetNodeExceptionGroups(name)
			crashes := []Issue{}

			for i := range exceptionGroups {
				issue := Issue{
					ID:    exceptionGroups[i].ID,
					Title: exceptionGroups[i].GetDisplayTitle(),
					// Count: uint64(j.GetNodeExceptionCount(v, exceptionGroups[i].ID)),
					Count: exceptionGroups[i].Count,
				}
				crashes = append(crashes, issue)
			}

			// crashes are shown in descending order
			sort.Slice(crashes, func(i, j int) bool {
				return crashes[i].Count > crashes[j].Count
			})

			node.ID = name
			node.Issues = gin.H{
				"crashes": crashes,
				"anrs":    []Issue{},
			}
			nodes = append(nodes, node)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"totalIssues": len(issueEvents),
		"nodes":       nodes,
		"links":       links,
	})
}

func GetAppMetrics(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse app metrics request`
		fmt.Println(msg, err.Error())
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := `app metrics request validation failed`

	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := App{
		ID: &id,
	}

	if err := app.Populate(ctx); err != nil {
		msg := `failed to fetch app details`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError

		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
			msg = fmt.Sprintf(`app with id %q does not exist`, app.ID)
		}

		c.JSON(status, gin.H{
			"error": msg,
		})

		return
	}

	af.AppOSName = app.OSName

	team := &Team{
		ID: &app.TeamId,
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	ctx = ambient.WithTeamId(ctx, app.TeamId)

	excludedVersions, err := af.GetExcludedVersions(ctx)
	if err != nil {
		msg := `failed to fetch excluded versions`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	var metricsGroup errgroup.Group

	// each go routine isolates log comment &
	// clickhouse settings for safe concurrency

	var adoption *metrics.SessionAdoption
	metricsGroup.Go(func() (err error) {
		lc := logcomment.New(2)
		settings := clickhouse.Settings{
			"log_comment":     lc.MustPut(logcomment.Root, logcomment.Metrics).String(),
			"use_query_cache": gin.Mode() == gin.ReleaseMode,
			"query_cache_ttl": int(config.DefaultQueryCacheTTL.Seconds()),
		}
		ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "adoption")

		adoption, err = app.GetAdoptionMetrics(ctx, &af)
		if err != nil {
			err = fmt.Errorf("failed to fetch adoption metrics: %w\n", err)
		}
		return
	})

	var crashFree *metrics.CrashFreeSession
	var perceivedCrashFree *metrics.PerceivedCrashFreeSession
	var anrFree *metrics.ANRFreeSession
	var perceivedANRFree *metrics.PerceivedANRFreeSession
	metricsGroup.Go(func() (err error) {
		lc := logcomment.New(2)
		settings := clickhouse.Settings{
			"log_comment":     lc.MustPut(logcomment.Root, logcomment.Metrics).String(),
			"use_query_cache": gin.Mode() == gin.ReleaseMode,
			"query_cache_ttl": int(config.DefaultQueryCacheTTL.Seconds()),
		}
		ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "issue_free")

		crashFree, perceivedCrashFree, anrFree, perceivedANRFree, err = app.GetIssueFreeMetrics(ctx, &af, excludedVersions)
		if err != nil {
			err = fmt.Errorf("failed to fetch issue free metrics: %w\n", err)
		}
		return
	})

	var launch *metrics.LaunchMetric
	metricsGroup.Go(func() (err error) {
		lc := logcomment.New(2)
		settings := clickhouse.Settings{
			"log_comment":     lc.MustPut(logcomment.Root, logcomment.Metrics).String(),
			"use_query_cache": gin.Mode() == gin.ReleaseMode,
			"query_cache_ttl": int(config.DefaultQueryCacheTTL.Seconds()),
		}
		ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "launch")

		launch, err = app.GetLaunchMetrics(ctx, &af)
		if err != nil {
			err = fmt.Errorf("failed to fetch launch metrics: %w\n", err)
		}
		return
	})

	var sizes *metrics.SizeMetric = nil
	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 && !af.HasMultiVersions() {
		metricsGroup.Go(func() (err error) {
			lc := logcomment.New(2)
			settings := clickhouse.Settings{
				"log_comment":     lc.MustPut(logcomment.Root, logcomment.Metrics).String(),
				"use_query_cache": gin.Mode() == gin.ReleaseMode,
				"query_cache_ttl": int(config.DefaultQueryCacheTTL.Seconds()),
			}
			ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "sizes")

			sizes, err = app.GetSizeMetrics(ctx, &af, excludedVersions)
			if err != nil {
				err = fmt.Errorf("failed to fetch size metrics: %w\n", err)
			}
			return
		})
	}

	if err = metricsGroup.Wait(); err != nil {
		err = fmt.Errorf("failed to fetch metrics: %w\n", err)
		fmt.Println(err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})

		return
	}

	c.JSON(http.StatusOK, gin.H{
		"cold_launch": gin.H{
			"p95":       launch.ColdLaunchP95,
			"delta":     launch.ColdDelta,
			"nan":       launch.ColdNaN,
			"delta_nan": launch.ColdDeltaNaN,
		},
		"warm_launch": gin.H{
			"p95":       launch.WarmLaunchP95,
			"delta":     launch.WarmDelta,
			"nan":       launch.WarmNaN,
			"delta_nan": launch.WarmDeltaNaN,
		},
		"hot_launch": gin.H{
			"p95":       launch.HotLaunchP95,
			"delta":     launch.HotDelta,
			"nan":       launch.HotNaN,
			"delta_nan": launch.HotDeltaNaN,
		},
		"adoption":                      adoption,
		"sizes":                         sizes,
		"crash_free_sessions":           crashFree,
		"anr_free_sessions":             anrFree,
		"perceived_crash_free_sessions": perceivedCrashFree,
		"perceived_anr_free_sessions":   perceivedANRFree,
	})
}

func GetAppFilters(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	ctx := c.Request.Context()

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Validate(); err != nil {
		msg := "app filters request validation failed"
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	app, err := SelectApp(ctx, id)
	if err != nil {
		msg := "failed to select app"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	af.AppOSName = app.OSName

	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	ctx = ambient.WithTeamId(ctx, *team.ID)

	var fl filter.FilterList

	if err := af.GetGenericFilters(ctx, &fl); err != nil {
		msg := `failed to query app filters`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	// club version names & version codes
	var versions []any
	for i := range fl.Versions {
		version := gin.H{"name": fl.Versions[i], "code": fl.VersionCodes[i]}
		versions = append(versions, version)
	}

	// club os names & versions
	var osVersions []any
	for i := range fl.OsVersions {
		osVersion := gin.H{"name": fl.OsNames[i], "version": fl.OsVersions[i]}
		osVersions = append(osVersions, osVersion)
	}

	udAttrs := gin.H{
		"operator_types": nil,
		"key_types":      nil,
	}

	// set user defined attribute keys only if
	// requested
	if af.UDAttrKeys {
		udAttrs["operator_types"] = event.GetUDAttrsOpMap()
		udAttrs["key_types"] = fl.UDKeyTypes
	}

	c.JSON(http.StatusOK, gin.H{
		"versions":             versions,
		"os_versions":          osVersions,
		"countries":            fl.Countries,
		"network_providers":    fl.NetworkProviders,
		"network_types":        fl.NetworkTypes,
		"network_generations":  fl.NetworkGenerations,
		"locales":              fl.DeviceLocales,
		"device_manufacturers": fl.DeviceManufacturers,
		"device_names":         fl.DeviceNames,
		"ud_attrs":             udAttrs,
	})
}

func GetCrashOverview(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "crash overview request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	app.TeamId = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.MustPut(logcomment.Root, logcomment.Crashes).String(),
	}

	ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "crashes_list")

	crashGroups, next, previous, err := app.GetExceptionGroupsWithFilter(ctx, &af)
	if err != nil {
		msg := "failed to get app's exception groups with filter"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	meta := gin.H{
		"next":     next,
		"previous": previous,
	}

	c.JSON(http.StatusOK, gin.H{
		"results": crashGroups,
		"meta":    meta,
	})
}

func GetCrashOverviewPlotInstances(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := `crash overview request validation failed`

	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	app.TeamId = *team.ID
	ctx = ambient.WithTeamId(ctx, *team.ID)

	var crashInstances []event.IssueInstance

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.MustPut(logcomment.Root, logcomment.Crashes).String(),
	}

	ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "plots_instances")

	crashInstances, err = app.GetExceptionPlotInstances(ctx, &af)
	if err != nil {
		msg := `failed to query exception instances`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	type instance struct {
		ID   string  `json:"id"`
		Data []gin.H `json:"data"`
	}

	lut := make(map[string]int)
	var instances []instance

	for i := range crashInstances {
		instance := instance{
			ID: crashInstances[i].Version,
			Data: []gin.H{{
				"datetime":            crashInstances[i].DateTime,
				"instances":           crashInstances[i].Instances,
				"crash_free_sessions": crashInstances[i].IssueFreeSessions,
			}},
		}

		ndx, ok := lut[crashInstances[i].Version]

		if ok {
			instances[ndx].Data = append(instances[ndx].Data, instance.Data...)
		} else {
			instances = append(instances, instance)
			lut[crashInstances[i].Version] = len(instances) - 1
		}
	}

	c.JSON(http.StatusOK, instances)
}

func GetCrashDetailCrashes(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	crashGroupId := c.Param("crashGroupId")
	if crashGroupId == "" {
		msg := `crash group id is invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "app filters request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	app.TeamId = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.MustPut(logcomment.Root, logcomment.Crashes).String(),
	}

	ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "detail-stacktrace")

	eventExceptions, next, previous, err := app.GetExceptionsWithFilter(ctx, crashGroupId, &af)
	if err != nil {
		msg := `failed to get exception group's exception events`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	// set appropriate attachment URLs
	for i := range eventExceptions {
		if len(eventExceptions[i].Attachments) > 0 {
			for j := range eventExceptions[i].Attachments {
				if err := eventExceptions[i].Attachments[j].PreSignURL(ctx); err != nil {
					msg := `failed to generate URLs for attachment`
					fmt.Println(msg, err)
					c.JSON(http.StatusInternalServerError, gin.H{
						"error": msg,
					})
					return
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"results": eventExceptions,
		"meta": gin.H{
			"next":     next,
			"previous": previous,
		},
	})
}

func GetCrashDetailPlotInstances(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	crashGroupId := c.Param("crashGroupId")
	if crashGroupId == "" {
		msg := `crash group id is invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "app filters request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	app.TeamId = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.
			MustPut(logcomment.Root, logcomment.Crashes).
			String(),
	}

	ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "detail_plots_instances")

	crashInstances, err := app.GetExceptionGroupPlotInstances(ctx, crashGroupId, &af)
	if err != nil {
		msg := `failed to query data for crash instances plot`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	type instance struct {
		ID   string  `json:"id"`
		Data []gin.H `json:"data"`
	}

	lut := make(map[string]int)
	var instances []instance

	for i := range crashInstances {
		instance := instance{
			ID: crashInstances[i].Version,
			Data: []gin.H{{
				"datetime":  crashInstances[i].DateTime,
				"instances": crashInstances[i].Instances,
			}},
		}

		ndx, ok := lut[crashInstances[i].Version]

		if ok {
			instances[ndx].Data = append(instances[ndx].Data, instance.Data...)
		} else {
			instances = append(instances, instance)
			lut[crashInstances[i].Version] = len(instances) - 1
		}
	}

	c.JSON(http.StatusOK, instances)
}

func GetCrashDetailAttributeDistribution(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	crashGroupId := c.Param("crashGroupId")
	if crashGroupId == "" {
		msg := `crash group id is invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "app filters request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	app.TeamId = *team.ID

	lc := logcomment.New(2)
	lc.MustPut(logcomment.Root, logcomment.Crashes)

	settings := clickhouse.Settings{
		"log_comment": lc.String(),
	}

	ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "plots_distribution")

	distribution, err := app.GetExceptionAttributesDistribution(ctx, crashGroupId, &af)
	if err != nil {
		msg := `failed to query data for crash distribution plot`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, distribution)
}

func GetANROverview(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "anr overview request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	app.TeamId = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.MustPut(logcomment.Root, logcomment.ANRs).String(),
	}

	ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "anrs_list")

	anrGroups, next, previous, err := app.GetANRGroupsWithFilter(ctx, &af)
	if err != nil {
		msg := "failed to get app's anr groups matching filter"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	meta := gin.H{
		"next":     next,
		"previous": previous,
	}

	c.JSON(http.StatusOK, gin.H{
		"results": anrGroups,
		"meta":    meta,
	})
}

func GetANROverviewPlotInstances(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "ANR overview request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	app.TeamId = *team.ID
	ctx = ambient.WithTeamId(ctx, *team.ID)

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.MustPut(logcomment.Root, logcomment.ANRs).String(),
	}

	ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "plots_instances")

	anrInstances, err := app.GetANRPlotInstances(ctx, &af)
	if err != nil {
		msg := `failed to query exception instances`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	type instance struct {
		ID   string  `json:"id"`
		Data []gin.H `json:"data"`
	}

	lut := make(map[string]int)
	var instances []instance

	for i := range anrInstances {
		instance := instance{
			ID: anrInstances[i].Version,
			Data: []gin.H{{
				"datetime":          anrInstances[i].DateTime,
				"instances":         anrInstances[i].Instances,
				"anr_free_sessions": anrInstances[i].IssueFreeSessions,
			}},
		}

		ndx, ok := lut[anrInstances[i].Version]

		if ok {
			instances[ndx].Data = append(instances[ndx].Data, instance.Data...)
		} else {
			instances = append(instances, instance)
			lut[anrInstances[i].Version] = len(instances) - 1
		}
	}

	c.JSON(http.StatusOK, instances)
}

func GetANRDetailANRs(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	anrGroupId := c.Param("anrGroupId")
	if anrGroupId == "" {
		msg := `anr group id is invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "app filters request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	app.TeamId = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.MustPut(logcomment.Root, logcomment.ANRs).String(),
	}

	ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "detail-stacktrace")

	eventANRs, next, previous, err := app.GetANRsWithFilter(ctx, anrGroupId, &af)
	if err != nil {
		msg := `failed to get anr group's anr events`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	// set appropriate attachment URLs
	for i := range eventANRs {
		if len(eventANRs[i].Attachments) > 0 {
			for j := range eventANRs[i].Attachments {
				if err := eventANRs[i].Attachments[j].PreSignURL(ctx); err != nil {
					msg := `failed to generate URLs for attachment`
					fmt.Println(msg, err)
					c.JSON(http.StatusInternalServerError, gin.H{
						"error": msg,
					})
					return
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"results": eventANRs,
		"meta": gin.H{
			"next":     next,
			"previous": previous,
		},
	})
}

func GetANRDetailPlotInstances(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	anrGroupId := c.Param("anrGroupId")
	if anrGroupId == "" {
		msg := `anr group id is invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "app filters request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	app.TeamId = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.
			MustPut(logcomment.Root, logcomment.ANRs).
			String(),
	}

	ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "detail_plots_instances")

	anrInstances, err := app.GetANRGroupPlotInstances(ctx, anrGroupId, &af)
	if err != nil {
		msg := `failed to query data for anr instances plot`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	type instance struct {
		ID   string  `json:"id"`
		Data []gin.H `json:"data"`
	}

	lut := make(map[string]int)
	var instances []instance

	for i := range anrInstances {
		instance := instance{
			ID: anrInstances[i].Version,
			Data: []gin.H{{
				"datetime":  anrInstances[i].DateTime,
				"instances": anrInstances[i].Instances,
			}},
		}

		ndx, ok := lut[anrInstances[i].Version]

		if ok {
			instances[ndx].Data = append(instances[ndx].Data, instance.Data...)
		} else {
			instances = append(instances, instance)
			lut[anrInstances[i].Version] = len(instances) - 1
		}
	}

	c.JSON(http.StatusOK, instances)
}

func GetANRDetailAttributeDistribution(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	anrGroupId := c.Param("anrGroupId")
	if anrGroupId == "" {
		msg := `anr group id is invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "app filters request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	app.TeamId = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.MustPut(logcomment.Root, logcomment.ANRs),
	}

	ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "plots_distribution")

	distribution, err := app.GetANRAttributesDistribution(ctx, anrGroupId, &af)
	if err != nil {
		msg := `failed to query data for anr distribution plot`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, distribution)
}

func CreateApp(c *gin.Context) {
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	ok, err := PerformAuthz(userId, teamId.String(), *ScopeAppAll)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to create apps in team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	app := NewApp(teamId)
	if err := c.ShouldBindJSON(&app); err != nil {
		msg := `failed to parse app json payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	tx, err := server.Server.PgPool.Begin(context.Background())
	if err != nil {
		msg := `failed to start transaction`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	defer tx.Rollback(context.Background()) // Rollback if not committed

	apiKey, err := app.add(tx)
	if err != nil {
		msg := "failed to create app"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	app.APIKey = apiKey

	// Create default config for the app
	userUUID, _ := uuid.Parse(userId)
	appUUID, _ := uuid.Parse(app.ID.String())

	err = CreateConfig(c.Request.Context(), tx, teamId, appUUID, &userUUID)
	if err != nil {
		msg := "failed to create default config for app"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	err = tx.Commit(context.Background())
	if err != nil {
		msg := "failed to commit transaction"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusCreated, app)
}

func GetSessionsOverview(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "sessions overview request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	app.TeamId = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.MustPut(logcomment.Root, logcomment.Sessions).String(),
	}

	ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "list")
	sessions, next, previous, err := app.GetSessionsWithFilter(ctx, &af)
	if err != nil {
		msg := "failed to get app's sessions"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results": sessions,
		"meta": gin.H{
			"next":     next,
			"previous": previous,
		},
	})
}

func GetSessionsOverviewPlotInstances(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := `sessions overview request validation failed`

	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if !af.HasTimezone() {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "missing required field `timezone`",
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	app.TeamId = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.MustPut(logcomment.Root, logcomment.Sessions).String(),
	}

	ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "plots_instances")
	sessionInstances, err := app.GetSessionsInstancesPlot(ctx, &af)
	if err != nil {
		msg := `failed to query data for sessions overview plot`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	type instance struct {
		ID   string  `json:"id"`
		Data []gin.H `json:"data"`
	}

	lut := make(map[string]int)
	var instances []instance

	for i := range sessionInstances {
		instance := instance{
			ID: sessionInstances[i].Version,
			Data: []gin.H{{
				"datetime":  sessionInstances[i].DateTime,
				"instances": sessionInstances[i].Instances,
			}},
		}

		ndx, ok := lut[sessionInstances[i].Version]

		if ok {
			instances[ndx].Data = append(instances[ndx].Data, instance.Data...)
		} else {
			instances = append(instances, instance)
			lut[sessionInstances[i].Version] = len(instances) - 1
		}
	}

	c.JSON(http.StatusOK, instances)
}

func GetSession(c *gin.Context) {
	ctx := c.Request.Context()
	appId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	sessionId, err := uuid.Parse(c.Param("sessionId"))
	if err != nil {
		msg := `session id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	app := &App{
		ID: &appId,
	}

	if err := app.Populate(ctx); err != nil {
		msg := `failed to fetch app details`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError

		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
			msg = fmt.Sprintf(`app with id %q does not exist`, app.ID)
		}

		c.JSON(status, gin.H{
			"error": msg,
		})

		return
	}

	userId := c.GetString("userId")

	ok, err := PerformAuthz(userId, app.TeamId.String(), *ScopeTeamRead)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to read apps in team %q`, app.TeamId)
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	ok, err = PerformAuthz(userId, app.TeamId.String(), *ScopeAppRead)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to read apps in team %q`, app.TeamId)
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	lc := logcomment.New(2).MustPut(logcomment.Root, logcomment.Sessions)
	settings := clickhouse.Settings{
		"log_comment": lc.String(),
	}

	ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "detail")

	session, err := app.GetSessionEvents(ctx, sessionId)
	if err != nil {
		msg := `failed to fetch session data for timeline`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if errors.Is(err, sql.ErrNoRows) {
		msg := fmt.Sprintf(`session %q for app %q does not exist`, sessionId, app.ID)
		c.JSON(http.StatusNotFound, gin.H{
			"error": msg,
		})
	}

	var attachmentGroup errgroup.Group
	attachmentGroup.SetLimit(16)

	// generate pre-sign URLs for
	// attachments
	for i := range session.Events {
		if !session.Events[i].HasAttachments() {
			continue
		}
		for j := range session.Events[i].Attachments {
			attachmentGroup.Go(func() (err error) {
				if err = session.Events[i].Attachments[j].PreSignURL(ctx); err != nil {
					return
				}
				return
			})
		}
	}

	if err := attachmentGroup.Wait(); err != nil {
		msg := `failed to generate URLs for attachment`
		err = fmt.Errorf("%s: %v", msg, err)
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	duration := session.DurationFromEvents().Milliseconds()
	cpuUsageEvents := session.EventsOfType(event.TypeCPUUsage)
	cpuUsages := timeline.ComputeCPUUsage(cpuUsageEvents)

	memoryUsageEvents := session.EventsOfType(event.TypeMemoryUsage)
	memoryUsages := timeline.ComputeMemoryUsage(memoryUsageEvents)

	memoryUsageAbsEvents := session.EventsOfType(event.TypeMemoryUsageAbs)
	memoryUsageAbsolutes := timeline.ComputeMemoryUsageAbs(memoryUsageAbsEvents)

	typeList := []string{
		event.TypeGestureClick,
		event.TypeGestureLongClick,
		event.TypeGestureScroll,
		event.TypeNavigation,
		event.TypeString,
		event.TypeNetworkChange,
		event.TypeColdLaunch,
		event.TypeWarmLaunch,
		event.TypeHotLaunch,
		event.TypeLifecycleActivity,
		event.TypeLifecycleFragment,
		event.TypeLifecycleViewController,
		event.TypeLifecycleSwiftUI,
		event.TypeLifecycleApp,
		event.TypeTrimMemory,
		event.TypeLowMemory,
		event.TypeAppExit,
		event.TypeException,
		event.TypeANR,
		event.TypeHttp,
		event.TypeScreenView,
		event.TypeBugReport,
		event.TypeCustom,
	}

	eventMap := session.EventsOfTypes(typeList...)
	threads := make(timeline.Threads)

	gestureClickEvents := eventMap[event.TypeGestureClick]
	if len(gestureClickEvents) > 0 {
		gestureClicks := timeline.ComputeGestureClicks(gestureClickEvents)
		threadedGestureClicks := timeline.GroupByThreads(gestureClicks)
		threads.Organize(event.TypeGestureClick, threadedGestureClicks)
	}

	gestureLongClickEvents := eventMap[event.TypeGestureLongClick]
	if len(gestureLongClickEvents) > 0 {
		gestureLongClicks := timeline.ComputeGestureLongClicks(gestureLongClickEvents)
		threadedGestureLongClicks := timeline.GroupByThreads(gestureLongClicks)
		threads.Organize(event.TypeGestureLongClick, threadedGestureLongClicks)
	}

	gestureScrollEvents := eventMap[event.TypeGestureScroll]
	if len(gestureScrollEvents) > 0 {
		gestureScrolls := timeline.ComputeGestureScrolls(gestureScrollEvents)
		threadedGestureScrolls := timeline.GroupByThreads(gestureScrolls)
		threads.Organize(event.TypeGestureScroll, threadedGestureScrolls)
	}

	navEvents := eventMap[event.TypeNavigation]
	if len(navEvents) > 0 {
		navs := timeline.ComputeNavigation(navEvents)
		threadedNavs := timeline.GroupByThreads(navs)
		threads.Organize(event.TypeNavigation, threadedNavs)
	}

	screenViewEvents := eventMap[event.TypeScreenView]
	if len(screenViewEvents) > 0 {
		screenViews := timeline.ComputeScreenViews(screenViewEvents)
		threadedScreenViews := timeline.GroupByThreads(screenViews)
		threads.Organize(event.TypeScreenView, threadedScreenViews)
	}

	bugReportEvents := eventMap[event.TypeBugReport]
	if len(bugReportEvents) > 0 {
		bugReports := timeline.ComputeBugReport(bugReportEvents)
		threadedBugReports := timeline.GroupByThreads(bugReports)
		threads.Organize(event.TypeBugReport, threadedBugReports)
	}

	customEvents := eventMap[event.TypeCustom]
	if len(customEvents) > 0 {
		customs := timeline.ComputeCustom(customEvents)
		threadedCustoms := timeline.GroupByThreads(customs)
		threads.Organize(event.TypeCustom, threadedCustoms)
	}

	logEvents := eventMap[event.TypeString]
	if len(logEvents) > 0 {
		logs := timeline.ComputeLogString(logEvents)
		threadedLogs := timeline.GroupByThreads(logs)
		threads.Organize(event.TypeString, threadedLogs)
	}

	netChangeEvents := eventMap[event.TypeNetworkChange]
	if len(netChangeEvents) > 0 {
		netChanges := timeline.ComputeNetworkChange(netChangeEvents)
		threadedNetChanges := timeline.GroupByThreads(netChanges)
		threads.Organize(event.TypeNetworkChange, threadedNetChanges)
	}

	coldLaunchEvents := eventMap[event.TypeColdLaunch]
	if len(coldLaunchEvents) > 0 {
		coldLaunches := timeline.ComputeColdLaunches(coldLaunchEvents)
		threadedColdLaunches := timeline.GroupByThreads(coldLaunches)
		threads.Organize(event.TypeColdLaunch, threadedColdLaunches)
	}

	warmLaunchEvents := eventMap[event.TypeWarmLaunch]
	if len(warmLaunchEvents) > 0 {
		warmLaunches := timeline.ComputeWarmLaunches(warmLaunchEvents)
		threadedWarmLaunches := timeline.GroupByThreads(warmLaunches)
		threads.Organize(event.TypeWarmLaunch, threadedWarmLaunches)
	}

	hotLaunchEvents := eventMap[event.TypeHotLaunch]
	if len(hotLaunchEvents) > 0 {
		hotLaunches := timeline.ComputeHotLaunches(hotLaunchEvents)
		threadedHotLaunches := timeline.GroupByThreads(hotLaunches)
		threads.Organize(event.TypeHotLaunch, threadedHotLaunches)
	}

	lifecycleActivityEvents := eventMap[event.TypeLifecycleActivity]
	if len(lifecycleActivityEvents) > 0 {
		lifecycleActivities := timeline.ComputeLifecycleActivities(lifecycleActivityEvents)
		threadedLifecycleActivities := timeline.GroupByThreads(lifecycleActivities)
		threads.Organize(event.TypeLifecycleActivity, threadedLifecycleActivities)
	}

	lifecycleFragmentEvents := eventMap[event.TypeLifecycleFragment]
	if len(lifecycleFragmentEvents) > 0 {
		lifecycleFragments := timeline.ComputeLifecycleFragments(lifecycleFragmentEvents)
		threadedLifecycleFragments := timeline.GroupByThreads(lifecycleFragments)
		threads.Organize(event.TypeLifecycleFragment, threadedLifecycleFragments)
	}

	lifecycleViewControllerEvents := eventMap[event.TypeLifecycleViewController]
	if len(lifecycleViewControllerEvents) > 0 {
		lifecycleViewControllers := timeline.ComputeLifecycleViewControllers(lifecycleViewControllerEvents)
		threadedLifecycleViewControllers := timeline.GroupByThreads(lifecycleViewControllers)
		threads.Organize(event.TypeLifecycleViewController, threadedLifecycleViewControllers)
	}

	lifecycleSwiftUIEvents := eventMap[event.TypeLifecycleSwiftUI]
	if len(lifecycleSwiftUIEvents) > 0 {
		lifecycleSwiftUIViews := timeline.ComputeLifecycleSwiftUIViews(lifecycleSwiftUIEvents)
		threadedLifecycleSwiftUIViews := timeline.GroupByThreads(lifecycleSwiftUIViews)
		threads.Organize(event.TypeLifecycleSwiftUI, threadedLifecycleSwiftUIViews)
	}

	lifecycleAppEvents := eventMap[event.TypeLifecycleApp]
	if len(lifecycleAppEvents) > 0 {
		lifecycleApps := timeline.ComputeLifecycleApps(lifecycleAppEvents)
		threadedLifecycleApps := timeline.GroupByThreads(lifecycleApps)
		threads.Organize(event.TypeLifecycleApp, threadedLifecycleApps)
	}

	trimMemoryEvents := eventMap[event.TypeTrimMemory]
	if len(trimMemoryEvents) > 0 {
		trimMemories := timeline.ComputeTrimMemories(trimMemoryEvents)
		threadedTrimMemories := timeline.GroupByThreads(trimMemories)
		threads.Organize(event.TypeTrimMemory, threadedTrimMemories)
	}

	lowMemoryEvents := eventMap[event.TypeLowMemory]
	if len(lowMemoryEvents) > 0 {
		lowMemories := timeline.ComputeLowMemories(lowMemoryEvents)
		threadedLowMemories := timeline.GroupByThreads(lowMemories)
		threads.Organize(event.TypeLowMemory, threadedLowMemories)
	}

	appExitEvents := eventMap[event.TypeAppExit]
	if len(appExitEvents) > 0 {
		appExits := timeline.ComputeAppExits(appExitEvents)
		threadedAppExits := timeline.GroupByThreads(appExits)
		threads.Organize(event.TypeAppExit, threadedAppExits)
	}

	exceptionEvents := eventMap[event.TypeException]
	if len(exceptionEvents) > 0 {
		exceptions, err := timeline.ComputeExceptions(c, app.ID, exceptionEvents)
		if err != nil {
			msg := fmt.Sprintf(`unable to compute exceptions for session %q for app %q`, sessionId, app.ID)
			fmt.Println(msg, err)
			c.JSON(http.StatusNotFound, gin.H{
				"error": msg,
			})
			return
		}
		threadedExceptions := timeline.GroupByThreads(exceptions)
		threads.Organize(event.TypeException, threadedExceptions)
	}

	anrEvents := eventMap[event.TypeANR]
	if len(anrEvents) > 0 {
		anrs, err := timeline.ComputeANRs(c, app.ID, anrEvents)
		if err != nil {
			msg := fmt.Sprintf(`unable to compute ANRs for session %q for app %q`, sessionId, app.ID)
			fmt.Println(msg, err)
			c.JSON(http.StatusNotFound, gin.H{
				"error": msg,
			})
			return
		}
		threadedANRs := timeline.GroupByThreads(anrs)
		threads.Organize(event.TypeANR, threadedANRs)
	}

	httpEvents := eventMap[event.TypeHttp]
	if len(httpEvents) > 0 {
		httpies := timeline.ComputeHttp(httpEvents)
		threadedHttpies := timeline.GroupByThreads(httpies)
		threads.Organize(event.TypeHttp, threadedHttpies)
	}

	threads.Sort()

	sessionTraces, err := app.FetchTracesForSessionId(ctx, sessionId)
	if err != nil {
		msg := `failed to fetch trace data for timeline`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	// For trace only sessions, populate session's attribute
	// and duration from traces.
	if !session.hasEvents() && len(sessionTraces) > 0 {
		session.Attribute = &event.Attribute{}
		session.Attribute.AppVersion = sessionTraces[0].AppVersion
		session.Attribute.AppBuild = sessionTraces[0].AppBuild
		session.Attribute.DeviceManufacturer = sessionTraces[0].DeviceManufacturer
		session.Attribute.DeviceModel = sessionTraces[0].DeviceModel
		session.Attribute.NetworkType = sessionTraces[0].NetworkType

		// use the trace duration as the session's duration
		lastTraceTime := sessionTraces[0].StartTime
		firstTraceTime := sessionTraces[len(sessionTraces)-1].StartTime
		duration = lastTraceTime.Sub(firstTraceTime).Milliseconds()
	}

	response := gin.H{
		"session_id":            sessionId,
		"attribute":             session.Attribute,
		"app_id":                appId,
		"duration":              duration,
		"cpu_usage":             cpuUsages,
		"memory_usage":          memoryUsages,
		"memory_usage_absolute": memoryUsageAbsolutes,
		"threads":               threads,
		"traces":                sessionTraces,
	}

	c.JSON(http.StatusOK, response)
}

func GetAlertPrefs(c *gin.Context) {
	appId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	userIdString := c.GetString("userId")

	userId, err := uuid.Parse(userIdString)
	if err != nil {
		fmt.Println("Error parsing userId:", err)
		return
	}

	alertPref, err := getAlertPref(appId, userId)
	if err != nil {
		msg := `unable to fetch notif prefs`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, alertPref)
}

func UpdateAlertPrefs(c *gin.Context) {
	userIdString := c.GetString("userId")

	userId, err := uuid.Parse(userIdString)
	if err != nil {
		fmt.Println("Error parsing userId:", err)
		return
	}

	appId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := "app id invalid or missing"
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	alertPref := newAlertPref(appId, userId)

	var payload AlertPrefPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		msg := `failed to parse alert preferences json payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	alertPref.CrashRateSpikeEmail = payload.CrashRateSpike.Email
	alertPref.AnrRateSpikeEmail = payload.AnrRateSpike.Email
	alertPref.LaunchTimeSpikeEmail = payload.LaunchTimeSpike.Email

	alertPref.update()

	c.JSON(http.StatusOK, gin.H{
		"ok": "done",
	})
}

func GetAppRetention(c *gin.Context) {
	appId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	app := App{
		ID: &appId,
	}

	retention, err := app.getAppRetention()
	if err != nil {
		msg := `unable to fetch app retention`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"retention": retention})
}

func UpdateAppRetention(c *gin.Context) {
	userId := c.GetString("userId")
	appId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	app := App{
		ID: &appId,
	}

	team, err := app.getTeam(c)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	ok, err := PerformAuthz(userId, team.ID.String(), *ScopeAppAll)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to modify app settings in team [%s]`, team.ID.String())
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	ok, err = CheckRetentionChangeAllowedInPlan(c, *team.ID)
	if err != nil {
		msg := `error checking retention change allowance`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if !ok {
		msg := `retention change not allowed in current plan`
		fmt.Println(msg)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	type RetentionPayload struct {
		Retention int `json:"retention"`
	}
	var payload RetentionPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		msg := `failed to parse app settings json payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	if payload.Retention < FREE_PLAN_MAX_RETENTION_DAYS || payload.Retention > MAX_RETENTION_DAYS {
		msg := fmt.Sprintf(`retention period must be between %d and %d days`, FREE_PLAN_MAX_RETENTION_DAYS, MAX_RETENTION_DAYS)
		fmt.Println(msg)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	err = app.updateRetention(payload.Retention)
	if err != nil {
		msg := "failed to update app retention"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok": "done",
	})
}

func RenameApp(c *gin.Context) {
	userId := c.GetString("userId")
	appId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	app := App{
		ID: &appId,
	}

	team, err := app.getTeam(c)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	ok, err := PerformAuthz(userId, team.ID.String(), *ScopeAppAll)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to modify app in team [%s]`, team.ID.String())
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	if err := c.ShouldBindJSON(&app); err != nil {
		msg := `failed to parse app rename json payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	err = app.rename()
	if err != nil {
		msg := `failed to rename app`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok": "done",
	})
}

func CreateShortFilters(c *gin.Context) {
	ctx := c.Request.Context()
	userId := c.GetString("userId")
	appId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	app := App{
		ID: &appId,
	}

	team, err := app.getTeam(c)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	ok, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to create short filters in team [%s]`, team.ID.String())
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	var payload filter.ShortFiltersPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		msg := `failed to parse filters json payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	// embed app id in filter payload
	payload.AppID = appId

	shortFilters, err := filter.NewShortFilters(payload)
	if err != nil {
		msg := `failed to create filter hash`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	if err = shortFilters.Create(ctx); err != nil {
		msg := `failed to create short code from filters`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"filter_short_code": shortFilters.Code,
	})
}

func GetRootSpanNames(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	app.TeamId = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment":      lc.MustPut(logcomment.Root, logcomment.Spans),
		"use_query_cache":  gin.Mode() == gin.ReleaseMode,
		"use_skip_indexes": 0,
	}

	ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "names_list")

	traceNames, err := app.FetchRootSpanNames(ctx)
	if err != nil {
		msg := "failed to get app's traces"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results": traceNames,
	})
}

func GetSpansForSpanName(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	rawSpanName := c.Query("span_name")
	if rawSpanName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Missing span_name query param",
		})
		return
	}

	spanName, err := url.QueryUnescape(rawSpanName)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid span_name query param",
		})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "root spans request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	app.TeamId = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment":     lc.MustPut(logcomment.Root, logcomment.Spans),
		"use_query_cache": gin.Mode() == gin.ReleaseMode,
	}

	ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "list")

	spans, next, previous, err := app.GetSpansForSpanNameWithFilter(ctx, spanName, &af)
	if err != nil {
		msg := "failed to get app's root spans"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results": spans,
		"meta": gin.H{
			"next":     next,
			"previous": previous,
		},
	})
}

func GetMetricsPlotForSpanName(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	rawSpanName := c.Query("span_name")
	if rawSpanName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Missing span_name query param",
		})
		return
	}

	spanName, err := url.QueryUnescape(rawSpanName)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid span_name query param",
		})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "span plot request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	app.TeamId = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.MustPut(logcomment.Root, logcomment.Spans),
	}

	ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "plots_metrics")

	spanMetricsPlotInstances, err := app.GetMetricsPlotForSpanNameWithFilter(ctx, spanName, &af)
	if err != nil {
		msg := "failed to get span's plot"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	type instance struct {
		ID   string  `json:"id"`
		Data []gin.H `json:"data"`
	}

	lut := make(map[string]int)
	var instances []instance

	for i := range spanMetricsPlotInstances {
		instance := instance{
			ID: spanMetricsPlotInstances[i].Version,
			Data: []gin.H{{
				"datetime": spanMetricsPlotInstances[i].DateTime,
				"p50":      spanMetricsPlotInstances[i].P50,
				"p90":      spanMetricsPlotInstances[i].P90,
				"p95":      spanMetricsPlotInstances[i].P95,
				"p99":      spanMetricsPlotInstances[i].P99,
			}},
		}

		ndx, ok := lut[spanMetricsPlotInstances[i].Version]

		if ok {
			instances[ndx].Data = append(instances[ndx].Data, instance.Data...)
		} else {
			instances = append(instances, instance)
			lut[spanMetricsPlotInstances[i].Version] = len(instances) - 1
		}
	}

	c.JSON(http.StatusOK, instances)
}

func GetTrace(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	traceId := c.Param("traceId")

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	app.TeamId = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.MustPut(logcomment.Root, logcomment.Spans),
	}

	ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "trace")

	trace, err := app.GetTrace(ctx, traceId)
	if err != nil {
		msg := "failed to get trace"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, trace)
}

func GetBugReportsOverview(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "bug reports overview request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	app.TeamId = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.
			MustPut(logcomment.Root, logcomment.BugReports).
			String(),
	}

	ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "list")

	bugReports, next, previous, err := app.GetBugReportsWithFilter(ctx, &af)
	if err != nil {
		msg := "failed to get app's bug reports"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results": bugReports,
		"meta": gin.H{
			"next":     next,
			"previous": previous,
		},
	})
}

func GetBugReportsInstancesPlot(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := `bug reports plot request validation failed`

	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if !af.HasTimezone() {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "missing required field `timezone`",
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	app.TeamId = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.
			MustPut(logcomment.Root, logcomment.BugReports).
			String(),
	}

	ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "plots_instances")

	bugReportInstances, err := app.GetBugReportInstancesPlot(ctx, &af)
	if err != nil {
		msg := `failed to query data for bug reports plot`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	type instance struct {
		ID   string  `json:"id"`
		Data []gin.H `json:"data"`
	}

	lut := make(map[string]int)
	var instances []instance

	for i := range bugReportInstances {
		instance := instance{
			ID: bugReportInstances[i].Version,
			Data: []gin.H{{
				"datetime":  bugReportInstances[i].DateTime,
				"instances": bugReportInstances[i].Instances,
			}},
		}

		ndx, ok := lut[bugReportInstances[i].Version]

		if ok {
			instances[ndx].Data = append(instances[ndx].Data, instance.Data...)
		} else {
			instances = append(instances, instance)
			lut[bugReportInstances[i].Version] = len(instances) - 1
		}
	}

	c.JSON(http.StatusOK, instances)
}

func GetBugReport(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	bugReportId := c.Param("bugReportId")

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	app.TeamId = *team.ID

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.
			MustPut(logcomment.Root, logcomment.BugReports).
			String(),
	}

	ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "detail")

	bugReport, err := app.GetBugReportById(ctx, bugReportId)
	if err != nil {
		msg := "failed to get bug report"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, bugReport)
}

func UpdateBugReportStatus(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	bugReportId := c.Param("bugReportId")

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	app.TeamId = *team.ID

	var payload BugReportStatusUpdatePayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		msg := `failed to parse bug report status update json payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.
			MustPut(logcomment.Root, logcomment.BugReports).
			String(),
	}

	ctx = logcomment.WithSettingsPut(ctx, settings, lc, logcomment.Name, "update_status")

	if err := app.UpdateBugReportStatusById(ctx, bugReportId, *payload.Status); err != nil {
		msg := "failed to update bug report status"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok": "done",
	})
}

func GetAlertsOverview(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := filter.AppFilter{
		AppID: id,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "alerts overview request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	alerts, next, previous, err := GetAlertsWithFilter(ctx, &af)
	if err != nil {
		msg := "failed to get app's alerts"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results": alerts,
		"meta": gin.H{
			"next":     next,
			"previous": previous,
		},
	})
}

func GetConfig(c *gin.Context) {
	ctx := c.Request.Context()
	idParam := c.Param("id")

	id, err := uuid.Parse(idParam)
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	GetConfigForDashboard(c, id)
}

func PatchConfig(c *gin.Context) {
	ctx := c.Request.Context()
	idParam := c.Param("id")

	appId, err := uuid.Parse(idParam)
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	app := App{
		ID: &appId,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppAll)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	err = PatchConfigForApp(c, appId, userId)
	if err != nil {
		msg := "failed to update SDK config"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "config updated successfully"})
}

func GetNetworkRequestsDomains(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	origins, err := network.FetchDomains(ctx, *app.ID, *team.ID)
	if err != nil {
		msg := "failed to get network domains"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results": origins,
	})
}

func GetNetworkRequestsPaths(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	domain := c.Query("domain")
	if domain == "" {
		msg := `domain query parameter is required`
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	search := c.Query("search")

	paths, err := network.FetchPaths(ctx, *app.ID, *team.ID, domain, search)
	if err != nil {
		msg := "failed to get network paths"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results": paths,
	})
}

func GetNetworkRequestsMetrics(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	rawURL := c.Query("url")
	if rawURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing url query param"})
		return
	}

	domain, pathPattern, err := network.ParseURL(rawURL)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid url query param"})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "network metrics request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	if !af.HasPlotTimeGroup() {
		af.SetDefaultPlotTimeGroup()
	}

	groupExpr, err := getPlotTimeGroupExpr("timestamp", af.PlotTimeGroup)
	if err != nil {
		msg := "failed to compute time group expression"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	result, err := network.FetchMetrics(ctx, *app.ID, *team.ID, domain, pathPattern, &af, groupExpr.BucketExpr, groupExpr.DatetimeFormat)
	if err != nil {
		msg := "failed to get network metrics"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, result)
}

func GetNetworkRequestsTrends(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "network overview request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	result, err := network.FetchTrends(ctx, *app.ID, *team.ID, &af)
	if err != nil {
		msg := "failed to get network overview"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, result)
}

func GetNetworkStatusOverviewPlot(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "network status overview plot request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	if !af.HasPlotTimeGroup() {
		af.SetDefaultPlotTimeGroup()
	}

	groupExpr, err := getPlotTimeGroupExpr("timestamp", af.PlotTimeGroup)
	if err != nil {
		msg := "failed to compute time group expression"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	result, err := network.GetRequestStatusOverview(ctx, *app.ID, *team.ID, &af, groupExpr.BucketExpr, groupExpr.DatetimeFormat)
	if err != nil {
		msg := "failed to get network status overview plot"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, result)
}
