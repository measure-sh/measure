package sh.measure.android.config

import androidx.annotation.VisibleForTesting
import java.util.concurrent.locks.ReentrantReadWriteLock
import kotlin.concurrent.read
import kotlin.concurrent.write

internal interface ConfigProvider : IMeasureConfig {
    fun loadNetworkConfig()
}

internal class ConfigProviderImpl(
    private val defaultConfig: MeasureConfig,
    private val configLoader: ConfigLoader,
) : ConfigProvider {
    private var cachedConfig: MeasureConfig? = null

    @VisibleForTesting
    internal var networkConfig: MeasureConfig? = null
    private val networkConfigLock = ReentrantReadWriteLock()

    init {
        // Synchronously load the cached config. This allows the SDK to start with a previously
        // fetched config. The trade-off is the SDK will make a synchronous disk read.
        cachedConfig = configLoader.getCachedConfig()
    }

    override fun loadNetworkConfig() {
        configLoader.getNetworkConfig {
            networkConfigLock.write {
                networkConfig = it
            }
        }
    }

    override val trackScreenshotOnCrash: Boolean
        get() = getMergedConfig { trackScreenshotOnCrash }
    override val screenshotMaskLevel: ScreenshotMaskLevel
        get() = getMergedConfig { screenshotMaskLevel }
    override val screenshotMaskHexColor: String
        get() = getMergedConfig { screenshotMaskHexColor }
    override val screenshotCompressionQuality: Int
        get() = getMergedConfig { screenshotCompressionQuality }
    override val enableHttpHeadersCapture: Boolean
        get() = getMergedConfig { enableHttpHeadersCapture }
    override val enableHttpBodyCapture: Boolean
        get() = getMergedConfig { enableHttpBodyCapture }
    override val httpHeadersBlocklist: List<String>
        get() = getMergedConfig { httpHeadersBlocklist }
    override val httpUrlBlocklist: List<String>
        get() = getMergedConfig { httpUrlBlocklist }
    override val trackLifecycleActivityIntent: Boolean
        get() = getMergedConfig { trackLifecycleActivityIntent }
    override val trackColdLaunchIntent: Boolean
        get() = getMergedConfig { trackColdLaunchIntent }
    override val trackWarmLaunchIntent: Boolean
        get() = getMergedConfig { trackWarmLaunchIntent }
    override val trackHotLaunchIntent: Boolean
        get() = getMergedConfig { trackHotLaunchIntent }
    override val eventsBatchingIntervalMs: Long
        get() = getMergedConfig { eventsBatchingIntervalMs }
    override val maxEventsInBatch: Int
        get() = getMergedConfig { maxEventsInBatch }
    override val httpContentTypeAllowlist: List<String>
        get() = getMergedConfig { httpContentTypeAllowlist }
    override val restrictedHttpHeadersBlocklist: List<String>
        get() = getMergedConfig { restrictedHttpHeadersBlocklist }
    override val restrictedHttpUrlBlocklist: List<String>
        get() = getMergedConfig { restrictedHttpUrlBlocklist }
    override val maxEventsAttachmentSizeInBatchBytes: Int
        get() = getMergedConfig { maxEventsAttachmentSizeInBatchBytes }

    private fun <T> getMergedConfig(selector: MeasureConfig.() -> T): T {
        if (networkConfig != null) {
            networkConfigLock.read {
                return networkConfig?.selector() ?: cachedConfig?.selector()
                ?: defaultConfig.selector()
            }
        }
        return cachedConfig?.selector() ?: defaultConfig.selector()
    }
}