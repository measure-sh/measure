package sh.measure.android.config

import androidx.annotation.VisibleForTesting
import sh.measure.android.events.EventType
import java.util.concurrent.locks.ReentrantReadWriteLock
import kotlin.concurrent.read
import kotlin.concurrent.write

internal interface ConfigProvider :
    IMeasureConfig,
    InternalConfig {
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
    override val eventTypeExportAllowList: List<EventType>
        get() = getMergedConfig { eventTypeExportAllowList }
    override val trackHttpHeaders: Boolean
        get() = getMergedConfig { trackHttpHeaders }
    override val trackHttpBody: Boolean
        get() = getMergedConfig { trackHttpBody }
    override val httpHeadersBlocklist: List<String>
        get() = getMergedConfig { httpHeadersBlocklist }
    override val httpUrlBlocklist: List<String>
        get() = getMergedConfig { httpUrlBlocklist }
    override val httpUrlAllowlist: List<String>
        get() = getMergedConfig { httpUrlAllowlist }
    override val trackActivityIntentData: Boolean
        get() = getMergedConfig { trackActivityIntentData }
    override val samplingRateForErrorFreeSessions: Float
        get() = getMergedConfig { samplingRateForErrorFreeSessions }
    override val traceSamplingRate: Float
        get() = getMergedConfig { traceSamplingRate }
    override val eventsBatchingIntervalMs: Long
        get() = getMergedConfig { eventsBatchingIntervalMs }
    override val eventsBatchingJitterMs: Long
        get() = getMergedConfig { eventsBatchingJitterMs }
    override val maxEventsInBatch: Int
        get() = getMergedConfig { maxEventsInBatch }
    override val httpContentTypeAllowlist: List<String>
        get() = getMergedConfig { httpContentTypeAllowlist }
    override val defaultHttpHeadersBlocklist: List<String>
        get() = getMergedConfig { defaultHttpHeadersBlocklist }
    override val sessionEndLastEventThresholdMs: Long
        get() = getMergedConfig { sessionEndLastEventThresholdMs }
    override val maxAttachmentSizeInEventsBatchInBytes: Int
        get() = getMergedConfig { maxAttachmentSizeInEventsBatchInBytes }
    override val maxEventNameLength: Int
        get() = getMergedConfig { maxEventNameLength }
    override val maxUserDefinedAttributeKeyLength: Int
        get() = getMergedConfig { maxUserDefinedAttributeKeyLength }
    override val maxUserDefinedAttributeValueLength: Int
        get() = getMergedConfig { maxUserDefinedAttributeValueLength }
    override val autoStart: Boolean
        get() = getMergedConfig { autoStart }
    override val maxSpanNameLength: Int
        get() = getMergedConfig { maxSpanNameLength }
    override val maxCheckpointNameLength: Int
        get() = getMergedConfig { maxCheckpointNameLength }
    override val maxCheckpointsPerSpan: Int
        get() = getMergedConfig { maxCheckpointsPerSpan }
    override val customEventNameRegex: String
        get() = getMergedConfig { customEventNameRegex }
    override val maxUserDefinedAttributesPerEvent: Int
        get() = getMergedConfig { maxUserDefinedAttributesPerEvent }
    override val maxInMemorySignalsQueueSize: Int
        get() = getMergedConfig { maxInMemorySignalsQueueSize }
    override val inMemorySignalsQueueFlushRateMs: Long
        get() = getMergedConfig { inMemorySignalsQueueFlushRateMs }
    override val maxAttachmentsInBugReport: Int
        get() = getMergedConfig { maxAttachmentsInBugReport }
    override val maxDescriptionLengthInBugReport: Int
        get() = getMergedConfig { maxDescriptionLengthInBugReport }
    override val shakeMinTimeIntervalMs: Long
        get() = getMergedConfig { shakeMinTimeIntervalMs }
    override val shakeAccelerationThreshold: Float
        get() = getMergedConfig { shakeAccelerationThreshold }
    override val shakeSlop: Int
        get() = getMergedConfig { shakeSlop }
    override val disallowedCustomHeaders: List<String>
        get() = getMergedConfig { disallowedCustomHeaders }
    override val requestHeadersProvider: MsrRequestHeadersProvider?
        get() = getMergedConfig { requestHeadersProvider }
    override val maxDiskUsageInMb: Int
        get() = getMergedConfig { maxDiskUsageInMb }
    override val estimatedEventSizeInKb: Int
        get() = getMergedConfig { estimatedEventSizeInKb }
    override val coldLaunchSamplingRate: Float
        get() = getMergedConfig { coldLaunchSamplingRate }
    override val warmLaunchSamplingRate: Float
        get() = getMergedConfig { warmLaunchSamplingRate }
    override val hotLaunchSamplingRate: Float
        get() = getMergedConfig { hotLaunchSamplingRate }
    override val journeySamplingRate: Float
        get() = getMergedConfig { journeySamplingRate }

    override fun shouldTrackHttpBody(url: String, contentType: String?): Boolean {
        if (!trackHttpBody) {
            return false
        }

        if (contentType.isNullOrEmpty()) {
            return false
        }

        // make sure no body is tracked if the URL is not tracked
        if (!shouldTrackHttpUrl(url)) {
            return false
        }

        return httpContentTypeAllowlist.any { contentType.startsWith(it, ignoreCase = true) }
    }

    override fun shouldTrackHttpUrl(url: String): Boolean {
        // If the allowlist is not empty, then only allow the URLs that are in the allowlist.
        if (httpUrlAllowlist.isNotEmpty()) {
            return httpUrlAllowlist.any { url.contains(it, ignoreCase = true) }
        }

        // If the allowlist is empty, then block the URLs that are in the blocklist.
        return !combinedHttpUrlBlocklist.any { value ->
            value?.let { url.contains(it, ignoreCase = true) } == true
        }
    }

    override fun shouldTrackHttpHeader(key: String): Boolean = !combinedHttpHeadersBlocklist.any { key.contains(it, ignoreCase = true) }

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
