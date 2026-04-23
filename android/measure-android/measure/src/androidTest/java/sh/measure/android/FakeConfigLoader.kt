package sh.measure.android

import sh.measure.android.config.ConfigLoader
import sh.measure.android.config.DynamicConfig

internal class FakeConfigLoader : ConfigLoader {
    override fun loadDynamicConfig(onLoaded: (DynamicConfig?) -> Unit) {
        // No-op
    }
}
