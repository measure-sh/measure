package sh.measure.android.fakes

import sh.measure.android.config.Config
import sh.measure.android.config.ConfigLoader

internal class NoopConfigLoader : ConfigLoader {
    override fun getCachedConfig(): Config? {
        return null
    }

    override fun getNetworkConfig(onSuccess: (Config) -> Unit) {

    }
}
