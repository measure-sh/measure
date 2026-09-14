package filter

var BugReportsEntity = Entity{
	Name:            "bug_reports",
	Keys:            bugReportsKeys,
	Columns:         bugReportsTableColumns,
	ValueSources:    []valueSource{bugReportFixedKeyValues},
	CustomKeySource: &bugReportCustomKeySource,
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

var bugReportStatusCodes = map[string]int{
	"open":   0,
	"closed": 1,
}

var bugReportsTableColumns = &Columns{dialect: dialectClickHouse, byKey: map[string]column{
	versionName.Name:          {expr: "tupleElement(app_version, 1)"},
	versionCode.Name:          {expr: "tupleElement(app_version, 2)"},
	patchVersion.Name:         {expr: "patch_version"},
	patchID.Name:              {expr: "patch_id", kind: columnUUID},
	bugReportStatus.Name:      {expr: "status", kind: columnEnumCodes, codes: bugReportStatusCodes},
	userID.Name:               {expr: "user_id"},
	bugReportDescription.Name: {expr: "description"},
	sessionID.Name:            {expr: "session_id"},
	osName.Name:               {expr: "tupleElement(os_version, 1)"},
	osVersion.Name:            {expr: "tupleElement(os_version, 2)"},
	deviceName.Name:           {expr: "device_name"},
	deviceManufacturer.Name:   {expr: "device_manufacturer"},
	locale.Name:               {expr: "device_locale"},
	networkType.Name:          {expr: "network_type"},
	networkGeneration.Name:    {expr: "network_generation"},
	networkProvider.Name:      {expr: "network_provider"},
	country.Name:              {expr: "country_code"},
}}

var bugReportFixedKeyValues = valueSource{
	table:       "bug_reports",
	columns:     bugReportsTableColumns,
	recencyExpr: "max(timestamp)",
	timeColumn:  "timestamp",
}

// The custom keys are the user-defined attributes set on the session a
// report was filed in.
var bugReportCustomKeySource = customKeySource{
	table:      "user_def_attrs",
	idColumn:   "event_id",
	extraScope: "bug_report = true",
}
