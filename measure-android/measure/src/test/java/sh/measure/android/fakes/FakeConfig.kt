package sh.measure.android.fakes

import sh.measure.android.Config

internal class FakeConfig(
    private var trackHttpBody: Boolean = true,
) : Config {
    override var captureScreenshotForExceptions: Boolean = false
    override var maskAllTextInScreenshots: Boolean = true
    override var screenshotMaskHexColor: String = "#222222"
    override var screenshotJpegQuality: Int = 25
    override var screenshotWebpQuality: Int = 25
    override var screenshotMaskRadius: Float = 8f
    override var maxAttachmentSizeInBytes: Int = 3 * 1024 * 1024
    override var maxEventsBatchSize: Int = 50
    override var batchingIntervalMs: Long = 30 * 1000

    override fun trackHttpBody(url: String, contentType: String?): Boolean {
        return trackHttpBody
    }

    fun setHttpBodyTracking(trackHttpBody: Boolean) {
        this.trackHttpBody = trackHttpBody
    }
}
