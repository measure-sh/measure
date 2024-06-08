package sh.measure.android.config

import androidx.annotation.VisibleForTesting
import java.util.concurrent.locks.ReentrantReadWriteLock
import kotlin.concurrent.read
import kotlin.concurrent.write

internal interface ConfigProvider : IMeasureConfig {
    fun loadNetworkConfig()
    fun shouldTrackHttpBody(url: String, contentType: String?): Boolean
    fun shouldTrackHttpUrl(url: String): Boolean
    fun shouldTrackHttpHeader(key: String): Boolean
}

internal class ConfigProviderImpl(
    private val defaultConfig: MeasureConfig,
    private val configLoader: ConfigLoader,
) : ConfigProvider {
    private var cachedConfig: MeasureConfig? = null

    @VisibleForTesting
    internal var networkConfig: MeasureConfig? = null
    private val networkConfigLock = ReentrantReadWriteLock()

    /**
     * The combined url blocklist of [defaultHttpUrlBlocklist] and [httpUrlBlocklist].
     */
    private val combinedHttpUrlBlocklist = defaultHttpUrlBlocklist + httpUrlBlocklist
    private val combinedHttpHeadersBlocklist = defaultHttpHeadersBlocklist + httpHeadersBlocklist

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
    override val trackHttpHeaders: Boolean
        get() = getMergedConfig { trackHttpHeaders }
    override val trackHttpBody: Boolean
        get() = getMergedConfig { trackHttpBody }
    override val httpHeadersBlocklist: List<String>
        get() = getMergedConfig { httpHeadersBlocklist }
    override val httpUrlBlocklist: List<String>
        get() = getMergedConfig { httpUrlBlocklist }
    override val trackActivityIntentData: Boolean
        get() = getMergedConfig { trackActivityIntentData }
    override val eventsBatchingIntervalMs: Long
        get() = getMergedConfig { eventsBatchingIntervalMs }
    override val maxEventsInBatch: Int
        get() = getMergedConfig { maxEventsInBatch }
    override val httpContentTypeAllowlist: List<String>
        get() = getMergedConfig { httpContentTypeAllowlist }
    override val defaultHttpHeadersBlocklist: List<String>
        get() = getMergedConfig { defaultHttpHeadersBlocklist }
    override val defaultHttpUrlBlocklist: List<String>
        get() = getMergedConfig { defaultHttpUrlBlocklist }
    override val maxAttachmentSizeInEventsBatch: Int
        get() = getMergedConfig { maxAttachmentSizeInEventsBatch }

    override fun shouldTrackHttpBody(url: String, contentType: String?): Boolean {
        if (contentType.isNullOrEmpty()) {
            return false
        }
        if ((defaultHttpUrlBlocklist + httpUrlBlocklist).any { url.contains(it) }) {
            return false
        }
        return httpContentTypeAllowlist.any { contentType.startsWith(it) }
    }

    override fun shouldTrackHttpUrl(url: String): Boolean {
        return !combinedHttpUrlBlocklist.any { url.contains(it, ignoreCase = true) }
    }

    override fun shouldTrackHttpHeader(key: String): Boolean {
        return !combinedHttpHeadersBlocklist.any { key.contains(it, ignoreCase = true) }
    }

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
