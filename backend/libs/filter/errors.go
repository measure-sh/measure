package filter

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
		Name:            "errors",
		Keys:            errorsKeys,
		Columns:         errorEventsColumns,
		ValueSources:    []valueSource{errorsAppFiltersValues, errorEventsValues},
		CustomKeySource: &errorCustomKeySource,
	}

	ErrorGroupEventsEntity = Entity{
		Name:            "error_group_events",
		Keys:            errorGroupEventsKeys,
		Columns:         errorEventsColumns,
		ValueSources:    []valueSource{errorsAppFiltersValues, errorEventsValues},
		CustomKeySource: &errorCustomKeySource,
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

// Rows written before the severity column existed have it empty; there
// handled=false means the app died. So an unhandled non-fatal error only
// matches rows that name their severity.
var errorTypePredicates = map[string]string{
	ErrorTypeCrash:          "(type = 'exception' and (`exception.severity` = 'fatal' or (`exception.severity` = '' and `exception.handled` = false)))",
	ErrorTypeANR:            "(type = 'anr')",
	ErrorTypeHandledError:   "(type = 'exception' and (`exception.severity` = 'handled' or (`exception.severity` = '' and `exception.handled` = true)))",
	ErrorTypeUnhandledError: "(type = 'exception' and `exception.severity` = 'unhandled')",
}

var errorEventsColumns = &Columns{dialect: dialectClickHouse, byKey: map[string]column{
	errorType.Name:          {kind: columnPredicates, predicates: errorTypePredicates},
	versionName.Name:        {expr: "`attribute.app_version`"},
	versionCode.Name:        {expr: "`attribute.app_build`"},
	patchVersion.Name:       {expr: "`attribute.patch_version`"},
	patchID.Name:            {expr: "`attribute.patch_id`", kind: columnUUID},
	userID.Name:             {expr: "`attribute.user_id`"},
	osName.Name:             {expr: "`attribute.os_name`"},
	osVersion.Name:          {expr: "`attribute.os_version`"},
	deviceName.Name:         {expr: "`attribute.device_name`"},
	deviceManufacturer.Name: {expr: "`attribute.device_manufacturer`"},
	locale.Name:             {expr: "`attribute.device_locale`"},
	networkType.Name:        {expr: "`attribute.network_type`"},
	networkGeneration.Name:  {expr: "`attribute.network_generation`"},
	networkProvider.Name:    {expr: "`attribute.network_provider`"},
	country.Name:            {expr: "`inet.country_code`"},
}}

var errorsAppFiltersValues = valueSource{
	table:       "app_filters",
	columns:     appFiltersColumns,
	recencyExpr: "max(end_of_month)",
}

// app_filters has no user id column, so it is read from events.
var errorEventsValues = valueSource{
	table: "events",
	columns: &Columns{dialect: dialectClickHouse, byKey: map[string]column{
		userID.Name: {expr: "`attribute.user_id`"},
	}},
	recencyExpr: "max(timestamp)",
	timeColumn:  "timestamp",
	extraScope:  "type in ('exception', 'anr')",
}

// Custom keys are the user-defined attributes of the error event itself.
// Bug report rows share the table and are excluded. The events table names
// its id column id, not event_id.
var errorCustomKeySource = customKeySource{
	table:        "user_def_attrs",
	idColumn:     "event_id",
	entityColumn: "id",
	extraScope:   "bug_report = false",
}
