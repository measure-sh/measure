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
