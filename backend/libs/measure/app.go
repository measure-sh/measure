package measure

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"backend/libs/chquery"
	"backend/libs/config"
	"backend/libs/event"
	"backend/libs/exprfilter"
	"backend/libs/group"
	"backend/libs/metrics"
	"backend/libs/numeric"
	"backend/libs/opsys"
	"backend/libs/session"
	"backend/libs/span"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
)

type App struct {
	ID           *uuid.UUID `json:"id"`
	TeamId       uuid.UUID  `json:"team_id"`
	AppName      string     `json:"name" binding:"required"`
	UniqueId     string     `json:"unique_identifier"`
	OSNames      []string   `json:"os_names"`
	APIKey       *APIKey    `json:"api_key"`
	Retention    int        `json:"retention"`
	FirstVersion string     `json:"first_version"`
	Onboarded    bool       `json:"onboarded"`
	OnboardedAt  time.Time  `json:"onboarded_at"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// Family returns the app's OS family. os_names is guaranteed to be
// single-family by the ingest reconciliation and the Postgres constraint,
// so any element determines the family.

func (a App) Family() string {
	if len(a.OSNames) == 0 {
		return opsys.Unknown
	}
	return opsys.ToFamily(a.OSNames[0])
}

type PlotTimeGroupExpr struct {
	BucketExpr     string
	DatetimeFormat string
}

func GetPlotTimeGroupExpr(tsExpr, plotTimeGroup string) (*PlotTimeGroupExpr, error) {
	switch plotTimeGroup {
	case exprfilter.PlotTimeGroupMinutes:
		return &PlotTimeGroupExpr{
			BucketExpr:     fmt.Sprintf("toStartOfMinute(toTimeZone(%s, ?))", tsExpr),
			DatetimeFormat: "%Y-%m-%dT%H:%i:%S",
		}, nil
	case exprfilter.PlotTimeGroupHours:
		return &PlotTimeGroupExpr{
			BucketExpr:     fmt.Sprintf("toStartOfHour(toTimeZone(%s, ?))", tsExpr),
			DatetimeFormat: "%Y-%m-%dT%H:%i:%S",
		}, nil
	case exprfilter.PlotTimeGroupDays:
		return &PlotTimeGroupExpr{
			BucketExpr:     fmt.Sprintf("toDate(toTimeZone(%s, ?))", tsExpr),
			DatetimeFormat: "%Y-%m-%d",
		}, nil
	case exprfilter.PlotTimeGroupMonths:
		return &PlotTimeGroupExpr{
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
		OSNames     *[]string  `json:"os_names"`
		OnboardedAt *time.Time `json:"onboarded_at"`
		UniqueId    *string    `json:"unique_identifier"`
		Retention   *int       `json:"retention"`
	}{
		OSNames: func() *[]string {
			if len(a.OSNames) == 0 {
				return nil
			}
			return &a.OSNames
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

func (a App) Rename(pg *pgxpool.Pool) error {
	stmt := sqlf.PostgreSQL.Update("apps").
		Set("app_name", a.AppName).
		Set("updated_at", time.Now()).
		Where("id = ?", a.ID)
	defer stmt.Close()

	_, err := pg.Exec(context.Background(), stmt.String(), stmt.Args()...)
	if err != nil {
		return err
	}

	return nil
}

func (a App) GetAppRetention(pg *pgxpool.Pool) (int, error) {
	stmt := sqlf.PostgreSQL.Select("retention").
		From("apps").
		Where("id = ?", a.ID)
	defer stmt.Close()

	var retention int
	if err := pg.QueryRow(context.Background(), stmt.String(), stmt.Args()...).Scan(&retention); err != nil {
		return 0, err
	}

	return retention, nil
}

func (a App) UpdateRetention(pg *pgxpool.Pool, retention int) error {
	stmt := sqlf.PostgreSQL.Update("apps").
		Set("retention", retention).
		Set("updated_at", time.Now()).
		Where("id = ?", a.ID)
	defer stmt.Close()

	_, err := pg.Exec(context.Background(), stmt.String(), stmt.Args()...)
	if err != nil {
		return err
	}

	return nil
}

// IssueGroupExists checks if the group exists by its
// fingerprint and type.
func (a App) IssueGroupExists(ctx context.Context, rch driver.Conn, groupType group.GroupType, fingerprint string) (ok bool, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	table := "fatal_exception_groups"

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

	err = rch.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&ok)

	return
}

// unionStmts combines one or more sqlf statements with UNION ALL.
// Returns the single statement unchanged when len == 1.
func unionStmts(stmts []*sqlf.Stmt) *sqlf.Stmt {
	if len(stmts) == 1 {
		return stmts[0]
	}
	parts := make([]string, len(stmts))
	var args []any
	for i, s := range stmts {
		parts[i] = s.String()
		args = append(args, s.Args()...)
	}
	return sqlf.New(strings.Join(parts, " UNION ALL "), args...)
}

var errorEventTypes = []string{event.TypeANR, event.TypeException}

// errorFingerprintExpr reads the fingerprint of an ANR or an exception row.
// Never alias it "id": that shadows events.id, which the custom attribute
// membership subqueries compare against.
const errorFingerprintExpr = "if(type = 'anr', `anr.fingerprint`, `exception.fingerprint`)"

// errorFingerprintMatch matches the events of one error group.
const errorFingerprintMatch = "((type = 'anr' and `anr.fingerprint` = ?) or (type = 'exception' and `exception.fingerprint` = ?))"

// applyErrorPredicate adds the filter expression to an error events query.
func applyErrorPredicate(stmt *sqlf.Stmt, ef *exprfilter.ExprFilter) error {
	if !ef.HasFilterExpr() {
		return nil
	}

	predicate, err := ef.Predicate(nil)
	if err != nil {
		return err
	}
	defer predicate.Close()

	stmt.Where(predicate.String(), predicate.Args()...)
	return nil
}

// GetErrorGroupsWithFilter lists the app's error groups with the number of
// matching events in each. The filter runs on events, so a group with no
// matching events is dropped by the join; the group tables only describe
// the groups.
func (a App) GetErrorGroupsWithFilter(ctx context.Context, rch driver.Conn, ef *exprfilter.ExprFilter) (groups []group.ErrorGroup, next, previous bool, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)

	versionNames, versionCodes := ef.RootVersionConditions()

	newGroupsBranch := func(table, sourceType, severityClass, severityExpr, isCustomExpr string) *sqlf.Stmt {
		s := sqlf.
			From(table).
			Select("team_id").
			Select("app_id").
			Select("id").
			Select("argMax(type, timestamp) as type").
			Select("argMax(message, timestamp) as message").
			Select("argMax(method_name, timestamp) as method_name").
			Select("argMax(file_name, timestamp) as file_name").
			Select("argMax(line_number, timestamp) as line_number").
			Select("any(timestamp) as last_occurrence").
			Select("'"+sourceType+"' as source_type").
			Select("'"+severityClass+"' as severity_class").
			Select(severityExpr+" as severity").
			Select(isCustomExpr+" as is_custom").
			Where("team_id = toUUID(?)", a.TeamId).
			Where("app_id = toUUID(?)", a.ID).
			Where("timestamp >= toDateTime64(?, 3, 'UTC')", ef.From).
			Where("timestamp <= toDateTime64(?, 3, 'UTC')", ef.To).
			GroupBy("team_id").
			GroupBy("app_id").
			GroupBy("id")

		for _, names := range versionNames {
			s.Where("app_version.1 in ?", names)
		}
		for _, codes := range versionCodes {
			s.Where("app_version.2 in ?", codes)
		}

		return s
	}

	groupsCTE := unionStmts([]*sqlf.Stmt{
		newGroupsBranch("anr_groups final", "anr", "fatal", "'fatal'", "false"),
		newGroupsBranch("fatal_exception_groups final", "exception", "fatal", "'fatal'", "argMax(is_custom, timestamp)"),
		newGroupsBranch("nonfatal_exception_groups final", "exception", "nonfatal", "if(argMax(handled, timestamp), 'handled', 'unhandled')", "argMax(is_custom, timestamp)"),
	})

	// severity_class mirrors how ingest picked the group table: a fatal
	// exception went to fatal_exception_groups, any other exception to
	// nonfatal_exception_groups, and an ANR is always fatal.
	countsCTE := sqlf.
		From("events").
		Select("team_id").
		Select("app_id").
		Select(errorFingerprintExpr+" as fingerprint").
		Select("if(type = 'anr', 'anr', 'exception') as source_type").
		Select("multiIf(type = 'anr', 'fatal', `exception.severity` = 'fatal' or (`exception.severity` = '' and `exception.handled` = false), 'fatal', 'nonfatal') as severity_class").
		Select("count() as event_count").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("timestamp >= toDateTime64(?, 3, 'UTC')", ef.From).
		Where("timestamp <= toDateTime64(?, 3, 'UTC')", ef.To).
		Where("type in ?", errorEventTypes).
		Where(errorFingerprintExpr + " != ''").
		GroupBy("team_id").
		GroupBy("app_id").
		GroupBy("fingerprint").
		GroupBy("source_type").
		GroupBy("severity_class")

	if err = applyErrorPredicate(countsCTE, ef); err != nil {
		return
	}

	stmt := sqlf.
		With("groups", groupsCTE).
		With("counts", countsCTE).
		Select("g.app_id").
		Select("g.id").
		Select("g.type").
		Select("g.source_type").
		Select("g.severity").
		Select("g.is_custom").
		Select("g.message").
		Select("g.method_name").
		Select("g.file_name").
		Select("g.line_number").
		Select("g.last_occurrence").
		Select("c.event_count as event_count").
		Select("round((event_count * 100.0) / sum(event_count) over (), 2) as contribution").
		From("groups as g").
		LeftJoin("counts as c", "c.team_id = g.team_id and c.app_id = g.app_id and c.fingerprint = g.id and c.source_type = g.source_type and c.severity_class = g.severity_class").
		Where("c.event_count > 0").
		OrderBy("event_count desc, g.last_occurrence desc, g.id")

	if ef.Limit > 0 {
		stmt.Limit(uint64(ef.Limit) + 1)
	}

	if ef.Offset >= 0 {
		stmt.Offset(uint64(ef.Offset))
	}

	defer stmt.Close()

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	defer rows.Close()

	if err = rows.Err(); err != nil {
		return
	}

	for rows.Next() {
		var (
			g           group.ErrorGroup
			severityStr string
		)
		if err = rows.Scan(
			&g.AppID,
			&g.ID,
			&g.Type,
			&g.ErrorType,
			&severityStr,
			&g.IsCustom,
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
		g.Severity = event.Severity(severityStr)

		groups = append(groups, g)
	}

	resultLen := len(groups)

	if resultLen > ef.Limit {
		groups = groups[:resultLen-1]
		next = true
	}

	if ef.Offset > 0 {
		previous = true
	}

	return
}

// GetErrorPlotInstances buckets the matching error events by time and app
// version.
func (a App) GetErrorPlotInstances(ctx context.Context, rch driver.Conn, ef *exprfilter.ExprFilter) (issueInstances []event.IssueInstance, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	if ef.Timezone == "" {
		return nil, errors.New("missing timezone filter")
	}

	ef.SetDefaultPlotTimeGroupIfUnset()

	groupExpr, err := GetPlotTimeGroupExpr("timestamp", ef.PlotTimeGroup)
	if err != nil {
		return nil, err
	}

	stmt := sqlf.
		From("events final").
		Select(groupExpr.BucketExpr+" as datetime_bucket", ef.Timezone).
		Select("formatDateTime(datetime_bucket, ?) as datetime", groupExpr.DatetimeFormat).
		Select("concat(`attribute.app_version`, '', '(', `attribute.app_build`, ')') as app_version").
		Select("count() as total").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("timestamp >= ? and timestamp <= ?", ef.From, ef.To).
		Where("type in ?", errorEventTypes).
		GroupBy("app_version, datetime_bucket").
		OrderBy("app_version, datetime_bucket")

	if err = applyErrorPredicate(stmt, ef); err != nil {
		return
	}

	defer stmt.Close()

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	defer rows.Close()

	for rows.Next() {
		var instance event.IssueInstance
		var datetimeBucket time.Time
		if err = rows.Scan(&datetimeBucket, &instance.DateTime, &instance.Version, &instance.Instances); err != nil {
			return
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

// GetErrorGroupPlotInstances buckets one error group's matching events by
// time and app version.
func (a App) GetErrorGroupPlotInstances(ctx context.Context, rch driver.Conn, fingerprint string, ef *exprfilter.ExprFilter) (instances []event.IssueInstance, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	if ef.Timezone == "" {
		return nil, errors.New("missing timezone filter")
	}

	ef.SetDefaultPlotTimeGroupIfUnset()

	groupExpr, err := GetPlotTimeGroupExpr("timestamp", ef.PlotTimeGroup)
	if err != nil {
		return nil, err
	}

	stmt := sqlf.
		From("events").
		Select(groupExpr.BucketExpr+" as datetime_bucket", ef.Timezone).
		Select("formatDateTime(datetime_bucket, ?) as datetime", groupExpr.DatetimeFormat).
		Select("concat(`attribute.app_version`, ' ', '(', `attribute.app_build`, ')') as version").
		Select("count(id) as total").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("timestamp >= ? and timestamp <= ?", ef.From, ef.To).
		Where("type in ?", errorEventTypes).
		Where(errorFingerprintMatch, fingerprint, fingerprint).
		GroupBy("version, datetime_bucket").
		OrderBy("version, datetime_bucket")

	if err = applyErrorPredicate(stmt, ef); err != nil {
		return
	}

	defer stmt.Close()

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	defer rows.Close()

	for rows.Next() {
		var instance event.IssueInstance
		var datetimeBucket time.Time
		if err = rows.Scan(&datetimeBucket, &instance.DateTime, &instance.Version, &instance.Instances); err != nil {
			return
		}
		instances = append(instances, instance)
	}

	err = rows.Err()

	return
}

// GetErrorGroupAttributesDistribution counts one error group's matching
// events per attribute value.
func (a App) GetErrorGroupAttributesDistribution(ctx context.Context, rch driver.Conn, fingerprint string, ef *exprfilter.ExprFilter) (distribution event.IssueDistribution, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)

	stmt := sqlf.
		From("events").
		Select("concat(`attribute.app_version`, ' (', `attribute.app_build`, ')') as app_version").
		Select("concat(`attribute.os_name`, ' ', `attribute.os_version`) as os_version").
		Select("`inet.country_code` as country").
		Select("`attribute.network_type` as network_type").
		Select("`attribute.device_locale` as locale").
		Select("concat(`attribute.device_manufacturer`, ' - ', `attribute.device_name`) as device").
		Select("count(id) as count").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("timestamp >= ? and timestamp <= ?", ef.From, ef.To).
		Where("type in ?", errorEventTypes).
		Where(errorFingerprintMatch, fingerprint, fingerprint).
		GroupBy("app_version").
		GroupBy("os_version").
		GroupBy("country").
		GroupBy("network_type").
		GroupBy("locale").
		GroupBy("device")

	if err = applyErrorPredicate(stmt, ef); err != nil {
		return
	}

	defer stmt.Close()

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
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

// GetErrorsWithFilter reads one error group's matching events, newest first.
// Exceptions and ANRs are stored in different columns, so each is read by
// its own query.
func (a App) GetErrorsWithFilter(ctx context.Context, rch driver.Conn, fingerprint string, ef *exprfilter.ExprFilter) (events []any, next, previous bool, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)

	applyCommonFilters := func(s *sqlf.Stmt) error {
		s.Where("team_id = toUUID(?)", a.TeamId)
		s.Where("app_id = toUUID(?)", a.ID)
		s.Where("timestamp >= ? and timestamp <= ?", ef.From, ef.To)

		if err := applyErrorPredicate(s, ef); err != nil {
			return err
		}

		if ef.Limit > 0 {
			s.Limit(uint64(ef.Limit) + 1)
		}
		if ef.Offset >= 0 {
			s.Offset(uint64(ef.Offset))
		}

		s.OrderBy("timestamp desc")
		return nil
	}

	{
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
			Select("attribute.thread_name as thread_name").
			Select("exception.exceptions as exceptions").
			Select("exception.threads as threads").
			Select("exception.framework as framework").
			Select("if(exception.has_num_code OR exception.num_code != 0, exception.num_code, NULL) as num_code").
			Select("exception.code as code").
			Select("exception.meta as meta").
			Select("if(exception.severity = '', if(exception.handled, 'handled', 'fatal'), exception.severity) as severity").
			Select("attachments").
			Select("user_defined_attribute").
			Where("type = ?", event.TypeException).
			Where("exception.fingerprint = ?", fingerprint)

		if err = applyCommonFilters(stmt); err != nil {
			return
		}
		defer stmt.Close()

		rows, errQ := rch.Query(ctx, stmt.String(), stmt.Args()...)
		if errQ != nil {
			err = errQ
			return
		}

		for rows.Next() {
			var e event.EventException
			var exceptions string
			var threads string
			var meta string
			var severity string
			var attachments string
			var userDefAttr map[string][]any
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
				&e.Attribute.ThreadName,
				&exceptions,
				&threads,
				&e.Exception.Framework,
				&e.NumCode,
				&e.Code,
				&meta,
				&severity,
				&attachments,
				&userDefAttr,
			); err != nil {
				return
			}
			e.Severity = event.Severity(severity)
			if len(userDefAttr) > 0 {
				e.UserDefinedAttribute.Scan(userDefAttr)
			}

			if err = json.Unmarshal([]byte(exceptions), &e.Exception.Exceptions); err != nil {
				return
			}
			if err = json.Unmarshal([]byte(threads), &e.Exception.Threads); err != nil {
				return
			}
			if meta != "" {
				if err = json.Unmarshal([]byte(meta), &e.Meta); err != nil {
					return
				}
			}
			if err = json.Unmarshal([]byte(attachments), &e.Attachments); err != nil {
				return
			}

			e.ComputeView()
			events = append(events, &e)
		}
	}

	{
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
			Select("attribute.thread_name as thread_name").
			Select("anr.exceptions as exceptions").
			Select("anr.threads as threads").
			Select("attachments").
			Where("type = ?", event.TypeANR).
			Where("anr.fingerprint = ?", fingerprint)

		if err = applyCommonFilters(stmt); err != nil {
			return
		}
		defer stmt.Close()

		rows, errQ := rch.Query(ctx, stmt.String(), stmt.Args()...)
		if errQ != nil {
			err = errQ
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
				&e.Attribute.ThreadName,
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

			e.Severity = event.SeverityFatal
			e.ComputeView()
			events = append(events, &e)
		}
	}

	tsOf := func(v any) time.Time {
		switch x := v.(type) {
		case *event.EventException:
			return time.Time(x.Timestamp)
		case *event.EventANR:
			return time.Time(x.Timestamp)
		}
		return time.Time{}
	}

	sort.SliceStable(events, func(i, j int) bool {
		return tsOf(events[i]).After(tsOf(events[j]))
	})

	resultLen := len(events)
	if ef.Limit > 0 && resultLen > ef.Limit {
		events = events[:ef.Limit]
		next = true
	}
	if ef.Offset > 0 {
		previous = true
	}

	return
}

// versionPair is one (version_name, version_code) combination the app has
// rows for in the queried time range.
type versionPair struct {
	name string
	code string
}

// splitVersions lists the app versions the filter matches, most recently seen
// first, and the ones it leaves out, reading the version dimension of the
// app_metrics rollup. Builds active in the same fifteen-minute bucket tie on
// last activity, and the version tuple decides between them.
func (a App) splitVersions(ctx context.Context, rch driver.Conn, ef *exprfilter.ExprFilter) (selected, unselected []versionPair, err error) {
	predicate, err := ef.Predicate(nil)
	if err != nil {
		return nil, nil, err
	}
	defer predicate.Close()

	stmt := sqlf.From(config.AppMetricsTable).
		Select("tupleElement(app_version, 1) as version_name").
		Select("tupleElement(app_version, 2) as version_code").
		Select("("+predicate.String()+") as matched", predicate.Args()...).
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", ef.AppID).
		Where("timestamp >= ? and timestamp <= ?", ef.From, ef.To).
		GroupBy("app_version").
		OrderBy("max(timestamp) desc, app_version desc")
	defer stmt.Close()

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var pair versionPair
		var matched bool
		if err := rows.Scan(&pair.name, &pair.code, &matched); err != nil {
			return nil, nil, err
		}
		if matched {
			selected = append(selected, pair)
		} else {
			unselected = append(unselected, pair)
		}
	}

	return selected, unselected, rows.Err()
}

// GetSizeMetrics computes the download size of the app version the filter
// selects and its difference from the average size of the app's other builds.
// A size belongs to a single build, so nothing is returned unless the filter
// narrows the app to one version name; a version with several builds in the
// range reports its most recently seen build. When no other build exists, the
// average covers every build of the app.
func (a App) GetSizeMetrics(ctx context.Context, pg *pgxpool.Pool, rch driver.Conn, ef *exprfilter.ExprFilter) (size *metrics.SizeMetric, err error) {
	if !ef.HasFilterExpr() {
		return nil, nil
	}

	if !a.Onboarded {
		size = &metrics.SizeMetric{}
		size.SetNoData()
		return size, nil
	}

	ctx = chquery.WithTeamScope(ctx, a.TeamId)

	selected, unselected, err := a.splitVersions(ctx, rch, ef)
	if err != nil {
		return nil, err
	}
	if len(selected) == 0 {
		return nil, nil
	}
	for _, pair := range selected[1:] {
		if pair.name != selected[0].name {
			return nil, nil
		}
	}
	shown := selected[0]
	others := append(selected[1:], unselected...)

	avgSizeStmt := sqlf.PostgreSQL.
		From("build_sizes").
		Select("round(coalesce(avg(build_size), 2), 0) as average_size").
		Where("app_id = ?", ef.AppID)

	if len(others) > 0 {
		placeholders := make([]string, len(others))
		args := make([]any, 0, len(others)*2)
		for i, pair := range others {
			placeholders[i] = "(?, ?)"
			args = append(args, pair.name, pair.code)
		}
		avgSizeStmt.Where("(version_name, version_code) in ("+strings.Join(placeholders, ", ")+")", args...)
	}

	sizeStmt := sqlf.PostgreSQL.
		With("avg_size", avgSizeStmt).
		Select("t1.average_size as average_app_size").
		Select("t2.build_size as selected_app_size").
		Select("(t2.build_size - t1.average_size) as delta").
		From("avg_size as t1 cross join build_sizes as t2").
		Where("app_id = ?", ef.AppID).
		Where("version_name = ?", shown.name).
		Where("version_code = ?", shown.code)

	defer sizeStmt.Close()

	size = &metrics.SizeMetric{}
	if err := pg.QueryRow(ctx, sizeStmt.String(), sizeStmt.Args()...).Scan(&size.AverageAppSize, &size.SelectedAppSize, &size.Delta); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return size, nil
}

// GetIssueFreeMetrics computes crash and anr free sessions
// percentage for the selected app versions and, separately,
// for the unselected app versions.
//
// - Crash free sessions
// - Perceived crash free sessions
// - ANR free sessions
// - Perceived ANR free sessions
func (a App) GetIssueFreeMetrics(
	ctx context.Context,
	rch driver.Conn,
	ef *exprfilter.ExprFilter,
) (
	crashFree *metrics.CrashFreeSession,
	perceivedCrashFree *metrics.PerceivedCrashFreeSession,
	anrFree *metrics.ANRFreeSession,
	perceivedANRFree *metrics.PerceivedANRFreeSession,
	err error,
) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	crashFree = &metrics.CrashFreeSession{}
	perceivedCrashFree = &metrics.PerceivedCrashFreeSession{}

	switch a.Family() {
	case opsys.Android:
		anrFree = &metrics.ANRFreeSession{}
		perceivedANRFree = &metrics.PerceivedANRFreeSession{}
	}

	predicate, err := appMetricsPredicate(ef)
	if err != nil {
		return
	}
	if predicate != nil {
		defer predicate.Close()
	}

	stmt := sqlf.From(config.AppMetricsTable)
	defer stmt.Close()

	columns := []string{"unique_sessions", "crash_sessions", "perceived_crash_sessions"}
	switch a.Family() {
	case opsys.Android:
		columns = append(columns, "anr_sessions", "perceived_anr_sessions")
	}

	for _, column := range columns {
		if predicate == nil {
			stmt.Select("uniqMerge(" + column + ") as selected_" + column)
			stmt.Select("toUInt64(0) as unselected_" + column)
			continue
		}
		stmt.Select("uniqMergeIf("+column+", "+predicate.String()+") as selected_"+column, predicate.Args()...)
		stmt.Select("uniqMergeIf("+column+", not ("+predicate.String()+")) as unselected_"+column, predicate.Args()...)
	}

	stmt.
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", ef.AppID).
		Where("timestamp >= ? and timestamp <= ?", ef.From, ef.To)

	var (
		selected, unselected                             uint64
		crashSelected, crashUnselected                   uint64
		perceivedCrashSelected, perceivedCrashUnselected uint64
		anrSelected, anrUnselected                       uint64
		perceivedANRSelected, perceivedANRUnselected     uint64
	)

	dest := []any{
		&selected,
		&unselected,
		&crashSelected,
		&crashUnselected,
		&perceivedCrashSelected,
		&perceivedCrashUnselected,
	}

	switch a.Family() {
	case opsys.Android:
		dest = append(dest, &anrSelected, &anrUnselected, &perceivedANRSelected, &perceivedANRUnselected)
	}

	if err = rch.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(dest...); err != nil {
		return
	}

	if selected == 0 {
		crashFree.CrashFreeSessions = math.NaN()
		perceivedCrashFree.CrashFreeSessions = math.NaN()

		switch a.Family() {
		case opsys.Android:
			anrFree.ANRFreeSessions = math.NaN()
			perceivedANRFree.ANRFreeSessions = math.NaN()
		}
	} else {
		crashFree.CrashFreeSessions = numeric.RoundTwoDecimalsFloat64((1 - (float64(crashSelected) / float64(selected))) * 100)
		perceivedCrashFree.CrashFreeSessions = numeric.RoundTwoDecimalsFloat64((1 - (float64(perceivedCrashSelected) / float64(selected))) * 100)

		switch a.Family() {
		case opsys.Android:
			anrFree.ANRFreeSessions = numeric.RoundTwoDecimalsFloat64((1 - (float64(anrSelected) / float64(selected))) * 100)
			perceivedANRFree.ANRFreeSessions = numeric.RoundTwoDecimalsFloat64((1 - (float64(perceivedANRSelected) / float64(selected))) * 100)
		}
	}

	if unselected == 0 {
		crashFree.UnselectedCrashFreeSessions = math.NaN()
		perceivedCrashFree.UnselectedCrashFreeSessions = math.NaN()

		switch a.Family() {
		case opsys.Android:
			anrFree.UnselectedANRFreeSessions = math.NaN()
			perceivedANRFree.UnselectedANRFreeSessions = math.NaN()
		}
	} else {
		crashFree.UnselectedCrashFreeSessions = numeric.RoundTwoDecimalsFloat64((1 - (float64(crashUnselected) / float64(unselected))) * 100)
		perceivedCrashFree.UnselectedCrashFreeSessions = numeric.RoundTwoDecimalsFloat64((1 - (float64(perceivedCrashUnselected) / float64(unselected))) * 100)

		switch a.Family() {
		case opsys.Android:
			anrFree.UnselectedANRFreeSessions = numeric.RoundTwoDecimalsFloat64((1 - (float64(anrUnselected) / float64(unselected))) * 100)
			perceivedANRFree.UnselectedANRFreeSessions = numeric.RoundTwoDecimalsFloat64((1 - (float64(perceivedANRUnselected) / float64(unselected))) * 100)
		}
	}

	crashFree.SetNoData()
	perceivedCrashFree.SetNoData()

	switch a.Family() {
	case opsys.Android:
		anrFree.SetNoData()
		perceivedANRFree.SetNoData()
	}

	return
}

// appMetricsPredicate writes the filter as a boolean expression over the
// app_metrics columns, or nil when the request carried no filter expression
// and every row of the app counts as selected.
func appMetricsPredicate(ef *exprfilter.ExprFilter) (*sqlf.Stmt, error) {
	if !ef.HasFilterExpr() {
		return nil, nil
	}
	return ef.Predicate(nil)
}

// GetAdoptionMetrics computes adoption by comparing the sessions of the
// selected app versions against the sessions of every version of the app.
func (a App) GetAdoptionMetrics(ctx context.Context, rch driver.Conn, ef *exprfilter.ExprFilter) (adoption *metrics.SessionAdoption, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	adoption = &metrics.SessionAdoption{}

	predicate, err := appMetricsPredicate(ef)
	if err != nil {
		return
	}
	if predicate != nil {
		defer predicate.Close()
	}

	stmt := sqlf.From(config.AppMetricsTable)
	defer stmt.Close()

	if predicate == nil {
		stmt.Select("uniqMerge(unique_sessions) as selected_sessions")
	} else {
		stmt.Select("uniqMergeIf(unique_sessions, "+predicate.String()+") as selected_sessions", predicate.Args()...)
	}

	stmt.
		Select("uniqMerge(unique_sessions) as all_sessions").
		Select("round((selected_sessions / all_sessions) * 100, 2) as adoption").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", ef.AppID).
		Where("timestamp >= ? and timestamp <= ?", ef.From, ef.To)

	if err = rch.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&adoption.SelectedVersion, &adoption.AllVersions, &adoption.Adoption); err != nil {
		return
	}

	adoption.SetNoData()

	return
}

// GetLaunchMetrics computes the cold, warm and hot launch p95 quantiles twice:
// once over the app versions the filter selects and once over the versions it
// leaves out. A quantile merged over no rows comes back as NaN, which the
// no-data flags then record.
func (a App) GetLaunchMetrics(ctx context.Context, rch driver.Conn, ef *exprfilter.ExprFilter) (launch *metrics.LaunchMetric, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	launch = &metrics.LaunchMetric{}

	predicate, err := appMetricsPredicate(ef)
	if err != nil {
		return
	}
	if predicate != nil {
		defer predicate.Close()
	}

	stmt := sqlf.From(config.AppMetricsTable)
	defer stmt.Close()

	columns := []string{"cold_launch_p95", "warm_launch_p95", "hot_launch_p95"}

	for _, column := range columns {
		if predicate == nil {
			stmt.Select("round(quantileMerge(0.95)(" + column + "), 2) as selected_" + column)
			continue
		}
		stmt.Select("round(quantileMergeIf(0.95)("+column+", "+predicate.String()+"), 2) as selected_"+column, predicate.Args()...)
	}

	for _, column := range columns {
		if predicate == nil {
			stmt.Select("nan as unselected_" + column)
			continue
		}
		stmt.Select("round(quantileMergeIf(0.95)("+column+", not ("+predicate.String()+")), 2) as unselected_"+column, predicate.Args()...)
	}

	stmt.
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", ef.AppID).
		Where("timestamp >= ? and timestamp <= ?", ef.From, ef.To)

	if err = rch.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(
		&launch.ColdLaunchP95,
		&launch.WarmLaunchP95,
		&launch.HotLaunchP95,
		&launch.UnselectedColdLaunchP95,
		&launch.UnselectedWarmLaunchP95,
		&launch.UnselectedHotLaunchP95,
	); err != nil {
		return
	}

	launch.SetNoData()

	return
}

// applySessionsPredicate adds the filter to a sessions query, choosing where
// it runs. The sessions table keeps one row per ingest batch until ClickHouse
// merges them in the background, so a recent session is often several rows.
// Take a session whose first batch carried the session start and a log line
// and whose second batch carried a crash: until the merge it is two rows, one
// with fatal_exception_count 0 and one with fatal_exception_count 1.
//
// A condition that a single row can satisfy is decided correctly before the
// GROUP BY, since the crash row alone answers "contains a crash", and
// filtering there lets ClickHouse skip granules through the count indexes.
// A negation or a conjunction is not: "contains no crash" is true on the
// first row and would return the crashed session, and "has a log and a
// crash" is true on neither row, since the log and the crash never meet, and
// would miss it. Those conditions run in HAVING over the per-session totals,
// where both rows have been added up. The price is that a HAVING cannot use
// the count indexes, so ClickHouse reads every session row of the app in the
// time range before discarding, where a WHERE skips the granules whose counts
// rule them out.
func applySessionsPredicate(base *sqlf.Stmt, ef *exprfilter.ExprFilter) error {
	if ef.NeedsWholeGroup() {
		predicate, err := ef.Predicate(exprfilter.SessionsAggregatedKeyBindings)
		if err != nil {
			return err
		}
		defer predicate.Close()
		base.Having(predicate.String(), predicate.Args()...)
	} else {
		predicate, err := ef.Predicate(nil)
		if err != nil {
			return err
		}
		defer predicate.Close()
		base.Where(predicate.String(), predicate.Args()...)
	}

	return nil
}

// GetSessionsInstancesPlot provides aggregated session instances
// matching the filter expression.
func (a App) GetSessionsInstancesPlot(ctx context.Context, rch driver.Conn, ef *exprfilter.ExprFilter) (sessionInstances []session.SessionInstance, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	if ef.Timezone == "" {
		return nil, errors.New("missing timezone filter")
	}

	ef.SetDefaultPlotTimeGroupIfUnset()

	groupExpr, err := GetPlotTimeGroupExpr("start_time", ef.PlotTimeGroup)
	if err != nil {
		return nil, err
	}

	base := sqlf.From("sessions").
		Select("session_id").
		Select("min(first_event_timestamp) as start_time").
		Select("app_version").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("first_event_timestamp >= ? and last_event_timestamp <= ?", ef.From, ef.To)

	if ef.HasFilterExpr() {
		if err = applySessionsPredicate(base, ef); err != nil {
			return nil, err
		}
	}

	base.
		GroupBy("session_id").
		GroupBy("app_version").
		GroupBy("os_version").
		GroupBy("device_name").
		GroupBy("device_model").
		GroupBy("device_manufacturer")

	// exclude sessions whose only events are session_start,
	// they carry no real content & are pointless to return
	base.Having("sum(event_count) > sumMap(event_type_counts)['session_start']")

	stmt := sqlf.
		With("base", base).
		From("base").
		Select("count() as instances").
		Select(groupExpr.BucketExpr+" as datetime_bucket", ef.Timezone).
		Select("formatDateTime(datetime_bucket, ?) as datetime", groupExpr.DatetimeFormat).
		Select("concat(app_version.1, ' ', '(', app_version.2, ')') as app_version_fmt").
		GroupBy("app_version, datetime_bucket").
		OrderBy("datetime_bucket, app_version.2 desc")

	defer stmt.Close()

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
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

// GetSessionsWithFilter provides sessions that match the filter
// expression in a paginated fashion.
func (a App) GetSessionsWithFilter(ctx context.Context, rch driver.Conn, ef *exprfilter.ExprFilter) (sessions []SessionDisplay, next, previous bool, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
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
		Where("first_event_timestamp >= ? and last_event_timestamp <= ?", ef.From, ef.To)

	if ef.HasFilterExpr() {
		if err = applySessionsPredicate(base, ef); err != nil {
			return
		}
	}

	base.
		GroupBy("session_id").
		GroupBy("app_version").
		GroupBy("os_version").
		GroupBy("device_name").
		GroupBy("device_model").
		GroupBy("device_manufacturer")

	// exclude sessions whose only events are session_start,
	// they carry no real content & are pointless to return
	base.Having("sum(event_count) > sumMap(event_type_counts)['session_start']")

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
		if ef.Limit > 0 {
			stmt.Limit(uint64(ef.Limit) + 1)
		}

		if ef.Offset >= 0 {
			stmt.Offset(uint64(ef.Offset))
		}
	}

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var sess SessionDisplay
		sess.Session = new(Session)
		sess.Attribute = new(event.Attribute)
		sess.AppID = ef.AppID

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

		if err = rows.Scan(dest...); err != nil {
			fmt.Println(err)
			return
		}

		if err = rows.Err(); err != nil {
			return
		}

		// set duration
		sess.Duration = time.Duration(sess.LastEventTime.Sub(*sess.FirstEventTime).Milliseconds())

		sessions = append(sessions, sess)
	}

	err = rows.Err()

	resultLen := len(sessions)

	// set pagination next & previous flags
	if resultLen > ef.Limit {
		sessions = sessions[:resultLen-1]
		next = true
	}

	if ef.Offset > 0 {
		previous = true
	}

	return
}

// FetchRootSpanNames returns list of root span names for a given app id
func (a App) FetchRootSpanNames(ctx context.Context, rch driver.Conn) (traceNames []string, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
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

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
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
func (a App) FetchTracesForSessionId(ctx context.Context, rch driver.Conn, sessionID uuid.UUID) (sessionTraces []span.TraceSessionTimelineDisplay, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
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

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
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

// GetSpansForSpanNameWithFilter provides the list of spans for the given
// span name that matches the filter expression, newest first, in a paginated
// fashion.
func (a App) GetSpansForSpanNameWithFilter(ctx context.Context, rch driver.Conn, spanName string, ef *exprfilter.ExprFilter) (rootSpans []span.RootSpanDisplay, next, previous bool, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
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
		Where("start_time >= ? and end_time <= ?", ef.From, ef.To)

	defer stmt.Close()

	if ef.HasFilterExpr() {
		predicate, errPredicate := ef.Predicate(nil)
		if errPredicate != nil {
			err = errPredicate
			return
		}
		defer predicate.Close()
		stmt.Where(predicate.String(), predicate.Args()...)
	}

	stmt.OrderBy("start_time desc")

	if ef.Limit > 0 {
		stmt.Limit(uint64(ef.Limit) + 1)
	}

	if ef.Offset >= 0 {
		stmt.Offset(uint64(ef.Offset))
	}

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
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

		rootSpan.Duration = time.Duration(rootSpan.EndTime.Sub(rootSpan.StartTime).Milliseconds())

		rootSpans = append(rootSpans, rootSpan)
	}

	if err = rows.Err(); err != nil {
		return
	}

	resultLen := len(rootSpans)

	// Set pagination next & previous flags
	if resultLen > ef.Limit {
		rootSpans = rootSpans[:resultLen-1]
		next = true
	}
	if ef.Offset > 0 {
		previous = true
	}

	return
}

// GetMetricsPlotForSpanNameWithFilter provides p50, p90, p95 and p99
// duration metrics for the given span name that matches the filter
// expression.
func (a App) GetMetricsPlotForSpanNameWithFilter(ctx context.Context, rch driver.Conn, spanName string, ef *exprfilter.ExprFilter) (spanMetricsPlotInstances []span.SpanMetricsPlotInstance, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	if ef.Timezone == "" {
		err = fmt.Errorf("timezone is required")
		return
	}

	ef.SetDefaultPlotTimeGroupIfUnset()
	groupExpr, err := GetPlotTimeGroupExpr("timestamp", ef.PlotTimeGroup)
	if err != nil {
		return nil, err
	}

	stmt := sqlf.
		From("span_metrics").
		Select("concat(tupleElement(app_version, 1), ' ', '(', tupleElement(app_version, 2), ')') app_version_fmt").
		Select(groupExpr.BucketExpr+" as datetime_bucket", ef.Timezone).
		Select("formatDateTime(datetime_bucket, ?) as datetime", groupExpr.DatetimeFormat).
		Select("round(quantileMerge(0.50)(p50), 2) as p50").
		Select("round(quantileMerge(0.90)(p90), 2) as p90").
		Select("round(quantileMerge(0.95)(p95), 2) as p95").
		Select("round(quantileMerge(0.99)(p99), 2) as p99").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("span_name = ?", spanName).
		Where("timestamp >= ? and timestamp <= ?", ef.From, ef.To)

	defer stmt.Close()

	if ef.HasFilterExpr() {
		predicate, errPredicate := ef.Predicate(exprfilter.SpanMetricsKeyBindings)
		if errPredicate != nil {
			return nil, errPredicate
		}
		defer predicate.Close()
		stmt.Where(predicate.String(), predicate.Args()...)
	}

	stmt.GroupBy("app_version, datetime_bucket")
	stmt.OrderBy("datetime_bucket, tupleElement(app_version, 2) desc")

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
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
func (a App) GetTrace(ctx context.Context, rch driver.Conn, traceId string) (trace span.TraceDisplay, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
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

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
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

// GetBugReportsWithFilter provides bug reports that match the filter
// expression, newest first, in a paginated fashion.
func (a App) GetBugReportsWithFilter(ctx context.Context, rch driver.Conn, ef *exprfilter.ExprFilter) (bugReports []BugReportDisplay, next, previous bool, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
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
		Where("timestamp >= ? and timestamp <= ?", ef.From, ef.To)

	defer stmt.Close()

	if ef.HasFilterExpr() {
		predicate, errPredicate := ef.Predicate(nil)
		if errPredicate != nil {
			err = errPredicate
			return
		}
		defer predicate.Close()
		stmt.Where(predicate.String(), predicate.Args()...)
	}

	stmt.OrderBy("timestamp desc")

	if ef.Limit > 0 {
		stmt.Limit(uint64(ef.Limit) + 1)
	}

	if ef.Offset >= 0 {
		stmt.Offset(uint64(ef.Offset))
	}

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	defer rows.Close()

	for rows.Next() {
		var bugReport BugReportDisplay
		bugReport.BugReport = new(BugReport)
		bugReport.Attribute = new(event.Attribute)
		bugReport.AppID = ef.AppID

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

		bugReports = append(bugReports, bugReport)
	}

	err = rows.Err()

	resultLen := len(bugReports)

	// Set pagination next & previous flags
	if resultLen > ef.Limit {
		bugReports = bugReports[:resultLen-1]
		next = true
	}
	if ef.Offset > 0 {
		previous = true
	}

	return
}

// GetBugReportInstancesPlot provides aggregated bug report instances
// matching the filter expression.
func (a App) GetBugReportInstancesPlot(ctx context.Context, rch driver.Conn, ef *exprfilter.ExprFilter) (bugReportInstances []BugReportInstance, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
	if ef.Timezone == "" {
		err = fmt.Errorf("timezone is required")
		return
	}

	ef.SetDefaultPlotTimeGroupIfUnset()
	groupExpr, err := GetPlotTimeGroupExpr("timestamp", ef.PlotTimeGroup)
	if err != nil {
		return nil, err
	}

	base := sqlf.From("bug_reports final").
		Select("event_id").
		Select("app_version").
		Select("timestamp").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("timestamp >= ? and timestamp <= ?", ef.From, ef.To)

	if ef.HasFilterExpr() {
		predicate, errPredicate := ef.Predicate(nil)
		if errPredicate != nil {
			return nil, errPredicate
		}
		defer predicate.Close()
		base.Where(predicate.String(), predicate.Args()...)
	}

	base.OrderBy("timestamp desc")
	base.GroupBy("event_id")
	base.GroupBy("app_version")
	base.GroupBy("timestamp")

	stmt := sqlf.
		With("base", base).
		From("base").
		Select("uniq(event_id) instances").
		Select(groupExpr.BucketExpr+" as datetime_bucket", ef.Timezone).
		Select("formatDateTime(datetime_bucket, ?) as datetime", groupExpr.DatetimeFormat).
		Select("concat(tupleElement(app_version, 1), ' ', '(', tupleElement(app_version, 2), ')') app_version_fmt").
		GroupBy("app_version, datetime_bucket").
		OrderBy("datetime_bucket, tupleElement(app_version, 2) desc")

	defer stmt.Close()

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}
	defer rows.Close()

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
func (a App) GetBugReportById(ctx context.Context, rch driver.Conn, presign event.PreSignConfig, bugReportId string) (bugReport BugReport, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
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

	row := rch.QueryRow(ctx, stmt.String(), stmt.Args()...)

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
			if err = bugReport.Attachments[j].PreSignURL(ctx, presign); err != nil {
				msg := `failed to generate URLs for attachment`
				fmt.Println(msg, err)
				return
			}
		}
	}

	return
}

// UpdateBugReportStatusById updates the status of a bug report by its event id.
func (a App) UpdateBugReportStatusById(ctx context.Context, ch driver.Conn, bugReportId string, status uint8) (err error) {
	if status != 0 && status != 1 {
		return fmt.Errorf("invalid status %d. Should be 0 (open) or 1 (closed)", status)
	}

	stmt := sqlf.
		Update("bug_reports").
		Set("status", status).
		Set("updated_at", time.Now()).
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("event_id = ?", bugReportId)

	defer stmt.Close()

	if err = ch.Exec(ctx, stmt.String(), stmt.Args()...); err != nil {
		return
	}

	return
}

func (a *App) Add(tx pgx.Tx) (*APIKey, error) {
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

func (a *App) GetWithTeam(pg *pgxpool.Pool, id uuid.UUID) (*App, error) {
	var appName pgtype.Text
	var uniqueId pgtype.Text
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
		"apps.os_names",
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
		&a.OSNames,
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

	if err := pg.QueryRow(context.Background(), stmt.String(), id, a.TeamId).Scan(dest...); err != nil {
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

func (a *App) GetTeam(ctx context.Context, pg *pgxpool.Pool) (*Team, error) {
	team := &Team{}

	stmt := sqlf.PostgreSQL.
		Select("team_id").
		From("apps").
		Where("id = ?", a.ID)

	defer stmt.Close()

	if err := pg.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&team.ID); err != nil {
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
func (a *App) Populate(ctx context.Context, pg *pgxpool.Pool) (err error) {
	var uniqueId pgtype.Text
	var firstVersion pgtype.Text
	var onboardedAt pgtype.Timestamptz

	stmt := sqlf.PostgreSQL.From("apps").
		Select("team_id::UUID").
		Select("unique_identifier").
		Select("app_name").
		Select("os_names").
		Select("first_version").
		Select("onboarded").
		Select("onboarded_at").
		Select("created_at").
		Select("updated_at").
		Where("id = ?", a.ID)

	defer stmt.Close()

	if err = pg.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&a.TeamId, &uniqueId, &a.AppName, &a.OSNames, &firstVersion, &a.Onboarded, &onboardedAt, &a.CreatedAt, &a.UpdatedAt); err != nil {
		return
	}

	if uniqueId.Valid {
		a.UniqueId = uniqueId.String
	}

	if firstVersion.Valid {
		a.FirstVersion = firstVersion.String
	}

	if onboardedAt.Valid {
		a.OnboardedAt = onboardedAt.Time
	}

	return
}

// unmarshalAttachments parses the
// attachments JSON array.
func unmarshalAttachments(attachments string, dest *[]event.Attachment) error {
	if len(attachments) <= 8 {
		return nil
	}
	return json.Unmarshal([]byte(attachments), dest)
}

// GetSessionEvents fetches all the events of an app's session.
func (a *App) GetSessionEvents(ctx context.Context, rch driver.Conn, sessionId uuid.UUID) (*Session, error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)
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
		`gesture_long_click.label`,
		`gesture_long_click.semantic_label`,
		`gesture_long_click.touch_down_time`,
		`gesture_long_click.touch_up_time`,
		`gesture_long_click.width`,
		`gesture_long_click.height`,
		`gesture_long_click.x`,
		`gesture_long_click.y`,
		`gesture_click.target`,
		`gesture_click.target_id`,
		`gesture_click.label`,
		`gesture_click.semantic_label`,
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
		`if(exception.has_num_code OR exception.num_code != 0, exception.num_code, NULL) as num_code`,
		`exception.code`,
		`exception.meta`,
		`exception.is_custom`,
		`exception.severity`,
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
		`log.severity_text`,
		`log.severity_number`,
		`log.body`,
	}

	switch a.Family() {
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
			`profile.reason`,
			`profile.format`,
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

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)

	if err != nil {
		return nil, err
	}

	var session Session
	var firstUserID string
	var firstAttr *event.Attribute

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
		var logData event.Log
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
		var profile event.Profile

		var coldLaunchDuration uint32
		var warmLaunchDuration uint32
		var hotLaunchDuration uint32

		var exceptionError string
		var exceptionMeta string
		var exceptionSeverity string
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
			&gestureLongClick.Label,
			&gestureLongClick.SemanticLabel,
			&gestureLongClick.TouchDownTime,
			&gestureLongClick.TouchUpTime,
			&gestureLongClick.Width,
			&gestureLongClick.Height,
			&gestureLongClick.X,
			&gestureLongClick.Y,

			// gesture click
			&gestureClick.Target,
			&gestureClick.TargetID,
			&gestureClick.Label,
			&gestureClick.SemanticLabel,
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

			// exception
			&exception.NumCode,
			&exception.Code,
			&exceptionMeta,
			&exception.IsCustom,
			&exceptionSeverity,
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

			// log
			&logData.SeverityText,
			&logData.SeverityNumber,
			&logData.Body,
		}

		switch a.Family() {
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

				// profile
				&profile.Reason,
				&profile.Format,
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

		// Capture first non-empty user ID
		if firstUserID == "" && ev.Attribute.UserID != "" {
			firstUserID = ev.Attribute.UserID
		}

		// capture first scanned row's attribute so sessions
		// whose rows are all dropped by the type switch
		// still carry an attribute
		if firstAttr == nil {
			attr := ev.Attribute
			firstAttr = &attr
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
			exception.Severity = event.Severity(exceptionSeverity)

			if exceptionExceptions != "" {
				if err := json.Unmarshal([]byte(exceptionExceptions), &exception.Exceptions); err != nil {
					return nil, err
				}
			}

			if exceptionThreads != "" {
				if err := json.Unmarshal([]byte(exceptionThreads), &exception.Threads); err != nil {
					return nil, err
				}
			}

			if attachments != "" {
				if err := json.Unmarshal([]byte(attachments), &ev.Attachments); err != nil {
					return nil, err
				}
			}

			if exceptionMeta != "" {
				if err := json.Unmarshal([]byte(exceptionMeta), &exception.Meta); err != nil {
					return nil, err
				}
			}

			// for now, only unmarshal exception.error for Apple
			// family of OSes. support can - of course, be extended
			// to other OSes on a "need to" basis.
			switch a.Family() {
			case opsys.AppleFamily:
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
		case event.TypeLog:
			ev.Log = &logData
			session.Events = append(session.Events, ev)
		case event.TypeGestureLongClick:
			if err := unmarshalAttachments(attachments, &ev.Attachments); err != nil {
				return nil, err
			}
			ev.GestureLongClick = &gestureLongClick
			session.Events = append(session.Events, ev)
		case event.TypeGestureClick:
			if err := unmarshalAttachments(attachments, &ev.Attachments); err != nil {
				return nil, err
			}
			ev.GestureClick = &gestureClick
			session.Events = append(session.Events, ev)
		case event.TypeGestureScroll:
			if err := unmarshalAttachments(attachments, &ev.Attachments); err != nil {
				return nil, err
			}
			ev.GestureScroll = &gestureScroll
			session.Events = append(session.Events, ev)
		case event.TypeLifecycleActivity:
			if err := unmarshalAttachments(attachments, &ev.Attachments); err != nil {
				return nil, err
			}
			ev.LifecycleActivity = &lifecycleActivity
			session.Events = append(session.Events, ev)
		case event.TypeLifecycleFragment:
			ev.LifecycleFragment = &lifecycleFragment
			session.Events = append(session.Events, ev)
		case event.TypeLifecycleApp:
			if err := unmarshalAttachments(attachments, &ev.Attachments); err != nil {
				return nil, err
			}
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
			if err := unmarshalAttachments(attachments, &ev.Attachments); err != nil {
				return nil, err
			}
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
		case event.TypeProfile:
			if err := unmarshalAttachments(attachments, &ev.Attachments); err != nil {
				return nil, err
			}
			ev.Profile = &profile
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
	} else if firstAttr != nil {
		if firstUserID != "" {
			firstAttr.UserID = firstUserID
		}
		session.Attribute = firstAttr
	}

	return &session, nil
}

func NewApp(teamId uuid.UUID) *App {
	now := time.Now()
	id := uuid.New()
	return &App{
		ID:        &id,
		TeamId:    teamId,
		Retention: MIN_RETENTION_DAYS,
		CreatedAt: now,
		UpdatedAt: now,
	}
}

// ErrAppNotFound is returned when no app exists for the given id.
var ErrAppNotFound = errors.New("app not found")

// SelectApp selects app by its id.
func SelectApp(ctx context.Context, pg *pgxpool.Pool, id uuid.UUID) (app *App, err error) {
	var onboarded pgtype.Bool
	var uniqueId pgtype.Text
	var firstVersion pgtype.Text

	stmt := sqlf.PostgreSQL.
		Select("id").
		Select("team_id").
		Select("onboarded").
		Select("unique_identifier").
		Select("os_names").
		Select("first_version").
		From("apps").
		Where("id = ?", id)

	defer stmt.Close()

	if app == nil {
		app = &App{}
	}

	if err := pg.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&app.ID, &app.TeamId, &onboarded, &uniqueId, &app.OSNames, &firstVersion); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrAppNotFound
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

	if firstVersion.Valid {
		app.FirstVersion = firstVersion.String
	} else {
		app.FirstVersion = ""
	}

	return
}
