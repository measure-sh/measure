package sh.measure.android.utils

import sh.measure.android.config.ConfigProvider

internal interface Sampler {
    fun shouldSampleTrace(traceId: String): Boolean
    fun shouldSampleLaunchEvent(): Boolean
    fun shouldTrackJourneyForSession(sessionId: String): Boolean
}

internal class SamplerImpl(
    private val configProvider: ConfigProvider,
    private val randomizer: Randomizer,
) : Sampler {
    override fun shouldSampleTrace(traceId: String): Boolean {
        if (configProvider.enableFullCollectionMode) {
            return true
        }

        if (configProvider.traceSamplingRate == 0.0f) {
            return false
        }
        if (configProvider.traceSamplingRate == 100f) {
            return true
        }

        val sampleRate = configProvider.traceSamplingRate / 100
        val idLo = OtelEncodingUtils.longFromBase16String(traceId, 16)
        val threshold = (Long.MAX_VALUE * sampleRate).toLong()
        return (idLo and Long.MAX_VALUE) < threshold
    }

    override fun shouldSampleLaunchEvent(): Boolean {
        if (configProvider.launchSamplingRate == 0.0f) {
            return false
        }
        if (configProvider.launchSamplingRate == 100f) {
            return true
        }

        return randomizer.random() < (configProvider.launchSamplingRate / 100)
    }

    override fun shouldTrackJourneyForSession(sessionId: String): Boolean {
        val samplingRate = (configProvider.journeySamplingRate / 100)
        if (samplingRate == 0.0f) {
            return false
        }
        if (samplingRate == 1.0f) {
            return true
        }

        return stableSamplingValue(sessionId) < samplingRate
    }

    /**
     * Generates a stable sampling value in [0, 1] from a session ID.
     *
     * Uses FNV-1a 64-bit hash for deterministic, uniformly distributed output.
     * The same sessionId always produces the same value, ensuring consistent
     * sampling decisions.
     *
     * Implementation notes:
     * - Constants are FNV-1a 64-bit (offset: 0xcbf29ce484222325, prime: 0x100000001b3)
     *   expressed as signed longs.
     * - `ushr 1` ensures a positive value by clearing the sign bit. This loses 1 bit
     *   of entropy (63 vs 64 bits), which is negligible for sampling purposes.
     */
    private fun stableSamplingValue(sessionId: String): Float {
        var hash = -3750763034362895579L
        for (c in sessionId) {
            hash = hash xor c.code.toLong()
            hash *= 1099511628211L
        }
        return ((hash ushr 1).toDouble() / Long.MAX_VALUE).toFloat()
    }
}
