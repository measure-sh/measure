package filter

// AppHealthEntity filters the app overview: the metric cards and the health
// plot. Its rows come from the app_metrics rollup, whose only dimension
// besides team, app and time is the app version, so the entity offers the
// version keys and nothing else.
var AppHealthEntity = Entity{
	Name:         "app_health",
	Keys:         appHealthKeys,
	Columns:      appHealthMetricsColumns,
	ValueSources: []valueSource{appHealthAppFiltersValues},
}

var appHealthKeys = []Key{
	versionName,
	versionCode,
}

var appHealthMetricsColumns = &Columns{dialect: dialectClickHouse, byKey: map[string]column{
	versionName.Name: {expr: "tupleElement(app_version, 1)"},
	versionCode.Name: {expr: "tupleElement(app_version, 2)"},
}}

// app_filters keeps one row per attribute combination per month, so values
// seen in the same month order alphabetically.
var appHealthAppFiltersValues = valueSource{
	table:       "app_filters",
	columns:     appHealthMetricsColumns,
	recencyExpr: "max(end_of_month)",
}

// AppHealthEventsColumns rebinds the version keys onto the events table,
// which the crash and ANR counts of the health plot are read from.
var AppHealthEventsColumns = &Columns{dialect: dialectClickHouse, byKey: map[string]column{
	versionName.Name: {expr: "`attribute.app_version`"},
	versionCode.Name: {expr: "`attribute.app_build`"},
}}
