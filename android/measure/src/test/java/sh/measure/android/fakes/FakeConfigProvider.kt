package sh.measure.android.fakes

import android.hardware.SensorManager
import sh.measure.android.config.ConfigProvider
import sh.measure.android.config.MsrRequestHeadersProvider
import sh.measure.android.config.ScreenshotMaskLevel
import sh.measure.android.events.EventType

internal class FakeConfigProvider : ConfigProvider {
    override fun loadNetworkConfig() {
        // no-op
    }

    override val enableLogging: Boolean = false
    override var trackScreenshotOnCrash: Boolean = false
    override var screenshotMaskLevel: ScreenshotMaskLevel = ScreenshotMaskLevel.SensitiveFieldsOnly
    override var screenshotMaskHexColor: String = "#222222"
    override var screenshotCompressionQuality: Int = 25
    override val eventTypeExportAllowList: List<EventType> = emptyList()
    override var trackHttpHeaders: Boolean = true
    override var trackHttpBody: Boolean = true
    override var httpHeadersBlocklist: List<String> = emptyList()
    override var httpUrlBlocklist: List<String> = emptyList()
    override var httpUrlAllowlist: List<String> = emptyList()
    override var trackActivityIntentData: Boolean = false
    override var samplingRateForErrorFreeSessions: Float = 1.0f
    override var maxAttachmentSizeInEventsBatchInBytes: Int = 3
    override var eventsBatchingIntervalMs: Long = 30_000 // 30 seconds
    override var eventsBatchingJitterMs: Long = 20_000 // 20 seconds
    override var maxEventsInBatch: Int = 100
    override var httpContentTypeAllowlist: List<String> = emptyList()
    override var defaultHttpHeadersBlocklist: List<String> = emptyList()
    override var sessionEndLastEventThresholdMs: Long = 3 * 60 * 1000 // 3 minutes
    override var maxEventNameLength: Int = 64
    override val customEventNameRegex: String = "^[a-zA-Z0-9_-]+$"
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
    override val shakeAccelerationThreshold: Float = 2.5f * SensorManager.GRAVITY_EARTH
    override val shakeMinTimeIntervalMs: Long = 5000
    override val shakeSlop: Int = 2
    override val disallowedCustomHeaders: List<String> =
        listOf("Content-Type", "msr-req-id", "Authorization", "Content-Length")
    override val requestHeadersProvider: MsrRequestHeadersProvider? = null
    override val estimatedEventSizeInKb: Int = 15
    override val maxDiskUsageInMb: Int = 50
    override val coldLaunchSamplingRate: Float = 0.01f
    override val warmLaunchSamplingRate: Float = 0.01f
    override val hotLaunchSamplingRate: Float = 0.01f
    override var journeySamplingRate: Float = 0.01f

    var shouldTrackHttpBodyResult = true

    override fun shouldTrackHttpBody(url: String, contentType: String?): Boolean = shouldTrackHttpBodyResult

    var shouldTrackHttpUrl = true

    override fun shouldTrackHttpUrl(url: String): Boolean = shouldTrackHttpUrl

    override fun shouldTrackHttpHeader(key: String): Boolean = !httpHeadersBlocklist.any { key.contains(it, ignoreCase = true) }

    override fun setMeasureUrl(url: String) {
        // no-op
    }
}
