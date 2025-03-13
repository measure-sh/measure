package sh.measure.android.utils

import sh.measure.android.tracing.TraceSampler

class FakeTraceSampler : TraceSampler {
    override fun shouldSample(): Boolean {
        return true
    }
}
