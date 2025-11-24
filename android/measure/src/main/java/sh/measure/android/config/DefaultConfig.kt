package sh.measure.android.config

internal object DefaultConfig {
    const val ENABLE_LOGGING: Boolean = false
    const val TRACK_SCREENSHOT_ON_CRASH: Boolean = false
    val SCREENSHOT_MASK_LEVEL: ScreenshotMaskLevel = ScreenshotMaskLevel.AllTextAndMedia
    const val TRACK_HTTP_HEADERS: Boolean = false
    const val TRACK_HTTP_BODY: Boolean = false
    val HTTP_HEADERS_BLOCKLIST: List<String> = emptyList()
    val HTTP_URL_BLOCKLIST: List<String> = emptyList()
    val HTTP_URL_ALLOWLIST: List<String> = emptyList()
    const val TRACK_ACTIVITY_INTENT_DATA: Boolean = false
    const val SESSION_SAMPLING_RATE: Float = 0f
    const val AUTO_START: Boolean = true
    const val TRACE_SAMPLING_RATE: Float = 0.0001f // 0.01%
    const val MAX_ESTIMATED_DISK_USAGE_IN_MB: Int = 50 // 50MB
    const val COLD_LAUNCH_SAMPLING_RATE: Float = 0.01f // 1%
    const val WARM_LAUNCH_SAMPLING_RATE: Float = 0.01f // 1%
    const val HOT_LAUNCH_SAMPLING_RATE: Float = 0.01f // 1%
    const val JOURNEY_EVENTS_SAMPLING_RATE: Float = 0f
    val DISALLOWED_CUSTOM_HEADERS: List<String> =
        listOf("Content-Type", "msr-req-id", "Authorization", "Content-Length")
}
