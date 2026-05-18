package sh.measure.android.utils

class FakeSampler : Sampler {
    override fun shouldSampleTrace(traceId: String): Boolean = true
    override fun shouldSampleLaunchEvent(): Boolean = true
    override fun shouldTrackJourneyForSession(sessionId: String): Boolean = true
    override fun shouldSampleHttpEvent(): Boolean = true
}
