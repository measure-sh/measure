package exprfilter

import (
	"context"
	"fmt"
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
