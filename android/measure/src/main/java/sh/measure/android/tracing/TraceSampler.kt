package sh.measure.android.tracing

import sh.measure.android.config.ConfigProvider
import sh.measure.android.utils.Randomizer

internal interface TraceSampler {
    fun shouldSample(): Boolean
}

internal class TraceSamplerImpl(
    private val randomizer: Randomizer,
    private val configProvider: ConfigProvider,
) : TraceSampler {
    override fun shouldSample(): Boolean {
        if (configProvider.traceSamplingRate == 0.0f) {
            return false
        }
        if (configProvider.traceSamplingRate == 1.0f) {
            return true
        }
        return randomizer.random() < configProvider.traceSamplingRate
    }
}
