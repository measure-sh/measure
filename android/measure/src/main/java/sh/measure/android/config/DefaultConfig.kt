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
    const val TRACE_SAMPLING_RATE: Float = 0.1f
    const val ENABLE_SHAKE_TO_LAUNCH_BUG_REPORT: Boolean = false
    const val TRACK_ACTIVITY_LOAD_TIME: Boolean = true
    const val TRACK_FRAGMENT_LOAD_TIME: Boolean = true
    val DISALLOWED_CUSTOM_HEADERS: List<String> =
        listOf("Content-Type", "msr-req-id", "Authorization", "Content-Length")
}
