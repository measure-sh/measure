package sh.measure.android

import sh.measure.android.config.ConfigProvider
import sh.measure.android.config.ScreenshotMaskLevel

class FakeConfigProvider : ConfigProvider {
    override fun loadNetworkConfig() {
        // no-op
    }

    override fun shouldTrackHttpBody(url: String, contentType: String?): Boolean {
        return false
    }

    override fun shouldTrackHttpUrl(url: String): Boolean {
        return false
    }

    override fun shouldTrackHttpHeader(key: String): Boolean {
        return false
    }

    override fun setMeasureUrl(url: String) {
        // No-op
    }

    override var enableLogging: Boolean = true
    override var trackScreenshotOnCrash: Boolean = true
    override var screenshotMaskLevel: ScreenshotMaskLevel = ScreenshotMaskLevel.AllText
    override var trackHttpHeaders: Boolean = true
    override var trackHttpBody: Boolean = true
    override var httpHeadersBlocklist: List<String> = emptyList()
    override var httpUrlBlocklist: List<String> = emptyList()
    override var httpUrlAllowlist: List<String> = emptyList()
    override var trackActivityIntentData: Boolean = true
    override var samplingRateForErrorFreeSessions: Float = 1f
    override var maxAttachmentSizeInEventsBatchInBytes: Int = 1_000_000
    override var eventsBatchingIntervalMs: Long = 1_000_000
    override var maxEventsInBatch: Int = 1_000_000
    override var httpContentTypeAllowlist: List<String> = emptyList()
    override var defaultHttpHeadersBlocklist: List<String> = emptyList()
    override var sessionEndLastEventThresholdMs: Long = 1_000_000
    override var maxSessionDurationMs: Long = 6_000_000
    override var maxUserDefinedAttributeKeyLength: Int = 1_000_000
    override var maxUserDefinedAttributeValueLength: Int = 1_000_000
    override var userDefinedAttributeKeyWithSpaces: Boolean = true
    override var screenshotMaskHexColor: String = "#222222"
    override var screenshotCompressionQuality: Int = 100
    override var eventTypeExportAllowList: List<String> = emptyList()
    override var maxEventsInDatabase: Int = 50000
    override val autoStart: Boolean = true
}
