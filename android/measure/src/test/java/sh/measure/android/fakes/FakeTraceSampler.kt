package sh.measure.android.fakes

import sh.measure.android.tracing.TraceSampler

internal class FakeTraceSampler : TraceSampler {
    private var isSampled: Boolean = true

    override fun shouldSample(): Boolean = isSampled

    fun setSampled(isSampled: Boolean) {
        this.isSampled = isSampled
    }
}
