package filter

// BuildsEntity is an app's uploaded builds. Both its filtering and its
// value lists read the build_mappings rows in Postgres.
var BuildsEntity = Entity{
	Name:         "builds",
	Keys:         buildsKeys,
	Columns:      buildsColumns,
	ValueSources: []valueSource{buildsValues},
}

var buildsKeys = []Key{
	mappingType,
	versionName,
	versionCode,
	patchVersion,
	patchID,
}

// build_mappings is in Postgres and names its columns after the keys.
var buildsColumns = &Columns{
	dialect: dialectPostgres,
	byKey: map[string]column{
		versionName.Name:  {expr: "version_name"},
		versionCode.Name:  {expr: "version_code"},
		mappingType.Name:  {expr: "mapping_type"},
		patchVersion.Name: {expr: "patch_version"},
		// A regular build carries the nil uuid, so that value is what "not set"
		// compares against.
		patchID.Name: {expr: "patch_id", kind: columnUUID},
	},
}

var buildsValues = valueSource{
	table:       "build_mappings",
	columns:     buildsColumns,
	recencyExpr: "max(last_updated)",
}
