package exprfilter

// BugReportsEntity is an app's bug reports. Filtering and value lists both
// read the bug_reports table in ClickHouse, which stores every attribute as a
// flat column, and its user-defined attributes are the user_def_attrs rows
// flagged bug_report.
var BugReportsEntity = Entity{
	Name:                  "bug_reports",
	Keys:                  bugReportsKeys,
	BindKey:               bindKeysToColumns(bugReportsTableColumns, bugReportsKeyBindingOverrides),
	SuggestFixedKeyValues: suggestFixedKeyValuesFromClickHouse(bugReportFixedKeyValues),
	CustomKeys:            &bugReportCustomKeys,
}

var bugReportsKeys = []Key{
	versionName,
	versionCode,
	patchVersion,
	patchID,
	bugReportStatus,
	userID,
	bugReportDescription,
	sessionID,
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

// The column expression each bug report key compares against. The bug_reports
// table stores every attribute as a flat column and holds the app and os
// versions as (name, version) tuples.
var bugReportsTableColumns = map[string]string{
	versionName.Name:          "tupleElement(app_version, 1)",
	versionCode.Name:          "tupleElement(app_version, 2)",
	patchVersion.Name:         "patch_version",
	patchID.Name:              "patch_id",
	bugReportStatus.Name:      "status",
	userID.Name:               "user_id",
	bugReportDescription.Name: "description",
	sessionID.Name:            "session_id",
	osName.Name:               "tupleElement(os_version, 1)",
	osVersion.Name:            "tupleElement(os_version, 2)",
	deviceName.Name:           "device_name",
	deviceManufacturer.Name:   "device_manufacturer",
	locale.Name:               "device_locale",
	networkType.Name:          "network_type",
	networkGeneration.Name:    "network_generation",
	networkProvider.Name:      "network_provider",
	country.Name:              "country_code",
}

// bugReportStatusCodes maps the status names a filter carries to the integer
// codes the status column stores.
var bugReportStatusCodes = map[string]uint8{
	"open":   0,
	"closed": 1,
}

var bugReportsKeyBindingOverrides = map[string]columnKeyBinding{
	bugReportStatus.Name: bindEnumKeyToCodes(bugReportStatusCodes),
	patchID.Name:         bindUUIDKey,
}

// Fixed-key value suggestions read the bug_reports table itself
var bugReportFixedKeyValues = fixedKeyValueSource{
	table:       "bug_reports",
	columns:     bugReportsTableColumns,
	recencyExpr: "max(timestamp)",
}

// The custom keys of bug reports are the user-defined attributes an app set
// on the session a report was filed in. The user_def_attrs table holds
// attribute rows for several event kinds, with bug report rows flagged
// bug_report.
var bugReportCustomKeys = customKeyStore{
	table:      "user_def_attrs",
	idColumn:   "event_id",
	extraScope: "bug_report = true",
}
