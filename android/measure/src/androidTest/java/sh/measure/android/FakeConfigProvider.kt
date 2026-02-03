package sh.measure.android

import android.hardware.SensorManager
import sh.measure.android.config.ConfigProvider
import sh.measure.android.config.DynamicConfig
import sh.measure.android.config.MsrRequestHeadersProvider
import sh.measure.android.config.ScreenshotMaskLevel
import sh.measure.android.events.EventType

internal class FakeConfigProvider : ConfigProvider {
    override fun shouldTrackHttpEvent(url: String): Boolean = false

    override fun setMeasureUrl(url: String) {
        // No-op
    }

    override var enableLogging: Boolean = true
    override var screenshotMaskLevel: ScreenshotMaskLevel = ScreenshotMaskLevel.AllText
    override var trackActivityIntentData: Boolean = true
    override val traceSamplingRate: Float = 1f
    override var batchExportIntervalMs: Long = 1_000_000
    override val attachmentExportIntervalMs: Long = 500
    override var maxEventsInBatch: Int = 1_000_000
    override var defaultHttpHeadersBlocklist: List<String> = emptyList()
    override var sessionBackgroundTimeoutThresholdMs: Long = 30_000
    override var maxEventNameLength: Int = 64
    override val customEventNameRegex: String = "^[a-zA-Z0-9_-]+\$"
    override val maxUserDefinedAttributesPerEvent: Int = 100
    override var maxUserDefinedAttributeKeyLength: Int = 64
    override var maxUserDefinedAttributeValueLength: Int = 256
    override var screenshotMaskHexColor: String = "#222222"
    override var screenshotCompressionQuality: Int = 100
    override var eventTypeExportAllowList: List<EventType> = emptyList()
    override val autoStart: Boolean = true
    override val maxSpanNameLength: Int = 64
    override val maxCheckpointNameLength: Int = 64
    override val maxCheckpointsPerSpan: Int = 100
    override val maxInMemorySignalsQueueSize: Int = 30
    override val inMemorySignalsQueueFlushRateMs: Long = 3000
    override val maxAttachmentsInBugReport: Int = 5
    override val maxDescriptionLengthInBugReport: Int = 15
    override val shakeAccelerationThreshold: Float = 2.5f * SensorManager.GRAVITY_EARTH
    override val shakeMinTimeIntervalMs: Long = 5000
    override val shakeSlop: Int = 2
    override val disallowedCustomHeaders: List<String> = mutableListOf()
    override val estimatedEventSizeInKb: Int = 2
    override val maxDiskUsageInMb: Int = 50
    override val requestHeadersProvider: MsrRequestHeadersProvider? = null
    override val journeySamplingRate: Float = 0.01f
    override val enableFullCollectionMode: Boolean = true

    override val crashTimelineDurationSeconds: Int = 300
    override val anrTimelineDurationSeconds: Int = 300
    override val bugReportTimelineDurationSeconds: Int = 300
    override val cpuUsageInterval: Long = 3000
    override val memoryUsageInterval: Long = 3000
    override val crashTakeScreenshot: Boolean = true
    override val anrTakeScreenshot: Boolean = true
    override val launchSamplingRate: Float = 1f
    override val gestureClickTakeSnapshot: Boolean = true
    override val httpDisableEventForUrls: List<String> = emptyList()
    override val httpTrackRequestForUrls: List<String> = emptyList()
    override val httpTrackResponseForUrls: List<String> = emptyList()
    override val httpBlockedHeaders: List<String> = emptyList()
    override fun shouldTrackHttpHeader(key: String): Boolean = true
    override fun shouldTrackHttpRequestBody(url: String): Boolean = true
    override fun shouldTrackHttpResponseBody(url: String): Boolean = true

    override fun setDynamicConfig(config: DynamicConfig) {
        // No-op
    }
}
