package exprfilter

import (
	"context"
	"fmt"
	"slices"
	"strings"
	"time"

	"backend/libs/chquery"
	"backend/libs/symbol"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
)

// Entity is one subject a filter can be written against, such as builds,
// events or spans. It says which keys it offers, BindKey says how a key maps
// to actual data, and SuggestKeyValues lists what one key can be set to. A
// binding may read from more than one place, so no database or a table is
// specified here.
type Entity struct {
	// Name is what a request specifies to filter this subject.
	Name string

	// Keys is everything this subject can be filtered by.
	Keys []Key

	// BindKey turns one condition into a boolean SQL expression, with
	// the values to bind. A key this entity does not offer comes back as
	// ErrKeyNotSupported.
	BindKey KeyBinding

	// SuggestKeyValues lists what one key can be set to, narrowed by what has been
	// typed. Both pools are passed because which one an entity reads is its own
	// choice.
	SuggestKeyValues func(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, teamID, appID uuid.UUID, key Key, valueRequest ValueRequest) (ValueList, error)

	// FetchCustomKeys lists the keys an app's user-defined attributes add to
	// the entity's fixed set. Nil for an entity whose keys are all fixed.
	FetchCustomKeys func(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, teamID, appID uuid.UUID, limit int) ([]Key, bool, error)

	// FetchCustomKeysByName reads the entity's custom keys with the given
	// names, each name without the custom prefix. A name not present in
	// user defined attributes yields no key. Nil for an entity whose keys are all fixed.
	FetchCustomKeysByName func(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, teamID, appID uuid.UUID, rawNames []string) ([]Key, error)

	// BindCustomKeys builds the GroupKeyBinding for the given custom keys.
	// Nil for an entity whose keys are all fixed.
	BindCustomKeys func(teamID, appID uuid.UUID, from, to time.Time, keys []Key) GroupKeyBinding

	// MaxTimeBucketWidth is the widest time bucket used by any of the entity's
	// tables. Bucketed queries may include rows from this bucket past the range
	// end, so custom key bindings must be resolved that far past it. Zero means
	// all tables store raw timestamps.
	MaxTimeBucketWidth time.Duration
}

func FindByName(name string) (Entity, error) {
	switch name {
	case BuildsEntity.Name:
		return BuildsEntity, nil
	case SpansEntity.Name:
		return SpansEntity, nil
	}

	return Entity{}, fmt.Errorf("Unknown filter entity %q", name)
}

// The groups a key can belong to.
const (
	KeyGroupVersion  KeyGroup = "Version"
	KeyGroupBuild    KeyGroup = "Build"
	KeyGroupSpan     KeyGroup = "Span"
	KeyGroupOS       KeyGroup = "OS"
	KeyGroupDevice   KeyGroup = "Device"
	KeyGroupNetwork  KeyGroup = "Network"
	KeyGroupLocation KeyGroup = "Location"
	KeyGroupCustom   KeyGroup = "Custom"
)

// keyGroupOrder is the order the filter bar shows groups in.
var keyGroupOrder = []KeyGroup{
	KeyGroupVersion, KeyGroupBuild, KeyGroupSpan,
	KeyGroupOS, KeyGroupDevice, KeyGroupNetwork, KeyGroupLocation,
	KeyGroupCustom,
}

// ListKeyGroups lists the groups a set of keys falls into, in the order the
// filter bar shows them.
func ListKeyGroups(keys []Key) []KeyGroup {
	present := make(map[KeyGroup]bool, len(keys))
	for _, key := range keys {
		present[key.KeyGroup] = true
	}

	keyGroups := []KeyGroup{}
	for _, keyGroup := range keyGroupOrder {
		if present[keyGroup] {
			keyGroups = append(keyGroups, keyGroup)
		}
	}
	return keyGroups
}

// The keys an entity can be filtered by. A key is defined once here and
// shared by every entity that has it, so an app version is called the same
// thing, described the same way and offers the same operators everywhere. A
// definition says what a key is; how it maps to data is the entity's binding.
var (
	versionName = Key{
		Name:        "version_name",
		Label:       "App version",
		Description: "The version of the app.",
		KeyGroup:    KeyGroupVersion,
		ValueType:   ValueTypeString,
		Operators: []Operator{
			OperatorIn, OperatorNotIn,
			OperatorContains, OperatorStartsWith,
		},
		ValueSuggestionMode: ValueSuggestionModeSample,
	}

	versionCode = Key{
		Name:                "version_code",
		Label:               "Build number",
		Description:         "The build number (Version Code on Android, Bundle Version on iOS).",
		KeyGroup:            KeyGroupVersion,
		ValueType:           ValueTypeString,
		Operators:           []Operator{OperatorIn, OperatorNotIn},
		ValueSuggestionMode: ValueSuggestionModeSample,
	}

	patchVersion = Key{
		Name:        "patch_version",
		Label:       "Patch version",
		Description: "The version of an Over-The-Air patch.",
		KeyGroup:    KeyGroupVersion,
		ValueType:   ValueTypeString,
		Operators: []Operator{
			OperatorIn, OperatorNotIn, OperatorContains,
		},
		ValueSuggestionMode: ValueSuggestionModeSample,
	}

	patchID = Key{
		Name:        "patch_id",
		Label:       "Patch id",
		Description: "The id of an Over-The-Air patch.",
		KeyGroup:    KeyGroupVersion,
		ValueType:   ValueTypeUUID,
		Operators: []Operator{
			OperatorIn, OperatorNotIn,
			OperatorIsSet, OperatorIsNotSet,
		},
		ValueSuggestionMode: ValueSuggestionModeSample,
	}

	mappingType = Key{
		Name:                "mapping_type",
		Label:               "Mapping type",
		Description:         "The kind of symbol file uploaded: proguard, dSYM, ELF debug or JS bundle.",
		KeyGroup:            KeyGroupBuild,
		ValueType:           ValueTypeEnum,
		Operators:           []Operator{OperatorIn, OperatorNotIn},
		ValueSuggestionMode: ValueSuggestionModeFullList,
		EnumValues:          mappingTypes(),
	}

	spanStatus = Key{
		Name:                "span_status",
		Label:               "Span status",
		Description:         "Status of the span.",
		KeyGroup:            KeyGroupSpan,
		ValueType:           ValueTypeEnum,
		Operators:           []Operator{OperatorIn, OperatorNotIn},
		ValueSuggestionMode: ValueSuggestionModeFullList,
		EnumValues:          []string{"unset", "ok", "error"},
	}

	osName = Key{
		Name:                "os_name",
		Label:               "OS name",
		Description:         "The name of the operating system.",
		KeyGroup:            KeyGroupOS,
		ValueType:           ValueTypeString,
		Operators:           []Operator{OperatorIn, OperatorNotIn},
		ValueSuggestionMode: ValueSuggestionModeSample,
	}

	osVersion = Key{
		Name:        "os_version",
		Label:       "OS version",
		Description: "The version of the operating system.",
		KeyGroup:    KeyGroupOS,
		ValueType:   ValueTypeString,
		Operators: []Operator{
			OperatorIn, OperatorNotIn,
			OperatorContains, OperatorStartsWith,
		},
		ValueSuggestionMode: ValueSuggestionModeSample,
	}

	deviceName = Key{
		Name:        "device_name",
		Label:       "Device name",
		Description: "The name of the device.",
		KeyGroup:    KeyGroupDevice,
		ValueType:   ValueTypeString,
		Operators: []Operator{
			OperatorIn, OperatorNotIn,
			OperatorContains, OperatorStartsWith,
		},
		ValueSuggestionMode: ValueSuggestionModeSample,
	}

	deviceManufacturer = Key{
		Name:                "device_manufacturer",
		Label:               "Device manufacturer",
		Description:         "The manufacturer of the device.",
		KeyGroup:            KeyGroupDevice,
		ValueType:           ValueTypeString,
		Operators:           []Operator{OperatorIn, OperatorNotIn},
		ValueSuggestionMode: ValueSuggestionModeSample,
	}

	locale = Key{
		Name:                "locale",
		Label:               "Locale",
		Description:         "The device locale.",
		KeyGroup:            KeyGroupDevice,
		ValueType:           ValueTypeString,
		Operators:           []Operator{OperatorIn, OperatorNotIn},
		ValueSuggestionMode: ValueSuggestionModeSample,
	}

	networkType = Key{
		Name:                "network_type",
		Label:               "Network type",
		Description:         "The kind of network connection: wifi, cellular and so on.",
		KeyGroup:            KeyGroupNetwork,
		ValueType:           ValueTypeString,
		Operators:           []Operator{OperatorIn, OperatorNotIn},
		ValueSuggestionMode: ValueSuggestionModeSample,
	}

	networkGeneration = Key{
		Name:                "network_generation",
		Label:               "Network generation",
		Description:         "The cellular network generation: 2g, 3g, 4g and so on.",
		KeyGroup:            KeyGroupNetwork,
		ValueType:           ValueTypeString,
		Operators:           []Operator{OperatorIn, OperatorNotIn},
		ValueSuggestionMode: ValueSuggestionModeSample,
	}

	networkProvider = Key{
		Name:                "network_provider",
		Label:               "Network provider",
		Description:         "The name of the network service provider.",
		KeyGroup:            KeyGroupNetwork,
		ValueType:           ValueTypeString,
		Operators:           []Operator{OperatorIn, OperatorNotIn},
		ValueSuggestionMode: ValueSuggestionModeSample,
	}

	country = Key{
		Name:                "country",
		Label:               "Country",
		Description:         "The country the device was in, as a country code.",
		KeyGroup:            KeyGroupLocation,
		ValueType:           ValueTypeString,
		Operators:           []Operator{OperatorIn, OperatorNotIn},
		ValueSuggestionMode: ValueSuggestionModeSample,
	}
)

func mappingTypes() []string {
	types := symbol.MappingTypes()
	names := make([]string, len(types))
	for i, mappingType := range types {
		names[i] = mappingType.String()
	}
	return names
}

// narrowEnumValues narrows a key's fixed value set by what has been typed. An
// enum key carries its values itself, so no table is read.
func narrowEnumValues(key Key, valueRequest ValueRequest) ValueList {
	values := []Value{}
	for _, text := range key.EnumValues {
		if valueRequest.Search != "" && !strings.Contains(strings.ToLower(text), strings.ToLower(valueRequest.Search)) {
			continue
		}
		values = append(values, Value{Text: text})
	}

	limit := valueRequest.Limit
	if limit <= 0 {
		limit = DefaultValueLimit
	}
	if len(values) > limit {
		return ValueList{Values: values[:limit], Truncated: true}
	}
	return ValueList{Values: values}
}

func readCustomKeys(ctx context.Context, ch driver.Conn, teamID uuid.UUID, stmt *sqlf.Stmt) ([]Key, error) {
	ctx = chquery.WithTeamScope(ctx, teamID)

	rows, err := ch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, fmt.Errorf("Failed to read the user-defined attribute keys: %w", err)
	}
	defer rows.Close()

	keys := []Key{}
	for rows.Next() {
		var rawName, storedType string
		if err := rows.Scan(&rawName, &storedType); err != nil {
			return nil, fmt.Errorf("Failed to read the user-defined attribute keys: %w", err)
		}
		valueType, ok := customValueTypes[storedType]
		if !ok {
			return nil, fmt.Errorf("Attribute %q stores values of unknown type %q", rawName, storedType)
		}
		keys = append(keys, CustomKey(rawName, valueType))
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("Failed to read the user-defined attribute keys: %w", err)
	}

	return keys, nil
}

var comparisonSQL = map[Operator]string{
	OperatorEq:  "=",
	OperatorNeq: "!=",
	OperatorGt:  ">",
	OperatorGte: ">=",
	OperatorLt:  "<",
	OperatorLte: "<=",
}

// customConditionMatch describes which attribute rows satisfy a condition.
// For negated conditions, sql matches the offending rows and negated tells
// the caller to exclude their IDs.
type customConditionMatch struct {
	rawName string
	sql     string
	args    []any
	negated bool
}

// matchCustomCondition translates a custom-key condition into a row predicate.
// Values are stored as text, so numeric comparisons cast them to the key's type.
func matchCustomCondition(key Key, condition Condition) (customConditionMatch, error) {
	rawName := strings.TrimPrefix(key.Name, CustomKeyPrefix)
	storedType := string(key.ValueType)

	// An attribute rewritten under a new type keeps its old rows, so the
	// presence test matches on the key alone and ignores the type.
	presence := func(negated bool) (customConditionMatch, error) {
		return customConditionMatch{rawName: rawName, sql: "key = ?", args: []any{rawName}, negated: negated}, nil
	}
	// typed builds a predicate for a value-bearing condition, restricting rows
	// to the key's current stored type before applying the value comparison.
	typed := func(negated bool, valueComparison string, valueArgs ...any) (customConditionMatch, error) {
		return customConditionMatch{
			rawName: rawName,
			sql:     "key = ? and type = ?" + valueComparison,
			args:    append([]any{rawName, storedType}, valueArgs...),
			negated: negated,
		}, nil
	}

	switch condition.Operator {
	case OperatorIsSet:
		return presence(false)
	case OperatorIsNotSet:
		return presence(true)
	}

	switch key.ValueType {
	case ValueTypeString:
		switch condition.Operator {
		case OperatorIn:
			return typed(false, " and value in ?", condition.TextValues())
		case OperatorNotIn:
			return typed(true, " and value in ?", condition.TextValues())
		case OperatorContains:
			return typed(false, " and value ilike ?", "%"+EscapeLikeWildcards(condition.TextValue())+"%")
		case OperatorNotContains:
			return typed(true, " and value ilike ?", "%"+EscapeLikeWildcards(condition.TextValue())+"%")
		case OperatorStartsWith:
			return typed(false, " and value ilike ?", EscapeLikeWildcards(condition.TextValue())+"%")
		case OperatorEndsWith:
			return typed(false, " and value ilike ?", "%"+EscapeLikeWildcards(condition.TextValue()))
		}

	case ValueTypeInt64:
		if condition.Operator == OperatorNeq {
			number, err := condition.IntegerValue()
			if err != nil {
				return customConditionMatch{}, err
			}
			return typed(true, " and toInt64OrNull(value) = ?", number)
		}
		if comparison, ok := comparisonSQL[condition.Operator]; ok {
			number, err := condition.IntegerValue()
			if err != nil {
				return customConditionMatch{}, err
			}
			return typed(false, " and toInt64OrNull(value) "+comparison+" ?", number)
		}

	case ValueTypeFloat64:
		if condition.Operator == OperatorNeq {
			number, err := condition.FloatValue()
			if err != nil {
				return customConditionMatch{}, err
			}
			return typed(true, " and toFloat64OrNull(value) = ?", number)
		}
		if comparison, ok := comparisonSQL[condition.Operator]; ok {
			number, err := condition.FloatValue()
			if err != nil {
				return customConditionMatch{}, err
			}
			return typed(false, " and toFloat64OrNull(value) "+comparison+" ?", number)
		}

	case ValueTypeBool:
		if condition.Operator == OperatorEq {
			yes, err := condition.BoolValue()
			if err != nil {
				return customConditionMatch{}, err
			}
			text := "false"
			if yes {
				text = "true"
			}
			return typed(false, " and value = ?", text)
		}
	}

	return customConditionMatch{}, fmt.Errorf("Key %q cannot be filtered with %q", condition.KeyName, condition.Operator)
}

// customMembershipBinder holds the request-scoped context needed to build
// custom-key membership queries.
type customMembershipBinder struct {
	table      string
	idColumn   string
	teamID     uuid.UUID
	appID      uuid.UUID
	from       time.Time
	to         time.Time
	keysByName map[string]Key
}

// customAttrScope limits attribute rows to the current team, app, and time range.
const customAttrScope = " where team_id = toUUID(?) and app_id = toUUID(?)" +
	" and timestamp >= ? and timestamp <= ?"

// bindCustomConditionsToMembership creates a GroupKeyBinding for custom-key
// conditions. Multiple conditions are evaluated with countIf over one grouped
// query instead of generating a separate subquery for each condition.
func bindCustomConditionsToMembership(table, idColumn string) func(teamID, appID uuid.UUID, from, to time.Time, keys []Key) GroupKeyBinding {
	return func(teamID, appID uuid.UUID, from, to time.Time, keys []Key) GroupKeyBinding {
		binder := &customMembershipBinder{
			table:      table,
			idColumn:   idColumn,
			teamID:     teamID,
			appID:      appID,
			from:       from,
			to:         to,
			keysByName: IndexKeysByName(keys),
		}
		return binder.bind
	}
}

// bind is the GroupKeyBinding for one request's custom keys.
func (b *customMembershipBinder) bind(operator LogicalOperator, conditions []Condition) (*sqlf.Stmt, error) {
	matches := make([]customConditionMatch, len(conditions))
	for i, condition := range conditions {
		key, found := b.keysByName[condition.KeyName]
		if !found {
			return nil, fmt.Errorf("%w: %q", ErrKeyNotSupported, condition.KeyName)
		}
		match, err := matchCustomCondition(key, condition)
		if err != nil {
			return nil, err
		}
		matches[i] = match
	}

	if len(matches) == 1 {
		text, args := b.single(matches[0])
		return sqlf.New(text, args...), nil
	}
	if operator == LogicalAnd {
		return b.allOf(matches), nil
	}
	return b.anyOf(matches), nil
}

// allOf builds the membership query for AND conditions.
// Positive conditions require a matching row; negated conditions require
// zero matching (offending) rows.
func (b *customMembershipBinder) allOf(matches []customConditionMatch) *sqlf.Stmt {
	anyPositive := slices.ContainsFunc(matches, func(match customConditionMatch) bool {
		return !match.negated
	})

	if anyPositive {
		// With at least one positive condition, every matching ID must appear in the
		// grouped result. Negated conditions can therefore be expressed as zero
		// offending rows.
		having, havingArgs := countIfHaving(matches, " and ", func(match customConditionMatch) string {
			if match.negated {
				return " = 0"
			}
			return " > 0"
		})
		text, args := b.grouped("in", matches, having, havingArgs)
		return sqlf.New(text, args...)
	}

	// When every condition is negated, find IDs that violate any condition and
	// exclude them. IDs with no attribute rows never enter the subquery and
	// therefore remain matched.
	having, havingArgs := countIfHaving(matches, " or ", func(customConditionMatch) string {
		return " > 0"
	})
	text, args := b.grouped("not in", matches, having, havingArgs)
	return sqlf.New(text, args...)
}

// anyOf builds the membership query for OR conditions.
// Positive conditions can share a grouped query; negated conditions stay
// as separate NOT IN branches.
func (b *customMembershipBinder) anyOf(matches []customConditionMatch) *sqlf.Stmt {
	// Separate positive and negated conditions because they have different
	// membership semantics when combined with OR.
	positives := []customConditionMatch{}
	for _, match := range matches {
		if !match.negated {
			positives = append(positives, match)
		}
	}

	var text strings.Builder
	args := []any{}
	appendPart := func(partText string, partArgs []any) {
		if text.Len() > 0 {
			text.WriteString(" or ")
		}
		text.WriteString(partText)
		args = append(args, partArgs...)
	}

	// Multiple positive conditions can share one grouped query.
	if len(positives) >= 2 {
		having, havingArgs := countIfHaving(positives, " or ", func(customConditionMatch) string {
			return " > 0"
		})
		appendPart(b.grouped("in", positives, having, havingArgs))
	} else if len(positives) == 1 {
		// A single positive condition does not need GROUP BY/HAVING.
		appendPart(b.single(positives[0]))
	}

	// Keep negated conditions as NOT IN branches. A grouped attribute query
	// cannot represent IDs with no attribute rows, which must still satisfy
	// a negated condition.
	for _, match := range matches {
		if match.negated {
			appendPart(b.single(match))
		}
	}

	return sqlf.New(text.String(), args...)
}

// single builds the membership query for one condition.
// Negated conditions use NOT IN so IDs without the attribute also match.
func (b *customMembershipBinder) single(match customConditionMatch) (string, []any) {
	operator := "in"
	if match.negated {
		operator = "not in"
	}
	text := b.idColumn + " " + operator + " (" +
		"select " + b.idColumn + " from " + b.table +
		customAttrScope +
		" and " + match.sql +
		")"
	args := make([]any, 0, 4+len(match.args))
	args = append(args, b.teamID, b.appID, b.from, b.to)
	args = append(args, match.args...)
	return text, args
}

// grouped builds a membership query that evaluates multiple conditions in
// one grouped scan. The caller supplies the countIf-based HAVING expression.
func (b *customMembershipBinder) grouped(operator string, matches []customConditionMatch, having string, havingArgs []any) (string, []any) {
	rawNames := []string{}
	for _, match := range matches {
		if !slices.Contains(rawNames, match.rawName) {
			rawNames = append(rawNames, match.rawName)
		}
	}

	text := b.idColumn + " " + operator + " (" +
		"select " + b.idColumn + " from " + b.table +
		customAttrScope +
		" and key in ?" +
		" group by " + b.idColumn +
		" having " + having +
		")"
	args := make([]any, 0, 5+len(havingArgs))
	args = append(args, b.teamID, b.appID, b.from, b.to, rawNames)
	args = append(args, havingArgs...)
	return text, args
}

// countIfHaving builds the HAVING expression from one countIf per condition.
// The suffix determines whether a condition requires matches (> 0) or no
// offending matches (= 0).
func countIfHaving(matches []customConditionMatch, joiner string, suffix func(customConditionMatch) string) (string, []any) {
	var having strings.Builder
	args := []any{}
	for i, match := range matches {
		if i > 0 {
			having.WriteString(joiner)
		}
		having.WriteString("countIf(")
		having.WriteString(match.sql)
		having.WriteString(")")
		having.WriteString(suffix(match))
		args = append(args, match.args...)
	}
	return having.String(), args
}

// BuildsEntity is an app's uploaded builds. Both its filtering and its
// value lists read the build_mappings rows in Postgres.
var BuildsEntity = Entity{
	Name:             "builds",
	Keys:             buildsKeys,
	BindKey:          bindBuildsKey,
	SuggestKeyValues: fetchBuildsKeySuggestions,
}

var buildsKeys = []Key{
	versionName,
	versionCode,
	mappingType,
	patchVersion,
	patchID,
}

// bindBuildsKey compares one key against the build_mappings column of the
// same name. Every key must answer each operator it offers, so a missing case
// means a filter passed validation that cannot be written, and the request
// fails.
func bindBuildsKey(condition Condition) (*sqlf.Stmt, error) {
	switch condition.KeyName {
	case versionName.Name:
		switch condition.Operator {
		case OperatorIn:
			return sqlf.New("version_name = any(?)", condition.TextValues()), nil
		case OperatorNotIn:
			return sqlf.New("version_name <> all(?)", condition.TextValues()), nil
		case OperatorContains:
			return sqlf.New("version_name ilike ?", "%"+EscapeLikeWildcards(condition.TextValue())+"%"), nil
		case OperatorStartsWith:
			return sqlf.New("version_name ilike ?", EscapeLikeWildcards(condition.TextValue())+"%"), nil
		}

	case versionCode.Name:
		switch condition.Operator {
		case OperatorIn:
			return sqlf.New("version_code = any(?)", condition.TextValues()), nil
		case OperatorNotIn:
			return sqlf.New("version_code <> all(?)", condition.TextValues()), nil
		}

	case mappingType.Name:
		switch condition.Operator {
		case OperatorIn:
			return sqlf.New("mapping_type = any(?)", condition.TextValues()), nil
		case OperatorNotIn:
			return sqlf.New("mapping_type <> all(?)", condition.TextValues()), nil
		}

	case patchVersion.Name:
		switch condition.Operator {
		case OperatorIn:
			return sqlf.New("patch_version = any(?)", condition.TextValues()), nil
		case OperatorNotIn:
			return sqlf.New("patch_version <> all(?)", condition.TextValues()), nil
		case OperatorContains:
			return sqlf.New("patch_version ilike ?", "%"+EscapeLikeWildcards(condition.TextValue())+"%"), nil
		}

	case patchID.Name:
		// A regular build carries the nil uuid rather than null, so that value
		// is what "not set" compares against.
		switch condition.Operator {
		case OperatorIn:
			return sqlf.New("patch_id::text = any(?)", condition.TextValues()), nil
		case OperatorNotIn:
			return sqlf.New("patch_id::text <> all(?)", condition.TextValues()), nil
		case OperatorIsSet:
			return sqlf.New("patch_id::text <> '" + uuid.Nil.String() + "'"), nil
		case OperatorIsNotSet:
			return sqlf.New("patch_id::text = '" + uuid.Nil.String() + "'"), nil
		}

	default:
		return nil, fmt.Errorf("%w: %q", ErrKeyNotSupported, condition.KeyName)
	}

	return nil, fmt.Errorf("Key %q cannot be filtered with %q", condition.KeyName, condition.Operator)
}

// fetchBuildsKeySuggestions lists what one key can be set to, narrowed by what has been
// typed. It asks for one row past the limit so it can report that more matched
// without counting them. Builds are read from Postgres only, so the ClickHouse
// connection and the team id are unused here.
func fetchBuildsKeySuggestions(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, teamID, appID uuid.UUID, key Key, valueRequest ValueRequest) (ValueList, error) {
	if len(key.EnumValues) > 0 {
		return narrowEnumValues(key, valueRequest), nil
	}

	if key.ValueSuggestionMode == ValueSuggestionModeNone {
		return ValueList{}, fmt.Errorf("Key %q is typed in rather than picked from a list", key.Name)
	}

	limit := valueRequest.Limit
	if limit <= 0 {
		limit = DefaultValueLimit
	}

	// A row the key does not apply to holds the unset value in that column, so
	// those rows are left out: a regular build has no patch columns and a patch
	// upload has no version columns.
	column := key.Name
	unset := "''"
	if key.ValueType == ValueTypeUUID {
		column += "::text"
		unset = "'" + uuid.Nil.String() + "'"
	}

	stmt := sqlf.PostgreSQL.From("build_mappings").
		Select(column).
		Select("max(last_updated) as recency").
		Where("app_id = ?", appID).
		Where(column + " <> " + unset).
		GroupBy(column).
		OrderBy("recency desc").
		Limit(limit + 1)

	defer stmt.Close()

	if valueRequest.Search != "" {
		stmt.Where(column+" ilike ?", "%"+EscapeLikeWildcards(valueRequest.Search)+"%")
	}

	rows, err := pgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return ValueList{}, fmt.Errorf("Failed to read the values of key %q: %w", key.Name, err)
	}
	defer rows.Close()

	values := []Value{}
	for rows.Next() {
		var text string
		var recency any
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
	BindCustomKeys:        bindCustomConditionsToMembership("span_user_def_attrs", "span_id"),
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
		OrderBy("recency desc").
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
