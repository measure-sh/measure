package sh.measure.android.performance

import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient

@Serializable
data class MemoryUsage(
    val java_max_heap: Long,
    val java_total_heap: Long,
    val java_free_heap: Long,
    val total_pss: Int,
    val rss: Long?,
    val native_total_heap: Long,
    val native_free_heap: Long,
    val interval_config: Long,
    @Transient val timestamp: Long = 0L,
    @Transient val thread_name: String = ""
)

@Serializable
data class LowMemory(
    @Transient
    val timestamp: Long = 0L,
    @Transient
    val thread_name: String = ""
)

@Serializable
data class TrimMemory(
    val level: String,
    @Transient
    val timestamp: Long = 0L,
    @Transient
    val thread_name: String = ""
)