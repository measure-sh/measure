package filter

var ProfilesEntity = Entity{
	Name:         "profiles",
	Keys:         profilesKeys,
	Columns:      profileEventsColumns,
	ValueSources: []valueSource{profilesAppFiltersValues, profileEventsValues},
}

var profilesKeys = []Key{
	profileTrigger,
	versionName,
	versionCode,
	patchVersion,
	patchID,
	userID,
	osVersion,
	deviceName,
	deviceManufacturer,
}

var profileEventsColumns = &Columns{dialect: dialectClickHouse, byKey: map[string]column{
	profileTrigger.Name:     {expr: "`profile.trigger`"},
	versionName.Name:        {expr: "`attribute.app_version`"},
	versionCode.Name:        {expr: "`attribute.app_build`"},
	patchVersion.Name:       {expr: "`attribute.patch_version`"},
	patchID.Name:            {expr: "`attribute.patch_id`", kind: columnUUID},
	userID.Name:             {expr: "`attribute.user_id`"},
	osVersion.Name:          {expr: "`attribute.os_version`"},
	deviceName.Name:         {expr: "`attribute.device_name`"},
	deviceManufacturer.Name: {expr: "`attribute.device_manufacturer`"},
}}

var profilesAppFiltersValues = valueSource{
	table:       "app_filters",
	columns:     appFiltersColumns,
	recencyExpr: "max(end_of_month)",
}

var profileEventsValues = valueSource{
	table: "events",
	columns: &Columns{dialect: dialectClickHouse, byKey: map[string]column{
		profileTrigger.Name: {expr: "`profile.trigger`"},
		userID.Name:         {expr: "`attribute.user_id`"},
	}},
	recencyExpr: "max(timestamp)",
	timeColumn:  "timestamp",
	extraScope:  "type = 'profile'",
}
