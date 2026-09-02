package exprfilter

import (
	"time"
)

var SpansEntity = Entity{
	Name:                  "spans",
	Keys:                  spansKeys,
	BindKey:               bindKeysToColumns(spansTableColumns, spansKeyBindingOverrides),
	SuggestFixedKeyValues: suggestFixedKeyValuesFromClickHouse(spanFixedKeyValues),
	CustomKeys:            &spanCustomKeys,
	// span_metrics groups spans into 15-minute buckets by start time. A query
	// can therefore include spans whose bucket extends past the range end.
	MaxTimeBucketWidth: 15 * time.Minute,
}

var spansKeys = []Key{
	versionName,
	versionCode,
	patchVersion,
	patchID,
	spanStatus,
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
	spansTableColumns = map[string]string{
		versionName.Name:        "tupleElement(attribute.app_version, 1)",
		versionCode.Name:        "tupleElement(attribute.app_version, 2)",
		patchVersion.Name:       "attribute.patch_version",
		patchID.Name:            "attribute.patch_id",
		spanStatus.Name:         "status",
		osName.Name:             "tupleElement(attribute.os_version, 1)",
		osVersion.Name:          "tupleElement(attribute.os_version, 2)",
		deviceName.Name:         "attribute.device_name",
		deviceManufacturer.Name: "attribute.device_manufacturer",
		locale.Name:             "attribute.device_locale",
		networkType.Name:        "attribute.network_type",
		networkGeneration.Name:  "attribute.network_generation",
		networkProvider.Name:    "attribute.network_provider",
		country.Name:            "attribute.country_code",
	}

	spanFilterColumns = map[string]string{
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

	spanMetricsTableColumns = map[string]string{
		versionName.Name:        "tupleElement(app_version, 1)",
		versionCode.Name:        "tupleElement(app_version, 2)",
		patchVersion.Name:       "patch_version",
		patchID.Name:            "patch_id",
		spanStatus.Name:         "status",
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
)

var spanStatusCodes = map[string]int8{
	"unset": 0,
	"ok":    1,
	"error": 2,
}

var spansKeyBindingOverrides = map[string]columnKeyBinding{
	spanStatus.Name: bindEnumKeyToCodes(spanStatusCodes),
	patchID.Name:    bindUUIDKey,
}

// span_filters keeps one row per attribute combination per month, so values
// seen in the same month order alphabetically.
var spanFixedKeyValues = fixedKeyValueSource{
	table:       "span_filters",
	columns:     spanFilterColumns,
	recencyExpr: "max(end_of_month)",
}

var spanCustomKeys = customKeyStore{
	table:    "span_user_def_attrs",
	idColumn: "span_id",
}

// SpanMetricsKeyBindings rebinds the fixed spans keys onto the span_metrics
// rollup for the queries that aggregate over it.
var SpanMetricsKeyBindings = bindingForEachKey(spansKeys, bindKeysToColumns(spanMetricsTableColumns, spansKeyBindingOverrides))
