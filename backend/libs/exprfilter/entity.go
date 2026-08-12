package exprfilter

import (
	"context"
	"fmt"
	"strings"

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
	SuggestKeyValues func(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, appID uuid.UUID, key Key, valueRequest ValueRequest) (ValueList, error)
}

func FindByName(name string) (Entity, error) {
	switch name {
	case BuildsEntity.Name:
		return BuildsEntity, nil
	}

	return Entity{}, fmt.Errorf("Unknown filter entity %q", name)
}

// The groups a key can belong to.
const (
	KeyGroupVersion KeyGroup = "Version"
	KeyGroupBuild   KeyGroup = "Build"
)

// keyGroupOrder is the order the filter bar shows groups in.
var keyGroupOrder = []KeyGroup{KeyGroupVersion, KeyGroupBuild}

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
)

func mappingTypes() []string {
	types := symbol.MappingTypes()
	names := make([]string, len(types))
	for i, mappingType := range types {
		names[i] = mappingType.String()
	}
	return names
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
// connection is unused here.
func fetchBuildsKeySuggestions(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, appID uuid.UUID, key Key, valueRequest ValueRequest) (ValueList, error) {
	// An enum key carries its values itself, so the search narrows that set here
	// instead of a column.
	if len(key.EnumValues) > 0 {
		values := []Value{}
		for _, text := range key.EnumValues {
			if valueRequest.Search != "" && !strings.Contains(strings.ToLower(text), strings.ToLower(valueRequest.Search)) {
				continue
			}
			values = append(values, Value{Text: text})
		}
		return ValueList{Values: values}, nil
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
