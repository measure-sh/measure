package exprfilter

import (
	"context"
	"fmt"
	"strings"
	"time"

	"backend/libs/chquery"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
)

// BugReportsEntity is an app's bug reports. Filtering and value lists both
// read the bug_reports table in ClickHouse, which stores every attribute as a
// flat column, and its user-defined attributes are the user_def_attrs rows
// flagged bug_report.
var BugReportsEntity = Entity{
	Name:                  "bug_reports",
	Keys:                  bugReportsKeys,
	BindKey:               bindBugReportsKeyToColumns(bugReportsTableColumns),
	SuggestKeyValues:      fetchBugReportsKeySuggestions,
	FetchCustomKeys:       fetchBugReportCustomKeys,
	FetchCustomKeysByName: fetchBugReportCustomKeysByName,
	BindCustomKeys:        bindCustomConditionsToMembership("user_def_attrs", "event_id", "bug_report = true"),
}

var bugReportsKeys = []Key{
	versionName,
	versionCode,
	bugReportStatus,
	userID,
	bugReportDescription,
	sessionID,
	osName,
	osVersion,
	deviceName,
	deviceManufacturer,
	locale,
	networkType,
	networkGeneration,
	networkProvider,
	country,
}

// The column expression each bug report key compares against. The bug_reports
// table stores every attribute as a flat column and holds the app and os
// versions as (name, version) tuples.
var bugReportsTableColumns = map[string]string{
	versionName.Name:          "tupleElement(app_version, 1)",
	versionCode.Name:          "tupleElement(app_version, 2)",
	bugReportStatus.Name:      "status",
	userID.Name:               "user_id",
	bugReportDescription.Name: "description",
	sessionID.Name:            "session_id",
	osName.Name:               "tupleElement(os_version, 1)",
	osVersion.Name:            "tupleElement(os_version, 2)",
	deviceName.Name:           "device_name",
	deviceManufacturer.Name:   "device_manufacturer",
	locale.Name:               "device_locale",
	networkType.Name:          "network_type",
	networkGeneration.Name:    "network_generation",
	networkProvider.Name:      "network_provider",
	country.Name:              "country_code",
}

// bugReportStatusCodes maps the status names a filter carries to the integer
// codes the status column stores.
var bugReportStatusCodes = map[string]uint8{
	"open":   0,
	"closed": 1,
}

// bindBugReportsKeyToColumns compares one key against the column expression
// the mapping names for it.
func bindBugReportsKeyToColumns(columns map[string]string) KeyBinding {
	return func(condition Condition) (*sqlf.Stmt, error) {
		column, ok := columns[condition.KeyName]
		if !ok {
			return nil, fmt.Errorf("%w: %q", ErrKeyNotSupported, condition.KeyName)
		}

		if condition.KeyName == bugReportStatus.Name {
			return bindBugReportStatusCondition(column, condition)
		}

		switch condition.Operator {
		case OperatorIn:
			return sqlf.New(column+" in ?", condition.TextValues()), nil
		case OperatorNotIn:
			return sqlf.New(column+" not in ?", condition.TextValues()), nil
		case OperatorContains:
			return sqlf.New(column+" ilike ?", "%"+EscapeLikeWildcards(condition.TextValue())+"%"), nil
		case OperatorNotContains:
			return sqlf.New(column+" not ilike ?", "%"+EscapeLikeWildcards(condition.TextValue())+"%"), nil
		case OperatorStartsWith:
			return sqlf.New(column+" ilike ?", EscapeLikeWildcards(condition.TextValue())+"%"), nil
		case OperatorEndsWith:
			return sqlf.New(column+" ilike ?", "%"+EscapeLikeWildcards(condition.TextValue())), nil
		}

		return nil, fmt.Errorf("Key %q cannot be filtered with %q", condition.KeyName, condition.Operator)
	}
}

func bindBugReportStatusCondition(column string, condition Condition) (*sqlf.Stmt, error) {
	codes := make([]uint8, 0, len(condition.Values))
	for _, name := range condition.TextValues() {
		code, ok := bugReportStatusCodes[name]
		if !ok {
			return nil, fmt.Errorf("Key %q has no value %q", condition.KeyName, name)
		}
		codes = append(codes, code)
	}

	switch condition.Operator {
	case OperatorIn:
		return sqlf.New(column+" in ?", codes), nil
	case OperatorNotIn:
		return sqlf.New(column+" not in ?", codes), nil
	}

	return nil, fmt.Errorf("Key %q cannot be filtered with %q", condition.KeyName, condition.Operator)
}

// fetchBugReportsKeySuggestions lists what one key can be set to, narrowed by
// what has been typed. Values are read from the bug_reports table itself,
// most recently seen first, asking for one row past the limit so it can
// report that more matched without counting them. The table holds one row per
// report, so no rollup is needed.
func fetchBugReportsKeySuggestions(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, teamID, appID uuid.UUID, key Key, valueRequest ValueRequest) (ValueList, error) {
	if len(key.EnumValues) > 0 {
		return narrowEnumValues(key, valueRequest), nil
	}

	if key.ValueSuggestionMode == ValueSuggestionModeNone {
		return ValueList{}, fmt.Errorf("Key %q takes typed-in values only", key.Name)
	}

	if strings.HasPrefix(key.Name, CustomKeyPrefix) {
		return fetchBugReportCustomKeySuggestions(ctx, chPool, teamID, appID, key, valueRequest)
	}

	column, ok := bugReportsTableColumns[key.Name]
	if !ok {
		return ValueList{}, fmt.Errorf("%w: %q", ErrKeyNotSupported, key.Name)
	}

	limit := valueRequest.Limit
	if limit <= 0 {
		limit = DefaultValueLimit
	}

	ctx = chquery.WithTeamScope(ctx, teamID)

	// A report that did not carry an attribute holds an empty string in that
	// column, so those rows are left out.
	stmt := sqlf.
		From("bug_reports").
		Select(column+" as suggested_value").
		Select("max(timestamp) as recency").
		Where("team_id = toUUID(?)", teamID).
		Where("app_id = toUUID(?)", appID).
		Where(column + " <> ''").
		GroupBy("suggested_value").
		OrderBy("recency desc, suggested_value").
		Limit(limit + 1)

	defer stmt.Close()

	if valueRequest.Search != "" {
		stmt.Where(column+" ilike ?", "%"+EscapeLikeWildcards(valueRequest.Search)+"%")
	}

	rows, err := chPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return ValueList{}, fmt.Errorf("Failed to read the values of key %q: %w", key.Name, err)
	}
	defer rows.Close()

	values := []Value{}
	for rows.Next() {
		var text string
		var recency time.Time
		if err := rows.Scan(&text, &recency); err != nil {
			return ValueList{}, fmt.Errorf("Failed to read the values of key %q: %w", key.Name, err)
		}
		values = append(values, Value{Text: text})
	}
	if err := rows.Err(); err != nil {
		return ValueList{}, fmt.Errorf("Failed to read the values of key %q: %w", key.Name, err)
	}

	if len(values) > limit {
		return ValueList{Values: values[:limit], Truncated: true}, nil
	}

	return ValueList{Values: values}, nil
}

// The custom keys of bug reports are the user-defined attributes an app set
// on the session a report was filed in. The user_def_attrs table holds one
// row per event, attribute and value for several event kinds, with bug report
// rows flagged bug_report, and each condition on one becomes an event_id
// membership subquery against it. The attributes are read from ClickHouse, so
// the Postgres pool the entity fields carry is unused here.

// fetchBugReportCustomKeys lists the filter keys for every user-defined
// attribute of an app's bug reports, ordered by name. It asks for one key
// past the limit so it can report that more exist without counting them.
func fetchBugReportCustomKeys(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, teamID, appID uuid.UUID, limit int) ([]Key, bool, error) {
	stmt := bugReportCustomKeyQuery(teamID, appID).
		Limit(limit + 1).
		// Most granules hold rows of this team and app anyway, so skip
		// indexes cost analysis without pruning reads.
		Clause("settings use_skip_indexes = 0")

	defer stmt.Close()

	keys, err := readCustomKeys(ctx, chPool, teamID, stmt)
	if err != nil {
		return nil, false, err
	}

	if len(keys) > limit {
		return keys[:limit], true, nil
	}
	return keys, false, nil
}

// fetchBugReportCustomKeysByName reads the filter keys for the named
// user-defined bug report attributes of one app.
func fetchBugReportCustomKeysByName(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, teamID, appID uuid.UUID, rawNames []string) ([]Key, error) {
	if len(rawNames) == 0 {
		return nil, nil
	}

	stmt := bugReportCustomKeyQuery(teamID, appID).
		Where("key in ?", rawNames)

	defer stmt.Close()

	return readCustomKeys(ctx, chPool, teamID, stmt)
}

// bugReportCustomKeyQuery reads an app's user-defined bug report attribute
// keys with their types. An attribute rewritten under a new type keeps one
// row per type, so the type written last is the one its key offers.
//
// The scan is on the full table without a time bound. If needed in future:
// time bound it so only keys in time range show up or add a rollup of
// distinct keys and values like the span_filters rollup that fixed keys read.
func bugReportCustomKeyQuery(teamID, appID uuid.UUID) *sqlf.Stmt {
	return sqlf.
		From("user_def_attrs").
		Select("key").
		Select("argMax(type, timestamp) as type").
		Where("team_id = toUUID(?)", teamID).
		Where("app_id = toUUID(?)", appID).
		Where("bug_report = true").
		GroupBy("key").
		OrderBy("key")
}

// fetchBugReportCustomKeySuggestions lists what one user-defined attribute
// has been set to on bug reports, most recently written first, asking for one
// row past the limit so it can report that more matched without counting
// them. Empty ones are left out.
//
// The scan is on the full table without a time bound. If needed in future:
// time bound it so only suggestions in time range show up or add a rollup of
// distinct keys and values like the span_filters rollup that fixed keys read.
func fetchBugReportCustomKeySuggestions(ctx context.Context, chPool driver.Conn, teamID, appID uuid.UUID, key Key, valueRequest ValueRequest) (ValueList, error) {
	limit := valueRequest.Limit
	if limit <= 0 {
		limit = DefaultValueLimit
	}

	ctx = chquery.WithTeamScope(ctx, teamID)

	stmt := sqlf.
		From("user_def_attrs").
		Select("value").
		Select("max(timestamp) as recency").
		Where("team_id = toUUID(?)", teamID).
		Where("app_id = toUUID(?)", appID).
		Where("bug_report = true").
		Where("key = ?", strings.TrimPrefix(key.Name, CustomKeyPrefix)).
		Where("type = ?", string(key.ValueType)).
		Where("value <> ''").
		GroupBy("value").
		OrderBy("recency desc, value").
		Limit(limit + 1)

	defer stmt.Close()

	if valueRequest.Search != "" {
		stmt.Where("value ilike ?", "%"+EscapeLikeWildcards(valueRequest.Search)+"%")
	}

	rows, err := chPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return ValueList{}, fmt.Errorf("Failed to read the values of key %q: %w", key.Name, err)
	}
	defer rows.Close()

	values := []Value{}
	for rows.Next() {
		var text string
		var recency time.Time
		if err := rows.Scan(&text, &recency); err != nil {
			return ValueList{}, fmt.Errorf("Failed to read the values of key %q: %w", key.Name, err)
		}
		values = append(values, Value{Text: text})
	}
	if err := rows.Err(); err != nil {
		return ValueList{}, fmt.Errorf("Failed to read the values of key %q: %w", key.Name, err)
	}

	if len(values) > limit {
		return ValueList{Values: values[:limit], Truncated: true}, nil
	}

	return ValueList{Values: values}, nil
}
