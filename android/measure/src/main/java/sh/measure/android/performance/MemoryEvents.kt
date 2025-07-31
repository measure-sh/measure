package sh.measure.android.performance

import android.annotation.SuppressLint
import kotlinx.serialization.Serializable
import sh.measure.android.cel.CelFieldAccessor

@SuppressLint("UnsafeOptInUsageError")
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
): CelFieldAccessor {
    override fun getField(fieldName: String): Any? {
        return when (fieldName) {
            "java_max_heap" -> java_max_heap
            "java_total_heap" -> java_total_heap
            "java_free_heap" -> java_free_heap
            "total_pss" -> total_pss
            "rss" -> rss
            "native_total_heap" -> native_total_heap
            "native_free_heap" -> native_free_heap
            "interval" -> interval
            else -> null
        }
    }
}

@Serializable
internal data class TrimMemoryData(
    val level: String,
)
