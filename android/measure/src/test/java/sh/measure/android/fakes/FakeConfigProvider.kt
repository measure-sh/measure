package sh.measure.android.fakes

import sh.measure.android.config.ConfigProvider
import sh.measure.android.config.ScreenshotMaskLevel

internal class FakeConfigProvider : ConfigProvider {
    override fun loadNetworkConfig() {
        // no-op
    }

    override val enableLogging: Boolean = false
    override var trackScreenshotOnCrash: Boolean = false
    override var screenshotMaskLevel: ScreenshotMaskLevel = ScreenshotMaskLevel.SensitiveFieldsOnly
    override var screenshotMaskHexColor: String = "#222222"
    override var screenshotCompressionQuality: Int = 25
    override val eventTypeExportAllowList: List<String> = emptyList()
    override val maxSignalsInDatabase: Int = 50_000
    override var trackHttpHeaders: Boolean = false
    override var trackHttpBody: Boolean = false
    override var httpHeadersBlocklist: List<String> = emptyList()
    override var httpUrlBlocklist: List<String> = emptyList()
    override var httpUrlAllowlist: List<String> = emptyList()
    override var trackActivityIntentData: Boolean = false
    override var samplingRateForErrorFreeSessions: Float = 1.0f
    override var maxAttachmentSizeInEventsBatchInBytes: Int = 3
    override var eventsBatchingIntervalMs: Long = 30_000 // 30 seconds
    override var maxEventsInBatch: Int = 100
    override var httpContentTypeAllowlist: List<String> = emptyList()
    override var defaultHttpHeadersBlocklist: List<String> = emptyList()
    override var sessionEndLastEventThresholdMs: Long = 20 * 60 * 1000 // 20 minutes
    override var maxSessionDurationMs: Long = 6 * 60 * 60 * 1000 // 6 hours
    override var maxEventNameLength: Int = 64
    override val customEventNameRegex: String = "^[a-zA-Z0-9_-]+\$"
    override val maxUserDefinedAttributesPerEvent: Int = 100
    override var maxUserDefinedAttributeKeyLength: Int = 64
    override var maxUserDefinedAttributeValueLength: Int = 256
    override val autoStart: Boolean = true
    override val traceSamplingRate: Float = 1.0f
    override val maxSpanNameLength: Int = 64
    override val maxCheckpointNameLength: Int = 64
    override val maxCheckpointsPerSpan: Int = 100
    override var maxInMemorySignalsQueueSize: Int = 30
    override val inMemorySignalsQueueFlushRateMs: Long = 3000
    override val maxAttachmentsInBugReport: Int = 5
    override val maxDescriptionLengthInBugReport: Int = 1000
    override val shakeAccelerationThreshold: Float = 20f
    override val shakeMinTimeIntervalMs: Long = 1500
    override val shakeSlop: Int = 3
    override val enableShakeToLaunchBugReport: Boolean = false

    var shouldTrackHttpBody = false

    override fun shouldTrackHttpBody(url: String, contentType: String?): Boolean {
        return shouldTrackHttpBody
    }

    var shouldTrackHttpUrl = false

    override fun shouldTrackHttpUrl(url: String): Boolean {
        return shouldTrackHttpUrl
    }

    var headerKeysToBlock = emptyList<String>()

    override fun shouldTrackHttpHeader(key: String): Boolean {
        return !headerKeysToBlock.any { key.contains(it, ignoreCase = true) }
    }

    override fun setMeasureUrl(url: String) {
        // no-op
    }
}
