package sh.measure.android.config

import sh.measure.android.events.EventType

internal interface ConfigProvider : IMeasureConfig, InternalConfig {
    fun shouldTrackHttpBody(url: String, contentType: String?): Boolean
    fun shouldTrackHttpUrl(url: String): Boolean
    fun shouldTrackHttpHeader(key: String): Boolean

    /**
     * Sets the measure URL so that it can added to the httpUrlBlocklist. Required as it can be any
     * URL when the SDK is running in self-hosted mode.
     */
    fun setMeasureUrl(url: String)
}

internal class ConfigProviderImpl(defaultConfig: Config) : ConfigProvider {
    override val enableLogging: Boolean = defaultConfig.enableLogging
    override val trackScreenshotOnCrash: Boolean = defaultConfig.trackScreenshotOnCrash
    override val screenshotMaskLevel: ScreenshotMaskLevel = defaultConfig.screenshotMaskLevel
    override val screenshotMaskHexColor: String = defaultConfig.screenshotMaskHexColor
    override val screenshotCompressionQuality: Int = defaultConfig.screenshotCompressionQuality
    override val eventTypeExportAllowList: List<EventType> = defaultConfig.eventTypeExportAllowList
    override val trackHttpHeaders: Boolean = defaultConfig.trackHttpHeaders
    override val trackHttpBody: Boolean = defaultConfig.trackHttpBody
    override val httpHeadersBlocklist: List<String> = defaultConfig.httpHeadersBlocklist
    override val httpUrlBlocklist: List<String> = defaultConfig.httpUrlBlocklist
    override val httpUrlAllowlist: List<String> = defaultConfig.httpUrlAllowlist
    override val trackActivityIntentData: Boolean = defaultConfig.trackActivityIntentData
    override val samplingRateForErrorFreeSessions: Float =
        defaultConfig.samplingRateForErrorFreeSessions
    override val traceSamplingRate: Float = defaultConfig.traceSamplingRate
    override val eventsBatchingIntervalMs: Long = defaultConfig.eventsBatchingIntervalMs
    override val eventsBatchingJitterMs: Long = defaultConfig.eventsBatchingJitterMs
    override val maxEventsInBatch: Int = defaultConfig.maxEventsInBatch
    override val httpContentTypeAllowlist: List<String> = defaultConfig.httpContentTypeAllowlist
    override val defaultHttpHeadersBlocklist: List<String> =
        defaultConfig.defaultHttpHeadersBlocklist
    override val sessionBackgroundTimeoutThresholdMs: Long =
        defaultConfig.sessionBackgroundTimeoutThresholdMs
    override val maxAttachmentSizeInEventsBatchInBytes: Int =
        defaultConfig.maxAttachmentSizeInEventsBatchInBytes
    override val maxEventNameLength: Int = defaultConfig.maxEventNameLength
    override val maxUserDefinedAttributeKeyLength: Int =
        defaultConfig.maxUserDefinedAttributeKeyLength
    override val maxUserDefinedAttributeValueLength: Int =
        defaultConfig.maxUserDefinedAttributeValueLength
    override val autoStart: Boolean = defaultConfig.autoStart
    override val maxSpanNameLength: Int = defaultConfig.maxSpanNameLength
    override val maxCheckpointNameLength: Int = defaultConfig.maxCheckpointNameLength
    override val maxCheckpointsPerSpan: Int = defaultConfig.maxCheckpointsPerSpan
    override val customEventNameRegex: String = defaultConfig.customEventNameRegex
    override val maxUserDefinedAttributesPerEvent: Int =
        defaultConfig.maxUserDefinedAttributesPerEvent
    override val maxInMemorySignalsQueueSize: Int = defaultConfig.maxInMemorySignalsQueueSize
    override val inMemorySignalsQueueFlushRateMs: Long =
        defaultConfig.inMemorySignalsQueueFlushRateMs
    override val maxAttachmentsInBugReport: Int = defaultConfig.maxAttachmentsInBugReport
    override val maxDescriptionLengthInBugReport: Int =
        defaultConfig.maxDescriptionLengthInBugReport
    override val shakeMinTimeIntervalMs: Long = defaultConfig.shakeMinTimeIntervalMs
    override val shakeAccelerationThreshold: Float = defaultConfig.shakeAccelerationThreshold
    override val shakeSlop: Int = defaultConfig.shakeSlop
    override val disallowedCustomHeaders: List<String> = defaultConfig.disallowedCustomHeaders
    override val requestHeadersProvider: MsrRequestHeadersProvider? =
        defaultConfig.requestHeadersProvider
    override val maxDiskUsageInMb: Int = defaultConfig.maxDiskUsageInMb
    override val estimatedEventSizeInKb: Int = defaultConfig.estimatedEventSizeInKb
    override val coldLaunchSamplingRate: Float = defaultConfig.coldLaunchSamplingRate
    override val warmLaunchSamplingRate: Float = defaultConfig.warmLaunchSamplingRate
    override val hotLaunchSamplingRate: Float = defaultConfig.hotLaunchSamplingRate
    override val journeySamplingRate: Float = defaultConfig.journeySamplingRate

    // The combined url blocklist of [defaultHttpUrlBlocklist] and [httpUrlBlocklist].
    private val combinedHttpUrlBlocklist: MutableList<String?> = httpUrlBlocklist.toMutableList()
    private val combinedHttpHeadersBlocklist = defaultHttpHeadersBlocklist + httpHeadersBlocklist


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

    override fun shouldTrackHttpHeader(key: String): Boolean =
        !combinedHttpHeadersBlocklist.any { key.contains(it, ignoreCase = true) }

    override fun setMeasureUrl(url: String) {
        combinedHttpUrlBlocklist.add(url)
    }
}
