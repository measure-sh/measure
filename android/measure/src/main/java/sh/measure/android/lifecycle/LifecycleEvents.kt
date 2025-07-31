package sh.measure.android.lifecycle

import android.annotation.SuppressLint
import kotlinx.serialization.Serializable
import sh.measure.android.cel.CelFieldAccessor

@SuppressLint("UnsafeOptInUsageError")
@Serializable
internal data class ActivityLifecycleData(
    val type: String,
    val class_name: String,
    var intent: String? = null,
    val saved_instance_state: Boolean = false,
) : CelFieldAccessor {
    override fun getField(fieldName: String): Any? {
        return when (fieldName) {
            "type" -> type
            "class_name" -> class_name
            "intent" -> intent
            "saved_instance_state" -> saved_instance_state
            else -> null
        }
    }
}

@SuppressLint("UnsafeOptInUsageError")
@Serializable
internal data class FragmentLifecycleData(
    val type: String,
    val class_name: String,
    val parent_activity: String?,
    val parent_fragment: String?,
    val tag: String? = null,
): CelFieldAccessor {
    override fun getField(fieldName: String): Any? {
        return when (fieldName) {
            "type" -> type
            "class_name" -> class_name
            "parent_activity" -> parent_activity
            "parent_fragment" -> parent_fragment
            "tag" -> tag
            else -> null
        }
    }
}

@SuppressLint("UnsafeOptInUsageError")
@Serializable
internal data class ApplicationLifecycleData(
    val type: String,
) : CelFieldAccessor {
    override fun getField(fieldName: String): Any? {
        return when (fieldName) {
            "type" -> type
            else -> null
        }
    }
}

internal object AppLifecycleType {
    const val FOREGROUND = "foreground"
    const val BACKGROUND = "background"
}

internal object ActivityLifecycleType {
    const val CREATED = "created"
    const val RESUMED = "resumed"
    const val PAUSED = "paused"
    const val DESTROYED = "destroyed"
}

internal object FragmentLifecycleType {
    const val ATTACHED = "attached"
    const val RESUMED = "resumed"
    const val PAUSED = "paused"
    const val DETACHED = "detached"
}
