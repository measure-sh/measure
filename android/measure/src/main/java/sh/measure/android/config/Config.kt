package sh.measure.android.config

import android.hardware.SensorManager
import sh.measure.android.events.EventType

internal data class Config(
    override val enableLogging: Boolean = DefaultConfig.ENABLE_LOGGING,
    override val autoStart: Boolean = DefaultConfig.AUTO_START,
    override val maxDiskUsageInMb: Int = DefaultConfig.MAX_ESTIMATED_DISK_USAGE_IN_MB,
    override val trackActivityIntentData: Boolean = DefaultConfig.TRACK_ACTIVITY_INTENT_DATA,
    override val requestHeadersProvider: MsrRequestHeadersProvider? = null,
    override val enableFullCollectionMode: Boolean = DefaultConfig.ENABLE_FULL_COLLECTION_MODE,
) : InternalConfig,
    IMeasureConfig {
    override val screenshotMaskHexColor: String = "#222222"
    override val screenshotCompressionQuality: Int = 25
    override val batchExportIntervalMs: Long = 3_000 // 3 seconds
    override val attachmentExportIntervalMs: Long = 500 // 500 ms
    override val defaultHttpHeadersBlocklist: List<String> = listOf(
        "Authorization",
        "Cookie",
        "Set-Cookie",
        "Proxy-Authorization",
        "WWW-Authenticate",
        "X-Api-Key",
    )
    override val sessionBackgroundTimeoutThresholdMs: Long = 30_000 // 30 seconds
    override val maxEventNameLength: Int = 64 // 64 chars
    override val customEventNameRegex: String = "^[a-zA-Z0-9_-]+$"
    override val maxUserDefinedAttributesPerEvent: Int = 100
    override val maxUserDefinedAttributeKeyLength: Int = 256 // 256 chars
    override val maxUserDefinedAttributeValueLength: Int = 256 // 256 chars
    override val eventTypeExportAllowList: List<EventType> = listOf(EventType.SESSION_START)
    override val maxSpanNameLength: Int = 64
    override val maxCheckpointNameLength: Int = 64
    override val maxCheckpointsPerSpan: Int = 100
    override val maxInMemorySignalsQueueSize: Int = 30
    override val inMemorySignalsQueueFlushRateMs: Long = 3000
    override val maxAttachmentsInBugReport: Int = 5
    override val maxDescriptionLengthInBugReport: Int = 4000
    override val shakeAccelerationThreshold: Float = 2.5f * SensorManager.GRAVITY_EARTH
    override val shakeMinTimeIntervalMs: Long = 5000
    override val shakeSlop: Int = 2
    override val estimatedEventSizeInKb: Int = 2 // 2KB
    override val disallowedCustomHeaders: List<String> = DefaultConfig.DISALLOWED_CUSTOM_HEADERS
}
