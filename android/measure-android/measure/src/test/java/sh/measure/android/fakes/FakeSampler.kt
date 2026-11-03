package sh.measure.android.fakes

import sh.measure.android.exceptions.ExceptionSeverity
import sh.measure.android.utils.Sampler

internal class FakeSampler : Sampler {
    var isTraceSampled: Boolean = true
    var isLaunchEventSampled: Boolean = true
    var isAnrTimelineSampled: Boolean = true
    var isCrashTimelineSampled: Boolean = true
    var trackMemoryUsageForSession: Boolean = true
    var trackAnalyticsForInstallation: Boolean = true
    var analyticsInstallationId: String? = null
    var isHttpEventSampled: Boolean = true
    var isProfileSampled: Boolean = true
    var sampledErrorSeverities: Set<ExceptionSeverity> =
        setOf(ExceptionSeverity.Fatal, ExceptionSeverity.Unhandled)

    override fun shouldSampleTrace(traceId: String): Boolean = isTraceSampled
    override fun shouldSampleLaunchEvent(): Boolean = isLaunchEventSampled
    override fun shouldTrackMemoryUsageForSession(sessionId: String): Boolean = trackMemoryUsageForSession
    override fun shouldTrackAnalyticsForInstallation(installationId: String): Boolean {
        analyticsInstallationId = installationId
        return trackAnalyticsForInstallation
    }
    override fun shouldSampleHttpEvent(): Boolean = isHttpEventSampled
    override fun shouldSampleProfile(): Boolean = isProfileSampled
    override fun shouldSampleError(severity: ExceptionSeverity): Boolean = severity in sampledErrorSeverities

    fun setSampled(isSampled: Boolean) {
        this.isTraceSampled = isSampled
    }
}
