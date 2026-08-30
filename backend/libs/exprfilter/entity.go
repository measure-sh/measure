package exprfilter

import (
	"context"
	"fmt"
	"strings"
	"time"

	"backend/libs/symbol"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
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

	// SuggestFixedKeyValues lists what one fixed key can be set to, narrowed
	// by what has been typed. Both pools are passed because which one an
	// entity reads is its own choice.
	SuggestFixedKeyValues func(ctx context.Context, pgPool *pgxpool.Pool, chPool driver.Conn, teamID, appID uuid.UUID, key Key, valueRequest ValueRequest) (ValueList, error)

	// CustomKeys is the one store every custom-key listing, lookup, value
	// read and condition binding goes through, so an entity cannot list keys
	// from one table and bind conditions against another. Nil for an entity
	// whose keys are all fixed.
	CustomKeys *customKeyStore

	// MaxTimeBucketWidth is the widest time bucket used by any of the entity's
	// tables. Bucketed queries may include rows from this bucket past the range
	// end, so custom key bindings must be resolved that far past it. Zero means
	// all tables store raw timestamps.
	MaxTimeBucketWidth time.Duration
}

// CustomKeyScope is the request context a custom-key binding queries with.
// The version lists mirror app version conditions already present in the filter.
// A custom key binding may use it to reduce scans.
type CustomKeyScope struct {
	TeamID       uuid.UUID
	AppID        uuid.UUID
	From         time.Time
	To           time.Time
	VersionNames [][]string
	VersionCodes [][]string
}

func FindByName(name string) (Entity, error) {
	switch name {
	case BuildsEntity.Name:
		return BuildsEntity, nil
	case SpansEntity.Name:
		return SpansEntity, nil
	case BugReportsEntity.Name:
		return BugReportsEntity, nil
	}

	return Entity{}, fmt.Errorf("Unknown filter entity %q", name)
}

// The groups a key can belong to.
const (
	KeyGroupVersion   KeyGroup = "Version"
	KeyGroupBuild     KeyGroup = "Build"
	KeyGroupSpan      KeyGroup = "Span"
	KeyGroupBugReport KeyGroup = "Bug Report"
	KeyGroupSession   KeyGroup = "Session"
	KeyGroupUser      KeyGroup = "User"
	KeyGroupOS        KeyGroup = "OS"
	KeyGroupDevice    KeyGroup = "Device"
	KeyGroupNetwork   KeyGroup = "Network"
	KeyGroupLocation  KeyGroup = "Location"
	KeyGroupCustom    KeyGroup = "Custom"
)

// keyGroupOrder is the order the filter bar shows groups in.
var keyGroupOrder = []KeyGroup{
	KeyGroupBugReport, KeyGroupVersion, KeyGroupBuild, KeyGroupSpan,
	KeyGroupOS, KeyGroupDevice, KeyGroupNetwork, KeyGroupLocation,
	KeyGroupUser, KeyGroupSession, KeyGroupCustom,
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

	bugReportStatus = Key{
		Name:                "bug_report_status",
		Label:               "Status",
		Description:         "Whether the bug report is open or closed.",
		KeyGroup:            KeyGroupBugReport,
		ValueType:           ValueTypeEnum,
		Operators:           []Operator{OperatorIn, OperatorNotIn},
		ValueSuggestionMode: ValueSuggestionModeFullList,
		EnumValues:          []string{"open", "closed"},
	}

	userID = Key{
		Name:        "user_id",
		Label:       "User ID",
		Description: "The user id of the session.",
		KeyGroup:    KeyGroupUser,
		ValueType:   ValueTypeString,
		Operators: []Operator{
			OperatorIn, OperatorNotIn,
			OperatorContains, OperatorStartsWith,
		},
		ValueSuggestionMode: ValueSuggestionModeSample,
	}

	bugReportDescription = Key{
		Name:        "bug_report_description",
		Label:       "Description",
		Description: "The bug report description written by the reporter.",
		KeyGroup:    KeyGroupBugReport,
		ValueType:   ValueTypeString,
		Operators: []Operator{
			OperatorContains, OperatorNotContains,
			OperatorStartsWith, OperatorEndsWith,
		},
		ValueSuggestionMode: ValueSuggestionModeNone,
	}

	sessionID = Key{
		Name:                "session_id",
		Label:               "Session ID",
		Description:         "The id of the session.",
		KeyGroup:            KeyGroupSession,
		ValueType:           ValueTypeUUID,
		Operators:           []Operator{OperatorIn, OperatorNotIn},
		ValueSuggestionMode: ValueSuggestionModeNone,
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

	limit := valueRequest.effectiveLimit()
	if len(values) > limit {
		return ValueList{Values: values[:limit], Truncated: true}
	}
	return ValueList{Values: values}
}
