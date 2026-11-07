package filter

// DevicesEntity filters the devices page. Each list reads a different table, so
// the entity exposes only keys supported by all of them.
var DevicesEntity = Entity{
	Name:         "devices",
	Keys:         devicesKeys,
	Columns:      DevicesEventsColumns,
	ValueSources: []valueSource{devicesAppFiltersValues},
}

var devicesKeys = []Key{
	versionName,
	versionCode,
	osName,
	osVersion,
	deviceModel,
	deviceManufacturer,
	deviceName,
}

// DevicesEventsColumns maps device filter keys to events table columns.
var DevicesEventsColumns = &Columns{dialect: dialectClickHouse, byKey: map[string]column{
	versionName.Name:        {expr: "`attribute.app_version`"},
	versionCode.Name:        {expr: "`attribute.app_build`"},
	osName.Name:             {expr: "`attribute.os_name`"},
	osVersion.Name:          {expr: "`attribute.os_version`"},
	deviceName.Name:         {expr: "`attribute.device_name`"},
	deviceManufacturer.Name: {expr: "`attribute.device_manufacturer`"},
	deviceModel.Name:        {expr: "`attribute.device_model`"},
}}

// DevicesSessionsColumns maps device filter keys to sessions table columns.
var DevicesSessionsColumns = &Columns{dialect: dialectClickHouse, byKey: map[string]column{
	versionName.Name:        {expr: "tupleElement(app_version, 1)"},
	versionCode.Name:        {expr: "tupleElement(app_version, 2)"},
	osName.Name:             {expr: "tupleElement(os_version, 1)"},
	osVersion.Name:          {expr: "tupleElement(os_version, 2)"},
	deviceName.Name:         {expr: "device_name"},
	deviceManufacturer.Name: {expr: "device_manufacturer"},
	deviceModel.Name:        {expr: "device_model"},
}}

var devicesAppFiltersValues = valueSource{
	table:       "app_filters",
	columns:     appFiltersColumns,
	recencyExpr: "max(end_of_month)",
}
