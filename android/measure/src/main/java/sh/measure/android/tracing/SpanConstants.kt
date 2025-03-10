package sh.measure.android.tracing

import android.app.Activity

/**
 * Centralized definitions of span names created by the Measure SDK.
 */
internal object SpanName {
    fun activityTtidSpan(activity: Activity): String {
        return "Activity TTID ${activity.javaClass.name}"
    }
}

/**
 * Centralized definitions of span attributes for spans created by the Measure SDK.
 */
internal object SpanAttribute {
    const val APP_LAUNCH_TYPE_KEY = "app_launch_type"
    const val APP_LAUNCH_TYPE_COLD = "app_launch_type_cold"
}

/**
 * Centralized definitions of checkpoint names for checkpoints created by the Measure SDK.
 */
internal object CheckpointName {
    const val ACTIVITY_CREATED: String = "activity_lifecycle_created"
    const val ACTIVITY_STARTED: String = "activity_lifecycle_started"
    const val ACTIVITY_RESUMED: String = "activity_lifecycle_resumed"
}
