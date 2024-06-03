package sh.measure.android.fakes

import sh.measure.android.config.ConfigProvider
import sh.measure.android.config.ScreenshotMaskLevel

internal class FakeConfigProvider : ConfigProvider {
    override fun loadNetworkConfig() {
        // no-op
    }

    override var trackScreenshotOnCrash: Boolean = false
    override var screenshotMaskLevel: ScreenshotMaskLevel = ScreenshotMaskLevel.SensitiveFieldsOnly
    override var screenshotMaskHexColor: String = "#222222"
    override var screenshotCompressionQuality: Int = 25
    override var enableHttpHeadersCapture: Boolean = false
    override var enableHttpBodyCapture: Boolean = false
    override var httpHeadersBlocklist: List<String> = emptyList()
    override var httpUrlBlocklist: List<String> = emptyList()
    override var trackLifecycleActivityIntent: Boolean = false
    override var trackColdLaunchIntent: Boolean= false
    override var trackWarmLaunchIntent: Boolean= false
    override var trackHotLaunchIntent: Boolean= false
    override var maxEventsAttachmentSizeInBatchBytes: Int = 3
    override var eventsBatchingIntervalMs: Long = 10_000
    override var maxEventsInBatch: Int = 100
    override var httpContentTypeAllowlist: List<String> = emptyList()
    override var restrictedHttpHeadersBlocklist: List<String> = emptyList()
    override var restrictedHttpUrlBlocklist: List<String> = emptyList()

    var shouldTrackHttpBody = false
    override fun shouldTrackHttpBody(url: String, contentType: String?): Boolean {
        return shouldTrackHttpBody
    }
}
