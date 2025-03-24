package sh.measure.android.tracing

/**
 * Centralized definitions of span names created by the Measure SDK.
 */
internal object SpanName {
    private const val ACTIVITY_TTID_PREFIX = "Activity TTID"
    private const val FRAGMENT_TTID_PREFIX = "Fragment TTID"

    fun activityTtidSpan(className: String, maxLength: Int): String {
        return truncateClassNameIfNeeded(ACTIVITY_TTID_PREFIX, className, maxLength)
    }

    fun fragmentTtidSpan(className: String, maxLength: Int): String {
        return truncateClassNameIfNeeded(FRAGMENT_TTID_PREFIX, className, maxLength)
    }

    /**
     * Truncates the class name to fit within the specified maximum length, including the prefix.
     * @param prefix The prefix to be included in the truncated string.
     * @param className The full class name to be truncated.
     * @param maxLength The maximum length of the resulting string.
     */
    private fun truncateClassNameIfNeeded(
        prefix: String,
        className: String,
        maxLength: Int,
    ): String {
        val fullString = "$prefix $className"
        return if (fullString.length <= maxLength) {
            fullString
        } else {
            val availableSpace = maxLength - prefix.length - 1
            val truncatedClassName = className.takeLast(availableSpace)
            "$prefix $truncatedClassName"
        }
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
