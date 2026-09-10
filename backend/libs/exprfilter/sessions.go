package exprfilter

import (
	"slices"
	"strings"
)

var SessionsEntity = Entity{
	Name:                  "sessions",
	Keys:                  sessionsKeys,
	BindKey:               bindKeysToColumns(sessionsTableColumns, sessionsKeyBindingOverrides),
	SuggestFixedKeyValues: suggestFixedKeyValuesFromClickHouse(sessionsAppFiltersValues, sessionsTableValues),
	CustomKeys:            &sessionCustomKeys,
}

var sessionsKeys = []Key{
	versionName,
	versionCode,
	patchVersion,
	patchID,
	sessionEvents,
	sessionForegroundBackground,
	sessionRAMTier,
	sessionCustomEvent,
	sessionLog,
	sessionScreen,
	sessionErrorText,
	sessionID,
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

// The events and foreground/background keys have no column of their own, so
// their entries are empty and the overrides bind predicates instead.
var sessionsTableColumns = map[string]string{
	versionName.Name:                 "tupleElement(app_version, 1)",
	versionCode.Name:                 "tupleElement(app_version, 2)",
	patchVersion.Name:                "patch_version",
	patchID.Name:                     "patch_id",
	sessionEvents.Name:               "",
	sessionForegroundBackground.Name: "",
	sessionRAMTier.Name:              "",
	sessionCustomEvent.Name:          "unique_custom_type_names",
	sessionLog.Name:                  rawSessionColumnForms.log,
	sessionErrorText.Name:            rawSessionColumnForms.errorText,
	sessionScreen.Name:               rawSessionColumnForms.screen,
	sessionID.Name:                   "session_id",
	userID.Name:                      "user_ids",
	osName.Name:                      "tupleElement(os_version, 1)",
	osVersion.Name:                   "tupleElement(os_version, 2)",
	deviceName.Name:                  "device_name",
	deviceManufacturer.Name:          "device_manufacturer",
	locale.Name:                      "device_locales",
	networkType.Name:                 "network_types",
	networkGeneration.Name:           "network_generations",
	networkProvider.Name:             "network_providers",
	country.Name:                     "country_codes",
}

var sessionsAggregatedColumns = map[string]string{
	versionName.Name:                 "tupleElement(app_version, 1)",
	versionCode.Name:                 "tupleElement(app_version, 2)",
	patchVersion.Name:                "max(patch_version)",
	patchID.Name:                     "max(patch_id)",
	sessionEvents.Name:               "",
	sessionForegroundBackground.Name: "",
	sessionRAMTier.Name:              "",
	sessionCustomEvent.Name:          "groupUniqArrayArray(unique_custom_type_names)",
	sessionLog.Name:                  aggregatedSessionColumnForms.log,
	sessionErrorText.Name:            aggregatedSessionColumnForms.errorText,
	sessionScreen.Name:               aggregatedSessionColumnForms.screen,
	sessionID.Name:                   "session_id",
	userID.Name:                      "groupUniqArrayArray(user_ids)",
	osName.Name:                      "tupleElement(os_version, 1)",
	osVersion.Name:                   "tupleElement(os_version, 2)",
	deviceName.Name:                  "device_name",
	deviceManufacturer.Name:          "device_manufacturer",
	locale.Name:                      "groupUniqArrayArray(device_locales)",
	networkType.Name:                 "groupUniqArrayArray(network_types)",
	networkGeneration.Name:           "groupUniqArrayArray(network_generations)",
	networkProvider.Name:             "groupUniqArrayArray(network_providers)",
	country.Name:                     "groupUniqArrayArray(country_codes)",
}

var SessionsAggregatedKeyBindings = bindingForEachKey(sessionsKeys, bindKeysToColumns(sessionsAggregatedColumns, sessionsAggregatedKeyBindingOverrides))

var (
	sessionsKeyBindingOverrides           = sessionsKeyBindingOverridesFor(rawSessionColumnForms)
	sessionsAggregatedKeyBindingOverrides = sessionsKeyBindingOverridesFor(aggregatedSessionColumnForms)
)

// ramTierPredicates buckets sessions.device_total_memory_kb into Google
// Play's RAM tiers (thresholds are the tier table's MB boundaries * 1024).
// device_total_memory_kb is a plain per-session column, like
// device_manufacturer, so the same predicate form works for both the raw and
// aggregated bindings — no sum/count wrapping needed.
var ramTierPredicates = map[string]string{
	"0-4gb": "device_total_memory_kb < 3276800",
	"4gb":   "device_total_memory_kb >= 3276800 and device_total_memory_kb < 4915200",
	"6gb":   "device_total_memory_kb >= 4915200 and device_total_memory_kb < 6963200",
	"8gb":   "device_total_memory_kb >= 6963200 and device_total_memory_kb < 9437184",
	"12gb":  "device_total_memory_kb >= 9437184 and device_total_memory_kb < 14680064",
	"16gb":  "device_total_memory_kb >= 14680064 and device_total_memory_kb < 18874368",
	"16gb+": "device_total_memory_kb >= 18874368",
}

func sessionsKeyBindingOverridesFor(forms sessionColumnForms) map[string]columnKeyBinding {
	return map[string]columnKeyBinding{
		sessionEvents.Name:               bindEnumKeyToPredicates(forms.events),
		sessionForegroundBackground.Name: bindEnumKeyToPredicates(forms.foregroundBackground),
		sessionRAMTier.Name:              bindEnumKeyToPredicates(ramTierPredicates),
		sessionCustomEvent.Name:          bindArrayKey,
		sessionLog.Name:                  bindArrayKey,
		sessionErrorText.Name:            bindArrayKey,
		sessionScreen.Name:               bindArrayKey,
		patchID.Name:                     bindUUIDKey,
		userID.Name:                      bindArrayKey,
		locale.Name:                      bindArrayKey,
		networkType.Name:                 bindArrayKey,
		networkGeneration.Name:           bindArrayKey,
		networkProvider.Name:             bindArrayKey,
		country.Name:                     bindArrayKey,
	}
}

var sessionsAppFiltersValues = fixedKeyValueSource{
	table:       "app_filters",
	columns:     appFiltersColumns,
	recencyExpr: "max(end_of_month)",
}

// app_filters does not keep these, so they are read from the session's own arrays.
var sessionsTableValues = fixedKeyValueSource{
	table: "sessions",
	columns: map[string]string{
		userID.Name:             "arrayJoin(user_ids)",
		sessionCustomEvent.Name: "arrayJoin(unique_custom_type_names)",
		sessionScreen.Name:      "arrayJoin(" + rawSessionColumnForms.screen + ")",
	},
	recencyExpr: "max(first_event_timestamp)",
	timeColumn:  "first_event_timestamp",
}

// Every attribute written in the session counts, whichever event or bug report
// carried it.
var sessionCustomKeys = customKeyStore{
	table:    "user_def_attrs",
	idColumn: "session_id",
}

var (
	rawSessionColumnForms        = sessionColumnFormsWith(func(_, column string) string { return column })
	aggregatedSessionColumnForms = sessionColumnFormsWith(func(aggregate, column string) string { return aggregate + "(" + column + ")" })
)

type sessionColumnForms struct {
	events               map[string]string
	foregroundBackground map[string]string
	log                  string
	errorText            string
	screen               string
}

func sessionColumnFormsWith(wrap func(aggregate, column string) string) sessionColumnForms {
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

	return sessionColumnForms{
		events: map[string]string{
			"fatal_error":      wrap("sum", "fatal_exception_count") + " >= 1",
			"unhandled_error":  wrap("sum", "unhandled_exception_count") + " >= 1",
			"handled_error":    wrap("sum", "handled_exception_count") + " >= 1",
			"anr":              wrap("sum", "anr_count") + " >= 1",
			"bug_report":       wrap("sum", "bug_report_count") + " >= 1",
			"user_interaction": anyCountPresent(gestureEventCounts),
		},
		foregroundBackground: map[string]string{
			"foreground": anyCountPresent(foregroundEventCounts),
			"background": wrap("sum", "background_count") + " >= 1",
		},
		log: "arrayConcat(" + strings.Join([]string{
			uniqueArray("unique_logs"),
			uniqueArray("unique_strings"),
		}, ", ") + ")",
		errorText: "arrayConcat(" + strings.Join([]string{
			flattenExceptionText(uniqueArray("unique_fatal_exceptions")),
			flattenExceptionText(uniqueArray("unique_unhandled_exceptions")),
			flattenExceptionText(uniqueArray("unique_handled_exceptions")),
			flattenExceptionText(uniqueArray("unique_anrs")),
			errorCodeText(uniqueArray("unique_errors")),
		}, ", ") + ")",
		screen: "arrayConcat(" + strings.Join([]string{
			uniqueArray("unique_screen_view_names"),
			uniqueArray("unique_view_classnames"),
			uniqueArray("unique_subview_classnames"),
			uniqueArray("unique_view_controller_classnames"),
		}, ", ") + ")",
	}
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
