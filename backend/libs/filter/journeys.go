package filter

var JourneysEntity = Entity{
	Name:            "journeys",
	Keys:            journeysKeys,
	Columns:         journeyEventsColumns,
	ValueSources:    []valueSource{journeyFixedKeyValues},
	CustomKeySource: &journeyCustomKeySource,
}

var journeysKeys = []Key{
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

var journeyEventsColumns = &Columns{dialect: dialectClickHouse, byKey: map[string]column{
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

var journeyFixedKeyValues = valueSource{
	table:       "app_filters",
	columns:     appFiltersColumns,
	recencyExpr: "max(end_of_month)",
}

// A journey row matches on the attributes written anywhere in its session.
var journeyCustomKeySource = customKeySource{
	table:    "user_def_attrs",
	idColumn: "session_id",
}
