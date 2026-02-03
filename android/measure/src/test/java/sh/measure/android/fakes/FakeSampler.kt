package sh.measure.android.fakes

import sh.measure.android.utils.Sampler

internal class FakeSampler : Sampler {
    var isTraceSampled: Boolean = true
    var isLaunchEventSampled: Boolean = true
    var isAnrTimelineSampled: Boolean = true
    var isCrashTimelineSampled: Boolean = true
    var trackJourneyForSession: Boolean = true

    override fun shouldSampleTrace(traceId: String): Boolean = isTraceSampled
    override fun shouldSampleLaunchEvent(): Boolean = isLaunchEventSampled
    override fun shouldTrackJourneyForSession(sessionId: String): Boolean = trackJourneyForSession

    fun setSampled(isSampled: Boolean) {
        this.isTraceSampled = isSampled
    }
}
