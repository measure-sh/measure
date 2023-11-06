package sh.measure.android.lifecycle

import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient
import kotlinx.serialization.json.Json
import sh.measure.android.events.Event
import sh.measure.android.events.EventType

@Serializable
data class ActivityLifecycleEvent(
    val type: String,
    val class_name: String,
    val intent: String? = null,
    val saved_instance_state: Boolean = false,
    @Transient val timestamp: String = "",
)

@Serializable
data class FragmentLifecycleEvent(
    val type: String,
    val class_name: String,
    val parent_activity: String?,
    val tag: String? = null,
    @Transient val timestamp: String = "",
)

@Serializable
data class ApplicationLifecycleEvent(
    val type: String,
    @Transient val timestamp: String = "",
)

object AppLifecycleType {
    const val FOREGROUND = "foreground"
    const val BACKGROUND = "background"
}

object ActivityLifecycleType {
    const val CREATED = "created"
    const val RESUMED = "resumed"
    const val PAUSED = "paused"
    const val DESTROYED = "destroyed"
}

object FragmentLifecycleType {
    const val ATTACHED = "attached"
    const val RESUMED = "resumed"
    const val PAUSED = "paused"
    const val DETACHED = "detached"
}
