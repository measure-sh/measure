package sh.measure.android.tracing

import android.app.Activity
import androidx.fragment.app.Fragment

/**
 * Centralized definitions of span names created by the Measure SDK.
 */
internal object SpanName {
    fun activityTtidSpan(activity: Activity): String {
        return "Activity TTID ${activity.javaClass.name}"
    }

    fun fragmentTtidSpan(fragment: Fragment): String {
        return "Fragment TTID ${fragment.javaClass.name}"
    }
}

/**
 * Centralized definitions of span attributes for spans created by the Measure SDK.
 */
internal object AttributeName {
    const val APP_STARTUP_FIRST_ACTIVITY = "app_startup_first_activity"
}

/**
 * Centralized definitions of checkpoint names for checkpoints created by the Measure SDK.
 */
internal object CheckpointName {
    const val FRAGMENT_ATTACHED: String = "fragment_lifecycle_attached"
    const val FRAGMENT_RESUMED: String = "fragment_lifecycle_resumed"
    const val ACTIVITY_CREATED: String = "activity_lifecycle_created"
    const val ACTIVITY_STARTED: String = "activity_lifecycle_started"
    const val ACTIVITY_RESUMED: String = "activity_lifecycle_resumed"
}
