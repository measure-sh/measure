package filter

import (
	"fmt"
	"slices"
	"strings"
)

const memoryKBPerGB uint64 = 1024 * 1024

var deviceMemoryRanges = []struct {
	name    string
	lowerKB uint64
	upperKB uint64
}{
	{"0-4gb", 0, 5 * memoryKBPerGB},
	{"5-6gb", 5 * memoryKBPerGB, 7 * memoryKBPerGB},
	{"7-8gb", 7 * memoryKBPerGB, 9 * memoryKBPerGB},
	{"9-12gb", 9 * memoryKBPerGB, 13 * memoryKBPerGB},
	{"13-16gb", 13 * memoryKBPerGB, 17 * memoryKBPerGB},
	{"17-31gb", 17 * memoryKBPerGB, 32 * memoryKBPerGB},
	{"32gb+", 32 * memoryKBPerGB, 0},
}

func memoryRangePredicates(column string) map[string]string {
	predicates := make(map[string]string, len(deviceMemoryRanges))
	for _, r := range deviceMemoryRanges {
		if r.upperKB == 0 {
			predicates[r.name] = fmt.Sprintf("%s >= %d", column, r.lowerKB)
		} else if r.lowerKB == 0 {
			predicates[r.name] = fmt.Sprintf("%s > 0 and %s < %d", column, column, r.upperKB)
		} else {
			predicates[r.name] = fmt.Sprintf("%s >= %d and %s < %d", column, r.lowerKB, column, r.upperKB)
		}
	}
	predicates["unknown"] = fmt.Sprintf("%s = 0", column)
	return predicates
}

var SessionsEntity = Entity{
	Name:            "sessions",
	Keys:            sessionsKeys,
	Columns:         sessionsTableColumns,
	ValueSources:    []valueSource{sessionsAppFiltersValues, sessionsTableValues},
	CustomKeySource: &sessionCustomKeySource,
}

var sessionsKeys = []Key{
	sessionEvents,
	sessionForegroundBackground,
	deviceTotalMemory,
	sessionCustomEvent,
	sessionLog,
	sessionScreen,
	sessionErrorText,
	sessionID,
	versionName,
	versionCode,
	patchVersion,
	patchID,
	userID,
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

var sessionsAppFiltersValues = valueSource{
	table:       "app_filters",
	columns:     appFiltersColumns,
	recencyExpr: "max(end_of_month)",
}

// app_filters does not keep these, so they are read from the session's own arrays.
var sessionsTableValues = valueSource{
	table: "sessions",
	columns: &Columns{dialect: dialectClickHouse, byKey: map[string]column{
		userID.Name:             sessionsTableColumns.byKey[userID.Name],
		sessionCustomEvent.Name: sessionsTableColumns.byKey[sessionCustomEvent.Name],
		sessionScreen.Name:      sessionsTableColumns.byKey[sessionScreen.Name],
	}},
	recencyExpr: "max(first_event_timestamp)",
	timeColumn:  "first_event_timestamp",
}

// Every attribute written in the session counts, whichever event or bug report
// carried it.
var sessionCustomKeySource = customKeySource{
	table:    "user_def_attrs",
	idColumn: "session_id",
}

var (
	sessionsTableColumns      = sessionsColumnsWith(func(_, column string) string { return column })
	SessionsAggregatedColumns = sessionsColumnsWith(func(aggregate, column string) string { return aggregate + "(" + column + ")" })
)

// The sessions table holds several rows per session, so a per-session
// column reads differently in a WHERE over raw rows and in a HAVING after
// grouping by session. wrap picks the form, so every key's expression is
// written once for both.
func sessionsColumnsWith(wrap func(aggregate, column string) string) *Columns {
	eventTypeCount := func(eventType string) string {
		return wrap("sumMap", "event_type_counts") + "['" + eventType + "']"
	}
	uniqueArray := func(column string) string {
		return wrap("groupUniqArrayArray", column)
	}

	gestureEventCounts := []string{
		eventTypeCount("gesture_click"),
		eventTypeCount("gesture_long_click"),
		eventTypeCount("gesture_scroll"),
	}
	foregroundEventCounts := slices.Concat(
		[]string{wrap("sum", "foreground_count")},
		gestureEventCounts,
		[]string{
			eventTypeCount("lifecycle_activity"),
			eventTypeCount("lifecycle_view_controller"),
			eventTypeCount("screen_view"),
		},
	)

	return &Columns{dialect: dialectClickHouse, byKey: map[string]column{
		versionName.Name:  {expr: "tupleElement(app_version, 1)"},
		versionCode.Name:  {expr: "tupleElement(app_version, 2)"},
		patchVersion.Name: {expr: wrap("max", "patch_version")},
		patchID.Name:      {expr: wrap("max", "patch_id"), kind: columnUUID},
		sessionEvents.Name: {kind: columnPredicates, predicates: map[string]string{
			"fatal_error":      wrap("sum", "fatal_exception_count") + " >= 1",
			"unhandled_error":  wrap("sum", "unhandled_exception_count") + " >= 1",
			"handled_error":    wrap("sum", "handled_exception_count") + " >= 1",
			"anr":              wrap("sum", "anr_count") + " >= 1",
			"bug_report":       wrap("sum", "bug_report_count") + " >= 1",
			"user_interaction": anyCountPresent(gestureEventCounts),
		}},
		sessionForegroundBackground.Name: {kind: columnPredicates, predicates: map[string]string{
			"foreground": anyCountPresent(foregroundEventCounts),
			"background": wrap("sum", "background_count") + " >= 1",
		}},
		deviceTotalMemory.Name:  {kind: columnPredicates, predicates: memoryRangePredicates(wrap("max", "device_total_memory"))},
		sessionCustomEvent.Name: {expr: uniqueArray("unique_custom_type_names"), kind: columnTextArray},
		sessionLog.Name: {expr: arrayConcat(
			uniqueArray("unique_logs"),
			uniqueArray("unique_strings"),
		), kind: columnTextArray},
		sessionErrorText.Name: {expr: arrayConcat(
			flattenExceptionText(uniqueArray("unique_fatal_exceptions")),
			flattenExceptionText(uniqueArray("unique_unhandled_exceptions")),
			flattenExceptionText(uniqueArray("unique_handled_exceptions")),
			flattenExceptionText(uniqueArray("unique_anrs")),
			errorCodeText(uniqueArray("unique_errors")),
		), kind: columnTextArray},
		sessionScreen.Name: {expr: arrayConcat(
			uniqueArray("unique_screen_view_names"),
			uniqueArray("unique_view_classnames"),
			uniqueArray("unique_subview_classnames"),
			uniqueArray("unique_view_controller_classnames"),
		), kind: columnTextArray},
		sessionID.Name:          {expr: "session_id"},
		userID.Name:             {expr: uniqueArray("user_ids"), kind: columnTextArray},
		osName.Name:             {expr: "tupleElement(os_version, 1)"},
		osVersion.Name:          {expr: "tupleElement(os_version, 2)"},
		deviceName.Name:         {expr: "device_name"},
		deviceManufacturer.Name: {expr: "device_manufacturer"},
		locale.Name:             {expr: uniqueArray("device_locales"), kind: columnTextArray},
		networkType.Name:        {expr: uniqueArray("network_types"), kind: columnTextArray},
		networkGeneration.Name:  {expr: uniqueArray("network_generations"), kind: columnTextArray},
		networkProvider.Name:    {expr: uniqueArray("network_providers"), kind: columnTextArray},
		country.Name:            {expr: uniqueArray("country_codes"), kind: columnTextArray},
	}}
}

func arrayConcat(arrays ...string) string {
	return "arrayConcat(" + strings.Join(arrays, ", ") + ")"
}

// unique_errors holds one JSON object per error. Searching that text as it is
// would match the JSON's own keys and quotes, so a search for "code" would hit
// every error; only the values are searched.
func errorCodeText(column string) string {
	return "arrayFlatten(arrayMap(error -> [JSONExtractString(error, 'code'), if(JSONType(error, 'num_code') = 'Null', '', JSONExtractRaw(error, 'num_code')), JSONExtractRaw(error, 'meta')], " + column + "))"
}

func flattenExceptionText(column string) string {
	fields := []string{"type", "message", "file_name", "class_name", "method_name"}
	elements := make([]string, len(fields))
	for i, field := range fields {
		elements[i] = "e." + field
	}
	return "arrayFlatten(arrayMap(e -> [" + strings.Join(elements, ", ") + "], " + column + "))"
}

func anyCountPresent(counts []string) string {
	exprs := make([]string, len(counts))
	for i, count := range counts {
		exprs[i] = count + " >= 1"
	}
	return "(" + strings.Join(exprs, " or ") + ")"
}
