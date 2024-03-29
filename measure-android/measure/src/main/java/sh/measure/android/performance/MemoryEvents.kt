package sh.measure.android.performance

import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient

@Serializable
internal data class MemoryUsage(
    val java_max_heap: Long,
    val java_total_heap: Long,
    val java_free_heap: Long,
    val total_pss: Int,
    val rss: Long?,
    val native_total_heap: Long,
    val native_free_heap: Long,
    val interval_config: Long,
    @Transient
    val attributes: MutableMap<String, Any?> = mutableMapOf(),
    @Transient val timestamp: Long = 0L,
)

@Serializable
internal data class LowMemory(
    val java_max_heap: Long,
    val java_total_heap: Long,
    val java_free_heap: Long,
    val total_pss: Int,
    val rss: Long?,
    val native_total_heap: Long,
    val native_free_heap: Long,
    @Transient
    val attributes: MutableMap<String, Any?> = mutableMapOf(),
    @Transient
    val timestamp: Long = 0L,
)

@Serializable
internal data class TrimMemory(
    val level: String,
    @Transient
    val attributes: MutableMap<String, Any?> = mutableMapOf(),
    @Transient
    val timestamp: Long = 0L,
)
