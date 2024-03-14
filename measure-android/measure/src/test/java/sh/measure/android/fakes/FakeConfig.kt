package sh.measure.android.fakes

import sh.measure.android.Config

internal class FakeConfig(
    private var trackHttpBody: Boolean = true,
) : Config {
    override fun trackHttpBody(url: String, contentType: String?): Boolean {
        return trackHttpBody
    }

    fun setHttpBodyTracking(trackHttpBody: Boolean) {
        this.trackHttpBody = trackHttpBody
    }
}
