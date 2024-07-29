package sh.measure.android.config

import sh.measure.android.events.EventType

internal object DefaultConfig {
    const val ENABLE_LOGGING: Boolean = false
    const val TRACK_SCREENSHOT_ON_CRASH: Boolean = false
    val SCREENSHOT_MASK_LEVEL: ScreenshotMaskLevel = ScreenshotMaskLevel.AllTextAndMedia
    const val TRACK_HTTP_HEADERS: Boolean = false
    const val TRACK_HTTP_BODY: Boolean = false
    val HTTP_HEADERS_BLOCKLIST: List<String> = emptyList()
    val HTTP_URL_BLOCKLIST: List<String> = emptyList()
    const val TRACK_ACTIVITY_INTENT_DATA: Boolean = false
    const val SESSION_SAMPLING_RATE: Float = 1.0f
    val EVENT_TYPE_EXPORT_ALLOW_LIST: List<String> = listOf(
        EventType.COLD_LAUNCH,
        EventType.HOT_LAUNCH,
        EventType.WARM_LAUNCH,
    )
}
