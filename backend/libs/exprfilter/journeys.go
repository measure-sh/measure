package exprfilter

var JourneysEntity = Entity{
	Name:                  "journeys",
	Keys:                  journeysKeys,
	BindKey:               bindKeysToColumns(journeyTableColumns, journeysKeyBindingOverrides),
	SuggestFixedKeyValues: suggestFixedKeyValuesFromClickHouse(journeyFixedKeyValues),
}

var journeysKeys = []Key{
	versionName,
	versionCode,
	patchVersion,
	patchID,
}

var (
	journeyTableColumns = map[string]string{
		versionName.Name:  "tupleElement(app_version, 1)",
		versionCode.Name:  "tupleElement(app_version, 2)",
		patchVersion.Name: "patch_version",
		patchID.Name:      "patch_id",
	}

	journeyEventsColumns = map[string]string{
		versionName.Name:  "attribute.app_version",
		versionCode.Name:  "attribute.app_build",
		patchVersion.Name: "attribute.patch_version",
		patchID.Name:      "attribute.patch_id",
	}
)

var journeysKeyBindingOverrides = map[string]columnKeyBinding{
	patchID.Name: bindUUIDKey,
}

// app_filters keeps one row per attribute combination per month, so values
// seen in the same month order alphabetically.
var journeyFixedKeyValues = fixedKeyValueSource{
	table:       "app_filters",
	columns:     journeyTableColumns,
	recencyExpr: "max(end_of_month)",
}

// JourneyEventsKeyBindings rebinds the journey keys onto the events table for
// the issue lookups that read it.
var JourneyEventsKeyBindings = bindingForEachKey(journeysKeys, bindKeysToColumns(journeyEventsColumns, journeysKeyBindingOverrides))
