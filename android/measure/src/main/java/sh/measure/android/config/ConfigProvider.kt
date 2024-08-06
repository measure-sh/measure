package sh.measure.android.config

import androidx.annotation.VisibleForTesting
import java.util.concurrent.locks.ReentrantReadWriteLock
import kotlin.concurrent.read
import kotlin.concurrent.write

internal interface ConfigProvider : IMeasureConfig, InternalConfig {
    fun loadNetworkConfig()
    fun shouldTrackHttpBody(url: String, contentType: String?): Boolean
    fun shouldTrackHttpUrl(url: String): Boolean
    fun shouldTrackHttpHeader(key: String): Boolean

    /**
     * Sets the measure URL so that it can added to the httpUrlBlocklist. Required as it can be any
     * URL when the SDK is running in self-hosted mode.
     */
    fun setMeasureUrl(url: String)
}

internal class ConfigProviderImpl(
    private val defaultConfig: Config,
    private val configLoader: ConfigLoader,
) : ConfigProvider {
    private var cachedConfig: Config? = null

    @VisibleForTesting
    internal var networkConfig: Config? = null
    private val networkConfigLock = ReentrantReadWriteLock()

    // The combined url blocklist of [defaultHttpUrlBlocklist] and [httpUrlBlocklist].
    private val combinedHttpUrlBlocklist: MutableList<String?> = httpUrlBlocklist.toMutableList()
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

    override val enableLogging: Boolean
        get() = getMergedConfig { enableLogging }
    override val trackScreenshotOnCrash: Boolean
        get() = getMergedConfig { trackScreenshotOnCrash }
    override val screenshotMaskLevel: ScreenshotMaskLevel
        get() = getMergedConfig { screenshotMaskLevel }
    override val screenshotMaskHexColor: String
        get() = getMergedConfig { screenshotMaskHexColor }
    override val screenshotCompressionQuality: Int
        get() = getMergedConfig { screenshotCompressionQuality }
    override val eventTypeExportAllowList: List<String>
        get() = getMergedConfig { eventTypeExportAllowList }
    override val maxEventsInDatabase: Int
        get() = getMergedConfig { maxEventsInDatabase }
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
    override val sessionSamplingRate: Float
        get() = getMergedConfig { sessionSamplingRate }
    override val eventsBatchingIntervalMs: Long
        get() = getMergedConfig { eventsBatchingIntervalMs }
    override val maxEventsInBatch: Int
        get() = getMergedConfig { maxEventsInBatch }
    override val httpContentTypeAllowlist: List<String>
        get() = getMergedConfig { httpContentTypeAllowlist }
    override val defaultHttpHeadersBlocklist: List<String>
        get() = getMergedConfig { defaultHttpHeadersBlocklist }
    override val sessionEndThresholdMs: Long
        get() = getMergedConfig { sessionEndThresholdMs }
    override val maxAttachmentSizeInEventsBatchInBytes: Int
        get() = getMergedConfig { maxAttachmentSizeInEventsBatchInBytes }
    override val maxUserDefinedAttributeKeyLength: Int
        get() = getMergedConfig { maxUserDefinedAttributeKeyLength }
    override val maxUserDefinedAttributeValueLength: Int
        get() = getMergedConfig { maxUserDefinedAttributeValueLength }
    override val userDefinedAttributeKeyWithSpaces: Boolean
        get() = getMergedConfig { userDefinedAttributeKeyWithSpaces }

    override fun shouldTrackHttpBody(url: String, contentType: String?): Boolean {
        if (contentType.isNullOrEmpty()) {
            return false
        }
        if (combinedHttpUrlBlocklist.any { value -> value?.let { url.contains(it, ignoreCase = true) } == true }) {
            return false
        }
        return httpContentTypeAllowlist.any { contentType.startsWith(it, ignoreCase = true) }
    }

    override fun shouldTrackHttpUrl(url: String): Boolean {
        return !combinedHttpUrlBlocklist.any { value ->
            value?.let { url.contains(it, ignoreCase = true) } ?: false
        }
    }

    override fun shouldTrackHttpHeader(key: String): Boolean {
        return !combinedHttpHeadersBlocklist.any { key.contains(it, ignoreCase = true) }
    }

    override fun setMeasureUrl(url: String) {
        combinedHttpUrlBlocklist.add(url)
    }

    private fun <T> getMergedConfig(selector: Config.() -> T): T {
        if (networkConfig != null) {
            networkConfigLock.read {
                return networkConfig?.selector() ?: cachedConfig?.selector()
                    ?: defaultConfig.selector()
            }
        }
        return cachedConfig?.selector() ?: defaultConfig.selector()
    }
}
