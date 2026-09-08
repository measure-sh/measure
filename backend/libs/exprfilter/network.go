package exprfilter

var NetworkEntity = Entity{
	Name:                  "network",
	Keys:                  networkKeys,
	BindKey:               bindKeysToColumns(httpEventsColumns, networkKeyBindingOverrides),
	SuggestFixedKeyValues: suggestFixedKeyValuesFromClickHouse(networkFixedKeyValues),
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

var (
	httpEventsColumns = map[string]string{
		versionName.Name:        "tupleElement(`attribute.app_version`, 1)",
		versionCode.Name:        "tupleElement(`attribute.app_version`, 2)",
		patchVersion.Name:       "`attribute.patch_version`",
		patchID.Name:            "`attribute.patch_id`",
		httpMethod.Name:         "lower(method)",
		osName.Name:             "tupleElement(`attribute.os_version`, 1)",
		osVersion.Name:          "tupleElement(`attribute.os_version`, 2)",
		deviceName.Name:         "`attribute.device_name`",
		deviceManufacturer.Name: "`attribute.device_manufacturer`",
		locale.Name:             "`attribute.device_locale`",
		networkType.Name:        "`attribute.network_type`",
		networkGeneration.Name:  "`attribute.network_generation`",
		networkProvider.Name:    "`attribute.network_provider`",
		country.Name:            "`inet.country_code`",
	}

	networkFilterColumns = map[string]string{
		versionName.Name:        "tupleElement(app_version, 1)",
		versionCode.Name:        "tupleElement(app_version, 2)",
		patchVersion.Name:       "patch_version",
		patchID.Name:            "patch_id",
		osName.Name:             "tupleElement(os_version, 1)",
		osVersion.Name:          "tupleElement(os_version, 2)",
		deviceName.Name:         "device_name",
		deviceManufacturer.Name: "device_manufacturer",
		locale.Name:             "device_locale",
		networkType.Name:        "network_type",
		networkGeneration.Name:  "network_generation",
		networkProvider.Name:    "network_provider",
		country.Name:            "country_code",
	}

	httpMetricsColumns = map[string]string{
		versionName.Name:        "arrayMap(version -> tupleElement(version, 1), app_versions)",
		versionCode.Name:        "arrayMap(version -> tupleElement(version, 2), app_versions)",
		patchVersion.Name:       "patch_versions",
		patchID.Name:            "patch_ids",
		httpMethod.Name:         "arrayMap(method -> lower(method), methods)",
		osName.Name:             "arrayMap(version -> tupleElement(version, 1), os_versions)",
		osVersion.Name:          "arrayMap(version -> tupleElement(version, 2), os_versions)",
		deviceName.Name:         "device_names",
		deviceManufacturer.Name: "device_manufacturers",
		locale.Name:             "device_locales",
		networkType.Name:        "network_types",
		networkGeneration.Name:  "network_generations",
		networkProvider.Name:    "network_providers",
		country.Name:            "`inet.country_code`",
	}
)

var networkKeyBindingOverrides = map[string]columnKeyBinding{
	patchID.Name: bindUUIDKey,
}

// app_filters keeps one row per attribute combination per month, so values
// seen in the same month order alphabetically.
var networkFixedKeyValues = fixedKeyValueSource{
	table:       "app_filters",
	columns:     networkFilterColumns,
	recencyExpr: "max(end_of_month)",
}

var httpMetricsKeyBindingOverrides = map[string]columnKeyBinding{
	versionName.Name:        bindArrayKey,
	versionCode.Name:        bindArrayKey,
	patchVersion.Name:       bindArrayKey,
	patchID.Name:            bindUUIDArrayKey,
	httpMethod.Name:         bindArrayKey,
	osName.Name:             bindArrayKey,
	osVersion.Name:          bindArrayKey,
	deviceName.Name:         bindArrayKey,
	deviceManufacturer.Name: bindArrayKey,
	locale.Name:             bindArrayKey,
	networkType.Name:        bindArrayKey,
	networkGeneration.Name:  bindArrayKey,
	networkProvider.Name:    bindArrayKey,
	country.Name:            bindArrayKey,
}

// NetworkMetricsKeyBindings rebinds the network keys onto the http_metrics
// rollup, where a bucket matches when any request in it did.
var NetworkMetricsKeyBindings = bindingForEachKey(networkKeys, bindKeysToColumns(httpMetricsColumns, httpMetricsKeyBindingOverrides))
