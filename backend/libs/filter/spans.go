package filter

import (
	"time"
)

var SpansEntity = Entity{
	Name:            "spans",
	Keys:            spansKeys,
	Columns:         spansTableColumns,
	ValueSources:    []valueSource{spanFixedKeyValues},
	CustomKeySource: &spanCustomKeySource,
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

var spanStatusCodes = map[string]int{
	"unset": 0,
	"ok":    1,
	"error": 2,
}

var spansTableColumns = &Columns{dialect: dialectClickHouse, byKey: map[string]column{
	versionName.Name:        {expr: "tupleElement(attribute.app_version, 1)"},
	versionCode.Name:        {expr: "tupleElement(attribute.app_version, 2)"},
	patchVersion.Name:       {expr: "attribute.patch_version"},
	patchID.Name:            {expr: "attribute.patch_id", kind: columnUUID},
	spanStatus.Name:         {expr: "status", kind: columnEnumCodes, codes: spanStatusCodes},
	osName.Name:             {expr: "tupleElement(attribute.os_version, 1)"},
	osVersion.Name:          {expr: "tupleElement(attribute.os_version, 2)"},
	deviceName.Name:         {expr: "attribute.device_name"},
	deviceManufacturer.Name: {expr: "attribute.device_manufacturer"},
	locale.Name:             {expr: "attribute.device_locale"},
	networkType.Name:        {expr: "attribute.network_type"},
	networkGeneration.Name:  {expr: "attribute.network_generation"},
	networkProvider.Name:    {expr: "attribute.network_provider"},
	country.Name:            {expr: "attribute.country_code"},
}}

var spanFilterColumns = &Columns{dialect: dialectClickHouse, byKey: map[string]column{
	versionName.Name:        {expr: "tupleElement(app_version, 1)"},
	versionCode.Name:        {expr: "tupleElement(app_version, 2)"},
	patchVersion.Name:       {expr: "patch_version"},
	patchID.Name:            {expr: "patch_id", kind: columnUUID},
	osName.Name:             {expr: "tupleElement(os_version, 1)"},
	osVersion.Name:          {expr: "tupleElement(os_version, 2)"},
	deviceName.Name:         {expr: "device_name"},
	deviceManufacturer.Name: {expr: "device_manufacturer"},
	locale.Name:             {expr: "device_locale"},
	networkType.Name:        {expr: "network_type"},
	networkGeneration.Name:  {expr: "network_generation"},
	networkProvider.Name:    {expr: "network_provider"},
	country.Name:            {expr: "country_code"},
}}

// span_filters keeps one row per attribute combination per month, so values
// seen in the same month order alphabetically.
var spanFixedKeyValues = valueSource{
	table:       "span_filters",
	columns:     spanFilterColumns,
	recencyExpr: "max(end_of_month)",
}

var spanCustomKeySource = customKeySource{
	table:    "span_user_def_attrs",
	idColumn: "span_id",
}

// SpanMetricsColumns rebinds the fixed spans keys onto the span_metrics
// rollup for the queries that aggregate over it.
var SpanMetricsColumns = &Columns{dialect: dialectClickHouse, byKey: map[string]column{
	versionName.Name:        {expr: "tupleElement(app_version, 1)"},
	versionCode.Name:        {expr: "tupleElement(app_version, 2)"},
	patchVersion.Name:       {expr: "patch_version"},
	patchID.Name:            {expr: "patch_id", kind: columnUUID},
	spanStatus.Name:         {expr: "status", kind: columnEnumCodes, codes: spanStatusCodes},
	osName.Name:             {expr: "tupleElement(os_version, 1)"},
	osVersion.Name:          {expr: "tupleElement(os_version, 2)"},
	deviceName.Name:         {expr: "device_name"},
	deviceManufacturer.Name: {expr: "device_manufacturer"},
	locale.Name:             {expr: "device_locale"},
	networkType.Name:        {expr: "network_type"},
	networkGeneration.Name:  {expr: "network_generation"},
	networkProvider.Name:    {expr: "network_provider"},
	country.Name:            {expr: "country_code"},
}}
