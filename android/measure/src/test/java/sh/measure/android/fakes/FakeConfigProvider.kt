package sh.measure.android.fakes

import android.hardware.SensorManager
import sh.measure.android.config.ConfigProvider
import sh.measure.android.config.DynamicConfig
import sh.measure.android.config.MsrRequestHeadersProvider
import sh.measure.android.config.ScreenshotMaskLevel

internal class FakeConfigProvider : ConfigProvider {
    override val enableLogging: Boolean = false
    override var screenshotMaskHexColor: String = "#222222"
    override var screenshotCompressionQuality: Int = 25
    override var trackActivityIntentData: Boolean = false
    override var batchExportIntervalMs: Long = 3_000 // 3 seconds
    override var attachmentExportIntervalMs: Long = 500 // 500ms
    override var defaultHttpHeadersBlocklist: List<String> = emptyList()
    override var sessionBackgroundTimeoutThresholdMs: Long = 30_000 // 30 seconds
    override var maxEventNameLength: Int = 64
    override val customEventNameRegex: String = "^[a-zA-Z0-9_-]+$"
    override val maxUserDefinedAttributesPerEvent: Int = 100
    override var maxUserDefinedAttributeKeyLength: Int = 64
    override var maxUserDefinedAttributeValueLength: Int = 256
    override val autoStart: Boolean = true
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
    override var estimatedEventSizeInKb: Int = 2
    override var maxDiskUsageInMb: Int = 50
    override var enableFullCollectionMode: Boolean = true
    override var maxEventsInBatch: Int = 1000
    override var crashTimelineDurationSeconds: Int = 300
    override var anrTimelineDurationSeconds: Int = 300
    override var bugReportTimelineDurationSeconds: Int = 300
    override var traceSamplingRate: Float = 1f
    override var journeySamplingRate: Float = 1f
    override var screenshotMaskLevel: ScreenshotMaskLevel = ScreenshotMaskLevel.AllTextAndMedia
    override var cpuUsageInterval: Long = 3
    override var memoryUsageInterval: Long = 3
    override var crashTakeScreenshot: Boolean = true
    override var anrTakeScreenshot: Boolean = true
    override var launchSamplingRate: Float = 1f
    override var gestureClickTakeSnapshot: Boolean = true
    override var httpSamplingRate: Float = 1f
    override var httpDisableEventForUrls: List<String> = emptyList()
    override var httpTrackRequestForUrls: List<String> = emptyList()
    override var httpTrackResponseForUrls: List<String> = emptyList()
    override var httpBlockedHeaders: List<String> = emptyList()

    var shouldTrackHttpRequestBodyResult = true
    var shouldTrackHttpResponseBodyResult = true
    var shouldTrackHttpHeaderResult = true

    override fun shouldTrackHttpRequestBody(url: String): Boolean = shouldTrackHttpRequestBodyResult

    override fun shouldTrackHttpResponseBody(url: String): Boolean = shouldTrackHttpResponseBodyResult

    override fun shouldTrackHttpHeader(key: String): Boolean = shouldTrackHttpHeaderResult

    var shouldTrackHttpEventForUrl = true

    override fun shouldTrackHttpEvent(url: String): Boolean = shouldTrackHttpEventForUrl

    override fun setMeasureUrl(url: String) {
        // no-op
    }

    var dynamicConfig: DynamicConfig? = null
        private set

    override fun setDynamicConfig(config: DynamicConfig) {
        dynamicConfig = config
    }
}
