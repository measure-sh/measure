package sh.measure.android.performance

import kotlinx.serialization.Serializable

@Serializable
internal data class MemoryUsageData(
    val java_max_heap: Long,
    val java_total_heap: Long,
    val java_free_heap: Long,
    val total_pss: Int,
    val rss: Long?,
    val native_total_heap: Long,
    val native_free_heap: Long,
    val interval: Long,
)

@Serializable
internal data class TrimMemoryData(
    val level: String,
)

/**
 * Android's Dynamic Memory Usage vital: anon_rss + swap from
 * /proc/self/status. anon_rss and swap are null, never zero, when a reading
 * was unavailable. process_state is one of [ProcessState]'s four values.
 */
@Serializable
internal data class MemoryUsageDynamicData(
    val anon_rss: Long?,
    val swap: Long?,
    val process_state: String,
    val interval: Long,
)
