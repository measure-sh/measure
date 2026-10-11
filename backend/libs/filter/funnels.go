package filter

var FunnelsEntity = Entity{
	Name:            "funnels",
	Keys:            funnelsKeys,
	Columns:         funnelEventsColumns,
	ValueSources:    []valueSource{funnelFixedKeyValues},
	CustomKeySource: &funnelCustomKeySource,
}

var funnelsKeys = []Key{
	versionName,
	versionCode,
	patchVersion,
	patchID,
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

var funnelEventsColumns = &Columns{dialect: dialectClickHouse, byKey: map[string]column{
	versionName.Name:        {expr: "`attribute.app_version`"},
	versionCode.Name:        {expr: "`attribute.app_build`"},
	patchVersion.Name:       {expr: "`attribute.patch_version`"},
	patchID.Name:            {expr: "`attribute.patch_id`", kind: columnUUID},
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

var funnelFixedKeyValues = valueSource{
	table:       "app_filters",
	columns:     appFiltersColumns,
	recencyExpr: "max(end_of_month)",
}

// A funnel event matches on the attributes written anywhere in its session.
var funnelCustomKeySource = customKeySource{
	table:    "user_def_attrs",
	idColumn: "session_id",
}

// FunnelSpansColumns rebinds the funnel keys onto the spans table, for the
// queries that read the spans recorded by a funnel's installations.
var FunnelSpansColumns = spansTableColumns
