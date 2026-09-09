package sh.measure.android.utils

import sh.measure.android.exceptions.ExceptionSeverity

internal class FakeSampler : Sampler {
    override fun shouldSampleTrace(traceId: String): Boolean = true
    override fun shouldSampleLaunchEvent(): Boolean = true
    override fun shouldTrackJourneyForSession(sessionId: String): Boolean = true
    override fun shouldSampleHttpEvent(): Boolean = true
    override fun shouldSampleProfile(): Boolean = true
    override fun shouldSampleError(severity: ExceptionSeverity): Boolean = true
}
