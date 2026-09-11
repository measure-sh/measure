package filter

// AppHealthEntity filters the app overview: the metric cards and the health
// plot. Its rows come from the app_metrics rollup, whose only dimension
// besides team, app and time is the app version, so the entity offers the
// version keys and nothing else.
var AppHealthEntity = Entity{
	Name:                  "app_health",
	Keys:                  appHealthKeys,
	BindKey:               bindKeysToColumns(appHealthMetricsColumns, nil),
	SuggestFixedKeyValues: suggestFixedKeyValuesFromClickHouse(appHealthAppFiltersValues),
}

var appHealthKeys = []Key{
	versionName,
	versionCode,
}

var (
	appHealthMetricsColumns = map[string]string{
		versionName.Name: "tupleElement(app_version, 1)",
		versionCode.Name: "tupleElement(app_version, 2)",
	}

	appHealthEventsColumns = map[string]string{
		versionName.Name: "`attribute.app_version`",
		versionCode.Name: "`attribute.app_build`",
	}
)

// app_filters keeps one row per attribute combination per month, so values
// seen in the same month order alphabetically.
var appHealthAppFiltersValues = fixedKeyValueSource{
	table:       "app_filters",
	columns:     appHealthMetricsColumns,
	recencyExpr: "max(end_of_month)",
}

// AppHealthEventsKeyBindings rebinds the version keys onto the events table,
// which the crash and ANR counts of the health plot are read from.
var AppHealthEventsKeyBindings = bindingForEachKey(appHealthKeys, bindKeysToColumns(appHealthEventsColumns, nil))
