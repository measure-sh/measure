package sh.measure.android.config

import sh.measure.android.events.EventType

internal data class Config(
    override val enableLogging: Boolean = DefaultConfig.ENABLE_LOGGING,
    override val trackScreenshotOnCrash: Boolean = DefaultConfig.TRACK_SCREENSHOT_ON_CRASH,
    override val screenshotMaskLevel: ScreenshotMaskLevel = DefaultConfig.SCREENSHOT_MASK_LEVEL,
    override val trackHttpHeaders: Boolean = DefaultConfig.TRACK_HTTP_HEADERS,
    override val trackHttpBody: Boolean = DefaultConfig.TRACK_HTTP_BODY,
    override val httpHeadersBlocklist: List<String> = DefaultConfig.HTTP_HEADERS_BLOCKLIST,
    override val httpUrlBlocklist: List<String> = DefaultConfig.HTTP_URL_BLOCKLIST,
    override val httpUrlAllowlist: List<String> = DefaultConfig.HTTP_URL_ALLOWLIST,
    override val trackActivityIntentData: Boolean = DefaultConfig.TRACK_ACTIVITY_INTENT_DATA,
    override val samplingRateForErrorFreeSessions: Float = DefaultConfig.SESSION_SAMPLING_RATE,
    override val autoStart: Boolean = DefaultConfig.AUTO_START,
    override val traceSamplingRate: Float = DefaultConfig.TRACE_SAMPLING_RATE,
) : InternalConfig, IMeasureConfig {
    override val screenshotMaskHexColor: String = "#222222"
    override val screenshotCompressionQuality: Int = 25
    override val maxAttachmentSizeInEventsBatchInBytes: Int = 3_000_000 // 3 MB
    override val eventsBatchingIntervalMs: Long = 30_000 // 30 seconds
    override val maxEventsInBatch: Int = 500
    override val httpContentTypeAllowlist: List<String> = listOf("application/json")
    override val defaultHttpHeadersBlocklist: List<String> = listOf(
        "Authorization",
        "Cookie",
        "Set-Cookie",
        "Proxy-Authorization",
        "WWW-Authenticate",
        "X-Api-Key",
    )
    override val sessionEndLastEventThresholdMs: Long = 20 * 60 * 1000 // 20 minutes
    override val maxSessionDurationMs: Long = 6 * 60 * 60 * 1000 // 6 hours
    override val maxEventNameLength: Int = 64 // 64 chars
    override val customEventNameRegex: String = "^[a-zA-Z0-9_-]+\$"
    override val maxUserDefinedAttributesPerEvent: Int = 100
    override val maxUserDefinedAttributeKeyLength: Int = 256 // 256 chars
    override val maxUserDefinedAttributeValueLength: Int = 256 // 256 chars
    override val eventTypeExportAllowList: List<String> = listOf(
        EventType.COLD_LAUNCH,
        EventType.HOT_LAUNCH,
        EventType.WARM_LAUNCH,
        EventType.LIFECYCLE_ACTIVITY,
        EventType.LIFECYCLE_FRAGMENT,
        EventType.SCREEN_VIEW,
    )
    override val maxSignalsInDatabase: Int = 50_000
    override val maxSpanNameLength: Int = 64
    override val maxCheckpointNameLength: Int = 64
    override val maxCheckpointsPerSpan: Int = 100
    override val maxInMemorySignalsQueueSize: Int = 30
    override val inMemorySignalsQueueFlushRateMs: Long = 3000
}
