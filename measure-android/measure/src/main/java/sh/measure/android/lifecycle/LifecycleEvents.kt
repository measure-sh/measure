package sh.measure.android.lifecycle

import kotlinx.serialization.Serializable

@Serializable
internal data class ActivityLifecycleData(
    val type: String,
    val class_name: String,
    var intent: String? = null,
    val saved_instance_state: Boolean = false,
)

@Serializable
internal data class FragmentLifecycleData(
    val type: String,
    val class_name: String,
    val parent_activity: String?,
    val tag: String? = null,
)

@Serializable
internal data class ApplicationLifecycleData(
    val type: String,
)

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
