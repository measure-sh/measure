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

// SpansEntity is an app's performance trace spans. Both its filtering and its
// value lists read the spans table in ClickHouse. The span_metrics rollup
// stores the same fields as flat columns, which SpanMetricsKeyBindings maps
// for queries that aggregate over it.
var SpansEntity = Entity{
	Name:                  "spans",
	Keys:                  spansKeys,
	BindKey:               bindSpansKeyToColumns(spansTableColumns),
	SuggestKeyValues:      fetchSpansKeySuggestions,
	FetchCustomKeys:       fetchSpanCustomKeys,
	FetchCustomKeysByName: fetchSpanCustomKeysByName,
	BindCustomKeys:        bindCustomConditionsToMembership("span_user_def_attrs", "span_id", ""),
	// span_metrics groups spans into 15-minute buckets by start time. A query
	// can therefore include spans whose bucket extends past the range end.
	MaxTimeBucketWidth: 15 * time.Minute,
}

var spansKeys = []Key{
	versionName,
	versionCode,
	spanStatus,
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

// The column expression each spans key compares against, per table. The spans
// table nests device and network attributes in attribute-prefixed columns and
// the span_metrics rollup stores the same fields as flat columns; both hold
// the app and os versions as (name, version) tuples.
var (
	spansTableColumns = map[string]string{
		versionName.Name:        "tupleElement(attribute.app_version, 1)",
		versionCode.Name:        "tupleElement(attribute.app_version, 2)",
		spanStatus.Name:         "status",
		osName.Name:             "tupleElement(attribute.os_version, 1)",
		osVersion.Name:          "tupleElement(attribute.os_version, 2)",
		deviceName.Name:         "attribute.device_name",
		deviceManufacturer.Name: "attribute.device_manufacturer",
		locale.Name:             "attribute.device_locale",
		networkType.Name:        "attribute.network_type",
		networkGeneration.Name:  "attribute.network_generation",
		networkProvider.Name:    "attribute.network_provider",
		country.Name:            "attribute.country_code",
	}

	spanFilterColumns = map[string]string{
		versionName.Name:        "tupleElement(app_version, 1)",
		versionCode.Name:        "tupleElement(app_version, 2)",
		osName.Name:             "tupleElement(os_version, 1)",
		osVersion.Name:          "tupleElement(os_version, 2)",
		deviceName.Name:         "device_name",
		deviceManufacturer.Name: "device_manufacturer",
		locale.Name:             "device_locale",
		networkType.Name:        "network_type",
		networkGeneration.Name:  "network_generation",
		networkProvider.Name:    "network_provider",
		country.Name:            "country_code",
	}

	spanMetricsTableColumns = map[string]string{
		versionName.Name:        "tupleElement(app_version, 1)",
		versionCode.Name:        "tupleElement(app_version, 2)",
		spanStatus.Name:         "status",
		osName.Name:             "tupleElement(os_version, 1)",
		osVersion.Name:          "tupleElement(os_version, 2)",
		deviceName.Name:         "device_name",
		deviceManufacturer.Name: "device_manufacturer",
		locale.Name:             "device_locale",
		networkType.Name:        "network_type",
		networkGeneration.Name:  "network_generation",
		networkProvider.Name:    "network_provider",
		country.Name:            "country_code",
	}
)

// SpanMetricsKeyBindings maps every fixed spans key onto the flat columns of
// the span_metrics rollup, as Predicate overrides for queries that read that
// table.
func SpanMetricsKeyBindings() map[string]KeyBinding {
	binding := bindSpansKeyToColumns(spanMetricsTableColumns)
	overrides := make(map[string]KeyBinding, len(spansKeys))
	for _, key := range spansKeys {
		overrides[key.Name] = binding
	}
	return overrides
}

// spanStatusCodes maps the status names a filter carries to the integer codes
// the status column stores.
var spanStatusCodes = map[string]int8{
	"unset": 0,
	"ok":    1,
	"error": 2,
}

// bindSpansKeyToColumns compares one key against the column expression the
// mapping names for it.
func bindSpansKeyToColumns(columns map[string]string) KeyBinding {
	return func(condition Condition) (*sqlf.Stmt, error) {
		column, ok := columns[condition.KeyName]
		if !ok {
			return nil, fmt.Errorf("%w: %q", ErrKeyNotSupported, condition.KeyName)
		}

		if condition.KeyName == spanStatus.Name {
			return bindSpanStatusCondition(column, condition)
		}

		switch condition.Operator {
		case OperatorIn:
			return sqlf.New(column+" in ?", condition.TextValues()), nil
		case OperatorNotIn:
			return sqlf.New(column+" not in ?", condition.TextValues()), nil
		case OperatorContains:
			return sqlf.New(column+" ilike ?", "%"+EscapeLikeWildcards(condition.TextValue())+"%"), nil
		case OperatorStartsWith:
			return sqlf.New(column+" ilike ?", EscapeLikeWildcards(condition.TextValue())+"%"), nil
		}

		return nil, fmt.Errorf("Key %q cannot be filtered with %q", condition.KeyName, condition.Operator)
	}
}

func bindSpanStatusCondition(column string, condition Condition) (*sqlf.Stmt, error) {
	codes := make([]int8, 0, len(condition.Values))
	for _, name := range condition.TextValues() {
		code, ok := spanStatusCodes[name]
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

// fetchSpansKeySuggestions lists what one key can be set to, narrowed by what
// has been typed. Values are read from the spans table in ClickHouse, most
// recently seen first, asking for one row past the limit so it can report that
// more matched without counting them.
func fetchSpansKeySuggestions(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, teamID, appID uuid.UUID, key Key, valueRequest ValueRequest) (ValueList, error) {
	if len(key.EnumValues) > 0 {
		return narrowEnumValues(key, valueRequest), nil
	}

	if key.ValueSuggestionMode == ValueSuggestionModeNone {
		return ValueList{}, fmt.Errorf("Key %q takes typed-in values only", key.Name)
	}

	if strings.HasPrefix(key.Name, CustomKeyPrefix) {
		return fetchSpanCustomKeySuggestions(ctx, chPool, teamID, appID, key, valueRequest)
	}

	column, ok := spanFilterColumns[key.Name]
	if !ok {
		return ValueList{}, fmt.Errorf("%w: %q", ErrKeyNotSupported, key.Name)
	}

	limit := valueRequest.Limit
	if limit <= 0 {
		limit = DefaultValueLimit
	}

	ctx = chquery.WithTeamScope(ctx, teamID)

	// A span that did not carry an attribute holds an empty string in that
	// column, so those rows are left out. Recency carries month granularity,
	// so values seen in the same month order alphabetically.
	stmt := sqlf.
		From("span_filters").
		Select(column+" as suggested_value").
		Select("max(end_of_month) as recency").
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

// The custom keys of spans are the user-defined attributes an app set on
// its spans. The span_user_def_attrs table holds one row per span, attribute
// and value, with the value of every type stored in one String column, and
// each condition on one becomes a span_id membership subquery against it.
// The attributes are read from ClickHouse, so the Postgres pool the entity
// fields carry is unused here.

// fetchSpanCustomKeys lists the filter keys for every user-defined attribute
// of an app's spans, ordered by name. It asks for one key past the limit so
// it can report that more exist without counting them.
func fetchSpanCustomKeys(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, teamID, appID uuid.UUID, limit int) ([]Key, bool, error) {
	stmt := spanCustomKeyQuery(teamID, appID).
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

// fetchSpanCustomKeysByName reads the filter keys for the named user-defined
// span attributes of one app.
func fetchSpanCustomKeysByName(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, teamID, appID uuid.UUID, rawNames []string) ([]Key, error) {
	if len(rawNames) == 0 {
		return nil, nil
	}

	stmt := spanCustomKeyQuery(teamID, appID).
		Where("key in ?", rawNames)

	defer stmt.Close()

	return readCustomKeys(ctx, chPool, teamID, stmt)
}

// spanCustomKeyQuery reads an app's user-defined span attribute keys with
// their types. An attribute rewritten under a new type keeps one row per
// type, so the type written last is the one its key offers.
//
// The scan is on the full table without a time bound. If needed in future:
// time bound it so only keys in time range show up or add a rollup
// of distinct keys and values like the span_filters rollupthat fixed keys read.
func spanCustomKeyQuery(teamID, appID uuid.UUID) *sqlf.Stmt {
	return sqlf.
		From("span_user_def_attrs final").
		Select("key").
		Select("argMax(type, timestamp) as type").
		Where("team_id = toUUID(?)", teamID).
		Where("app_id = toUUID(?)", appID).
		GroupBy("key").
		OrderBy("key")
}

// fetchSpanCustomKeySuggestions lists what one user-defined attribute has
// been set to, most recently written first, asking for one row past the limit
// so it can report that more matched without counting them. Empty ones are left out.
//
// The scan is on the full table without a time bound. If needed in future: time bound
// it so only suggestions in time range show up or add a rollup of distinct keys and
// values like the span_filters rollup that fixed keys read.
func fetchSpanCustomKeySuggestions(ctx context.Context, chPool driver.Conn, teamID, appID uuid.UUID, key Key, valueRequest ValueRequest) (ValueList, error) {
	limit := valueRequest.Limit
	if limit <= 0 {
		limit = DefaultValueLimit
	}

	ctx = chquery.WithTeamScope(ctx, teamID)

	stmt := sqlf.
		From("span_user_def_attrs").
		Select("value").
		Select("max(timestamp) as recency").
		Where("team_id = toUUID(?)", teamID).
		Where("app_id = toUUID(?)", appID).
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
