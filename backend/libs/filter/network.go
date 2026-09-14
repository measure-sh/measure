package filter

var NetworkEntity = Entity{
	Name:         "network",
	Keys:         networkKeys,
	Columns:      httpEventsColumns,
	ValueSources: []valueSource{networkFixedKeyValues},
}

var networkKeys = []Key{
	versionName,
	versionCode,
	patchVersion,
	patchID,
	httpMethod,
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

var httpEventsColumns = &Columns{dialect: dialectClickHouse, byKey: map[string]column{
	versionName.Name:        {expr: "tupleElement(`attribute.app_version`, 1)"},
	versionCode.Name:        {expr: "tupleElement(`attribute.app_version`, 2)"},
	patchVersion.Name:       {expr: "`attribute.patch_version`"},
	patchID.Name:            {expr: "`attribute.patch_id`", kind: columnUUID},
	httpMethod.Name:         {expr: "lower(method)"},
	osName.Name:             {expr: "tupleElement(`attribute.os_version`, 1)"},
	osVersion.Name:          {expr: "tupleElement(`attribute.os_version`, 2)"},
	deviceName.Name:         {expr: "`attribute.device_name`"},
	deviceManufacturer.Name: {expr: "`attribute.device_manufacturer`"},
	locale.Name:             {expr: "`attribute.device_locale`"},
	networkType.Name:        {expr: "`attribute.network_type`"},
	networkGeneration.Name:  {expr: "`attribute.network_generation`"},
	networkProvider.Name:    {expr: "`attribute.network_provider`"},
	country.Name:            {expr: "`inet.country_code`"},
}}

var appFiltersColumns = &Columns{dialect: dialectClickHouse, byKey: map[string]column{
	versionName.Name:        {expr: "tupleElement(app_version, 1)"},
	versionCode.Name:        {expr: "tupleElement(app_version, 2)"},
	patchVersion.Name:       {expr: "patch_version"},
	patchID.Name:            {expr: "patch_id", kind: columnUUID},
	osName.Name:             {expr: "tupleElement(os_version, 1)"},
	osVersion.Name:          {expr: "tupleElement(os_version, 2)"},
	deviceName.Name:         {expr: "device_name"},
	deviceManufacturer.Name: {expr: "device_manufacturer"},
	locale.Name:             {expr: "device_locale"},
	networkType.Name:        {expr: "network_type"},
	networkGeneration.Name:  {expr: "network_generation"},
	networkProvider.Name:    {expr: "network_provider"},
	country.Name:            {expr: "country_code"},
}}

// app_filters keeps one row per attribute combination per month, so values
// seen in the same month order alphabetically.
var networkFixedKeyValues = valueSource{
	table:       "app_filters",
	columns:     appFiltersColumns,
	recencyExpr: "max(end_of_month)",
}

// NetworkMetricsColumns rebinds the network keys onto the http_metrics
// rollup, where a bucket matches when any request in it did.
var NetworkMetricsColumns = &Columns{dialect: dialectClickHouse, byKey: map[string]column{
	versionName.Name:        {expr: "arrayMap(version -> tupleElement(version, 1), app_versions)", kind: columnTextArray},
	versionCode.Name:        {expr: "arrayMap(version -> tupleElement(version, 2), app_versions)", kind: columnTextArray},
	patchVersion.Name:       {expr: "patch_versions", kind: columnTextArray},
	patchID.Name:            {expr: "patch_ids", kind: columnUUIDArray},
	httpMethod.Name:         {expr: "arrayMap(method -> lower(method), methods)", kind: columnTextArray},
	osName.Name:             {expr: "arrayMap(version -> tupleElement(version, 1), os_versions)", kind: columnTextArray},
	osVersion.Name:          {expr: "arrayMap(version -> tupleElement(version, 2), os_versions)", kind: columnTextArray},
	deviceName.Name:         {expr: "device_names", kind: columnTextArray},
	deviceManufacturer.Name: {expr: "device_manufacturers", kind: columnTextArray},
	locale.Name:             {expr: "device_locales", kind: columnTextArray},
	networkType.Name:        {expr: "network_types", kind: columnTextArray},
	networkGeneration.Name:  {expr: "network_generations", kind: columnTextArray},
	networkProvider.Name:    {expr: "network_providers", kind: columnTextArray},
	country.Name:            {expr: "`inet.country_code`", kind: columnTextArray},
}}
