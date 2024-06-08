package sh.measure.android.fakes

import sh.measure.android.config.ConfigLoader
import sh.measure.android.config.MeasureConfig

class NoopConfigLoader : ConfigLoader {
    override fun getCachedConfig(): MeasureConfig? {
        return null
    }

    override fun getNetworkConfig(onSuccess: (MeasureConfig) -> Unit) {
        // no-op
    }
}
