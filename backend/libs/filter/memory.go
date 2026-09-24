package filter

import "backend/libs/devicememory"

var MemoryEntity = Entity{
	Name:         "memory",
	Keys:         memoryKeys,
	Columns:      memoryEventsColumns,
	ValueSources: []valueSource{memoryFixedKeyValues},
}

var memoryKeys = []Key{
	appState,
	versionName,
	versionCode,
	patchVersion,
	patchID,
	osName,
	osVersion,
	deviceName,
	deviceManufacturer,
	deviceTotalMemory,
}

var memoryEventsColumns = &Columns{dialect: dialectClickHouse, byKey: map[string]column{
	appState.Name:           {kind: columnPredicates, predicates: appStatePredicates},
	versionName.Name:        {expr: "`attribute.app_version`"},
	versionCode.Name:        {expr: "`attribute.app_build`"},
	patchVersion.Name:       {expr: "`attribute.patch_version`"},
	patchID.Name:            {expr: "`attribute.patch_id`", kind: columnUUID},
	osName.Name:             {expr: "`attribute.os_name`"},
	osVersion.Name:          {expr: "`attribute.os_version`"},
	deviceName.Name:         {expr: "`attribute.device_name`"},
	deviceManufacturer.Name: {expr: "`attribute.device_manufacturer`"},
	deviceTotalMemory.Name:  {kind: columnPredicates, predicates: devicememory.Predicates("if(type = 'memory_usage_absolute', `memory_usage_absolute.max_memory`, `attribute.device_total_memory`)")},
}}

var memoryFixedKeyValues = valueSource{
	table:       "app_filters",
	columns:     appFiltersColumns,
	recencyExpr: "max(end_of_month)",
}

// App state filters Android readings only. iOS readings always pass.
var appStatePredicates = map[string]string{
	"foreground":   "(type = 'memory_usage_absolute' or `memory_usage.app_importance` = 'foreground')",
	"user_service": "(type = 'memory_usage_absolute' or `memory_usage.app_importance` = 'user_service')",
	"background":   "(type = 'memory_usage_absolute' or `memory_usage.app_importance` = 'background')",
}
