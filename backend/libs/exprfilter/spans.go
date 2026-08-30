package exprfilter

import (
	"time"
)

// SpansEntity is an app's performance trace spans. Both its filtering and its
// value lists read the spans table in ClickHouse. The span_metrics rollup
// stores the same fields as flat columns, which SpanMetricsKeyBindings maps
// for queries that aggregate over it.
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

// The column expression each spans key compares against, per table. The spans
// table nests device and network attributes in attribute-prefixed columns and
// the span_metrics rollup stores the same fields as flat columns; both hold
// the app and os versions as (name, version) tuples.
var (
	spansTableColumns = map[string]string{
		versionName.Name:        "tupleElement(attribute.app_version, 1)",
		versionCode.Name:        "tupleElement(attribute.app_version, 2)",
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

// spanStatusCodes maps the status names a filter carries to the integer codes
// the status column stores.
var spanStatusCodes = map[string]int8{
	"unset": 0,
	"ok":    1,
	"error": 2,
}

var spansKeyBindingOverrides = map[string]columnKeyBinding{
	spanStatus.Name: bindEnumKeyToCodes(spanStatusCodes),
}

// Fixed-key value suggestions read the span_filters rollup, which stores the
// distinct attribute combinations seen per month. Recency therefore carries
// month granularity, so values seen in the same month order alphabetically.
var spanFixedKeyValues = fixedKeyValueSource{
	table:       "span_filters",
	columns:     spanFilterColumns,
	recencyExpr: "max(end_of_month)",
}

var spanCustomKeys = customKeyStore{
	table:    "span_user_def_attrs",
	idColumn: "span_id",
}

// SpanMetricsKeyBindings maps every fixed spans key onto the flat columns of
// the span_metrics rollup, as Predicate overrides for queries that read that
// table.
func SpanMetricsKeyBindings() map[string]KeyBinding {
	binding := bindKeysToColumns(spanMetricsTableColumns, spansKeyBindingOverrides)
	overrides := make(map[string]KeyBinding, len(spansKeys))
	for _, key := range spansKeys {
		overrides[key.Name] = binding
	}
	return overrides
}
