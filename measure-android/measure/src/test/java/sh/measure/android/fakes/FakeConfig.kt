package sh.measure.android.fakes

import sh.measure.android.Config

internal class FakeConfig(
    private var trackHttpBody: Boolean = true,
) : Config {

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
