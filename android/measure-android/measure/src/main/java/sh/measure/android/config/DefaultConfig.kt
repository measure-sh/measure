package sh.measure.android.config

import sh.measure.android.events.EventType

internal object DefaultConfig {
    const val ENABLE_LOGGING: Boolean = false
    const val TRACK_ACTIVITY_INTENT_DATA: Boolean = false
    const val AUTO_START: Boolean = true
    const val MAX_ESTIMATED_DISK_USAGE_IN_MB: Int = 50 // 50MB
    val DISALLOWED_CUSTOM_HEADERS: List<String> =
        listOf("Content-Type", "msr-req-id", "Authorization", "Content-Length")
    const val ENABLE_FULL_COLLECTION_MODE: Boolean = false
    const val ENABLE_DIAGNOSTIC_MODE: Boolean = false

    const val MAX_EVENTS_IN_BATCH: Int = 10000
    const val ERROR_REPLAY_DURATION_SECONDS: Int = 300
    const val ANR_TIMELINE_DURATION_SECONDS: Int = 300
    const val BUG_REPORT_TIMELINE_DURATION_SECONDS: Int = 300
    const val TRACE_SAMPLING_RATE: Float = 100f
    const val TTID_TRACE_ENABLED: Boolean = true
    val SCREENSHOT_MASK_LEVEL: ScreenshotMaskLevel = ScreenshotMaskLevel.AllTextAndMedia
    const val LOG_AUTOCOLLECT_ENABLED: Boolean = false
    const val LOG_MIN_SEVERITY: Int = 16
    val LOG_IGNORE_PATTERNS: List<String> = emptyList()
    const val CPU_USAGE_INTERVAL: Long = 5
    const val MEMORY_USAGE_INTERVAL: Long = 5
    const val MEMORY_USAGE_BACKGROUND_INTERVAL: Long = 10
    const val MEMORY_USAGE_SESSION_SAMPLING_RATE: Float = 0.01f
    const val ERROR_FATAL_SCREENSHOT_ENABLED: Boolean = true
    const val ERROR_FATAL_REPLAY_ENABLED: Boolean = true
    const val ERROR_UNHANDLED_REPLAY_ENABLED: Boolean = false
    const val ERROR_HANDLED_REPLAY_ENABLED: Boolean = false
    const val ERROR_FATAL_SAMPLING_RATE: Float = 100f
    const val ERROR_UNHANDLED_SAMPLING_RATE: Float = 100f
    const val ERROR_HANDLED_SAMPLING_RATE: Float = 0f
    const val ANR_TAKE_SCREENSHOT: Boolean = true
    const val LAUNCH_SAMPLING_RATE: Float = 100f
    const val GESTURE_CLICK_TAKE_SNAPSHOT: Boolean = true
    const val HTTP_SAMPLING_RATE: Float = 100f
    val HTTP_DISABLE_EVENT_FOR_URLS: List<String> = emptyList()
    val HTTP_TRACK_REQUEST_FOR_URLS: List<String> = emptyList()
    val HTTP_TRACK_RESPONSE_FOR_URLS: List<String> = emptyList()
    val HTTP_BLOCKED_HEADERS: List<String> = listOf(
        "Authorization",
        "Cookie",
        "Set-Cookie",
        "Proxy-Authorization",
        "WWW-Authenticate",
        "X-Api-Key",
    )
    const val PROFILE_SAMPLING_RATE: Float = 100f
    const val ANALYTICS_SAMPLING_RATE: Float = 100f
    val ANALYTICS_EVENTS = listOf(
        EventType.CUSTOM,
        EventType.LIFECYCLE_ACTIVITY,
        EventType.LIFECYCLE_FRAGMENT,
        EventType.SCREEN_VIEW,
    )
}
