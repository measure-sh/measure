package exprfilter

// MemoryEntity binds filter keys to the raw events table, for the memory
// monitoring trend chart, which needs one row per periodic reading rather
// than the one-row-per-session shape SessionsEntity queries. Unlike
// SessionsEntity, app_version/app_build and os_name/os_version are plain
// scalar columns on events, not tuples, so no tupleElement() unpacking is
// needed the way NetworkEntity needs for http_events.
//
// session_foreground_background is deliberately not offered here: it is a
// whole-session fact (did the session have any foreground/background
// activity), not a property of one reading. The trend chart's
// foreground/background split instead comes from the per-reading
// memory_usage_dynamic.foreground column, applied as a plain query
// parameter, not an exprfilter key.
var MemoryEntity = Entity{
	Name:                  "memory",
	Keys:                  memoryKeys,
	BindKey:               bindKeysToColumns(memoryEventsColumns, memoryKeyBindingOverrides),
	SuggestFixedKeyValues: suggestFixedKeyValuesFromClickHouse(networkFixedKeyValues),
}

var memoryKeys = []Key{
	versionName,
	versionCode,
	patchVersion,
	patchID,
	osName,
	osVersion,
	deviceName,
	deviceManufacturer,
	sessionRAMTier,
	locale,
	networkType,
	networkGeneration,
	networkProvider,
	country,
}

var memoryEventsColumns = map[string]string{
	versionName.Name:        "`attribute.app_version`",
	versionCode.Name:        "`attribute.app_build`",
	patchVersion.Name:       "`attribute.patch_version`",
	patchID.Name:            "`attribute.patch_id`",
	osName.Name:             "`attribute.os_name`",
	osVersion.Name:          "`attribute.os_version`",
	deviceName.Name:         "`attribute.device_name`",
	deviceManufacturer.Name: "`attribute.device_manufacturer`",
	sessionRAMTier.Name:     "",
	locale.Name:             "`attribute.device_locale`",
	networkType.Name:        "`attribute.network_type`",
	networkGeneration.Name:  "`attribute.network_generation`",
	networkProvider.Name:    "`attribute.network_provider`",
	country.Name:            "`inet.country_code`",
}

var memoryKeyBindingOverrides = map[string]columnKeyBinding{
	patchID.Name:        bindUUIDKey,
	sessionRAMTier.Name: bindEnumKeyToPredicates(ramTierEventsPredicates),
}

// ramTierEventsPredicates is ramTierPredicates rebound onto events'
// attribute.device_total_memory_kb, the per-reading device attribute,
// instead of sessions' rolled-up device_total_memory_kb.
var ramTierEventsPredicates = map[string]string{
	"0-4gb": "`attribute.device_total_memory_kb` < 3276800",
	"4gb":   "`attribute.device_total_memory_kb` >= 3276800 and `attribute.device_total_memory_kb` < 4915200",
	"6gb":   "`attribute.device_total_memory_kb` >= 4915200 and `attribute.device_total_memory_kb` < 6963200",
	"8gb":   "`attribute.device_total_memory_kb` >= 6963200 and `attribute.device_total_memory_kb` < 9437184",
	"12gb":  "`attribute.device_total_memory_kb` >= 9437184 and `attribute.device_total_memory_kb` < 14680064",
	"16gb":  "`attribute.device_total_memory_kb` >= 14680064 and `attribute.device_total_memory_kb` < 18874368",
	"16gb+": "`attribute.device_total_memory_kb` >= 18874368",
}
