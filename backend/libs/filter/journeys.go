package filter

var JourneysEntity = Entity{
	Name:         "journeys",
	Keys:         journeysKeys,
	Columns:      journeyTableColumns,
	ValueSources: []valueSource{journeyFixedKeyValues},
}

var journeysKeys = []Key{
	versionName,
	versionCode,
	patchVersion,
	patchID,
}

var journeyTableColumns = &Columns{dialect: dialectClickHouse, byKey: map[string]column{
	versionName.Name:  {expr: "tupleElement(app_version, 1)"},
	versionCode.Name:  {expr: "tupleElement(app_version, 2)"},
	patchVersion.Name: {expr: "patch_version"},
	patchID.Name:      {expr: "patch_id", kind: columnUUID},
}}

// app_filters keeps one row per attribute combination per month, so values
// seen in the same month order alphabetically.
var journeyFixedKeyValues = valueSource{
	table:       "app_filters",
	columns:     journeyTableColumns,
	recencyExpr: "max(end_of_month)",
}

// JourneyEventsColumns rebinds the journey keys onto the events table for
// the issue lookups that read it.
var JourneyEventsColumns = &Columns{dialect: dialectClickHouse, byKey: map[string]column{
	versionName.Name:  {expr: "attribute.app_version"},
	versionCode.Name:  {expr: "attribute.app_build"},
	patchVersion.Name: {expr: "attribute.patch_version"},
	patchID.Name:      {expr: "attribute.patch_id", kind: columnUUID},
}}
