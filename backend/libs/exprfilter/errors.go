package exprfilter

import "slices"

// The values the error_type key takes.
const (
	ErrorTypeCrash          = "Crash"
	ErrorTypeANR            = "ANR"
	ErrorTypeHandledError   = "Handled Error"
	ErrorTypeUnhandledError = "Unhandled Error"
)

// ErrorsEntity filters an app's error groups. ErrorGroupEventsEntity filters
// the events of one group and has no error_type key: a group holds one kind
// of error.
var (
	ErrorsEntity = Entity{
		Name:                  "errors",
		Keys:                  errorsKeys,
		BindKey:               bindKeysToColumns(errorEventsColumns, errorsKeyBindingOverrides),
		SuggestFixedKeyValues: suggestFixedKeyValuesFromClickHouse(errorsAppFiltersValues, errorEventsValues),
		CustomKeys:            &errorCustomKeys,
	}

	ErrorGroupEventsEntity = Entity{
		Name:                  "error_group_events",
		Keys:                  errorGroupEventsKeys,
		BindKey:               bindKeysToColumns(errorEventsColumns, errorsKeyBindingOverrides),
		SuggestFixedKeyValues: suggestFixedKeyValuesFromClickHouse(errorsAppFiltersValues, errorEventsValues),
		CustomKeys:            &errorCustomKeys,
	}
)

var errorsKeys = slices.Concat([]Key{errorType}, errorGroupEventsKeys)

var errorGroupEventsKeys = []Key{
	versionName,
	versionCode,
	patchVersion,
	patchID,
	userID,
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

// error_type has no column; its override binds predicates.
var errorEventsColumns = map[string]string{
	errorType.Name:          "",
	versionName.Name:        "`attribute.app_version`",
	versionCode.Name:        "`attribute.app_build`",
	patchVersion.Name:       "`attribute.patch_version`",
	patchID.Name:            "`attribute.patch_id`",
	userID.Name:             "`attribute.user_id`",
	osName.Name:             "`attribute.os_name`",
	osVersion.Name:          "`attribute.os_version`",
	deviceName.Name:         "`attribute.device_name`",
	deviceManufacturer.Name: "`attribute.device_manufacturer`",
	locale.Name:             "`attribute.device_locale`",
	networkType.Name:        "`attribute.network_type`",
	networkGeneration.Name:  "`attribute.network_generation`",
	networkProvider.Name:    "`attribute.network_provider`",
	country.Name:            "`inet.country_code`",
}

// Rows written before the severity column existed have it empty; there
// handled=false means the app died. So an unhandled non-fatal error only
// matches rows that name their severity.
var errorTypePredicates = map[string]string{
	ErrorTypeCrash:          "(type = 'exception' and (`exception.severity` = 'fatal' or (`exception.severity` = '' and `exception.handled` = false)))",
	ErrorTypeANR:            "(type = 'anr')",
	ErrorTypeHandledError:   "(type = 'exception' and (`exception.severity` = 'handled' or (`exception.severity` = '' and `exception.handled` = true)))",
	ErrorTypeUnhandledError: "(type = 'exception' and `exception.severity` = 'unhandled')",
}

var errorsKeyBindingOverrides = map[string]columnKeyBinding{
	errorType.Name: bindEnumKeyToPredicates(errorTypePredicates),
	patchID.Name:   bindUUIDKey,
}

var errorsAppFiltersValues = fixedKeyValueSource{
	table:       "app_filters",
	columns:     appFiltersColumns,
	recencyExpr: "max(end_of_month)",
}

// app_filters has no user id column, so it is read from events.
var errorEventsValues = fixedKeyValueSource{
	table: "events",
	columns: map[string]string{
		userID.Name: "`attribute.user_id`",
	},
	recencyExpr: "max(timestamp)",
	timeColumn:  "timestamp",
	extraScope:  "type in ('exception', 'anr')",
}

// Custom keys are the user-defined attributes of the error event itself.
// Bug report rows share the table and are excluded. The events table names
// its id column id, not event_id.
var errorCustomKeys = customKeyStore{
	table:        "user_def_attrs",
	idColumn:     "event_id",
	entityColumn: "id",
	extraScope:   "bug_report = false",
}
