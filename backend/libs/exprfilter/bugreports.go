package exprfilter

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

var bugReportStatusCodes = map[string]uint8{
	"open":   0,
	"closed": 1,
}

var bugReportsKeyBindingOverrides = map[string]columnKeyBinding{
	bugReportStatus.Name: bindEnumKeyToCodes(bugReportStatusCodes),
	patchID.Name:         bindUUIDKey,
}

var bugReportFixedKeyValues = fixedKeyValueSource{
	table:       "bug_reports",
	columns:     bugReportsTableColumns,
	recencyExpr: "max(timestamp)",
}

// The custom keys are the user-defined attributes set on the session a
// report was filed in.
var bugReportCustomKeys = customKeyStore{
	table:      "user_def_attrs",
	idColumn:   "event_id",
	extraScope: "bug_report = true",
}
