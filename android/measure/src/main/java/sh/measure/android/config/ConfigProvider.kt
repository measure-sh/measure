package sh.measure.android.config

internal interface ConfigProvider :
    IMeasureConfig,
    InternalConfig,
    IDynamicConfig {
    fun shouldTrackHttpEvent(url: String): Boolean
    fun shouldTrackHttpRequestBody(url: String): Boolean
    fun shouldTrackHttpResponseBody(url: String): Boolean
    fun shouldTrackHttpHeader(key: String): Boolean

    fun setDynamicConfig(config: DynamicConfig)
}

/**
 * Implementation of [ConfigProvider] that manages both static and dynamic configuration.
 *
 * ## Configuration Types
 *
 * **Static configuration** is provided at initialization via [Config] and remains constant
 * throughout the SDK's lifecycle. These values are accessed directly as properties.
 *
 * **Dynamic configuration** is loaded asynchronously and updated via [ConfigProvider.setDynamicConfig].
 *
 * ## Thread Safety
 *
 * This class is designed for concurrent access from multiple threads:
 *
 * - **Writes** ([setDynamicConfig]) are synchronized via a lock to ensure atomic updates of
 *   related fields.
 *
 * - **Reads** ([shouldTrackHttpEvent], [shouldTrackHttpRequestBody], etc.) are lock-free
 *   and use a single volatile reference to [HttpPatternState].
 *
 * ## HTTP Pattern Matching
 *
 * URL patterns support `*` as a wildcard matching any sequence of characters. Patterns are
 * pre-compiled to [Regex] objects when configuration is loaded to avoid repeated compilation
 * on every HTTP event. For example, `https://api.example.com/\*` compiles to
 * `^https://api\.example\.com/.*$`.
 */
internal class ConfigProviderImpl(defaultConfig: Config) : ConfigProvider {
    private data class HttpPatternState(
        val disableEventPatterns: List<Regex>,
        val trackRequestPatterns: List<Regex>,
        val trackResponsePatterns: List<Regex>,
        val blockedHeaders: List<String>,
    )

    private val lock = Any()

    @Volatile
    private var dynamicConfig: DynamicConfig = DynamicConfig()

    @Volatile
    private var httpPatternState: HttpPatternState = HttpPatternState(
        disableEventPatterns = emptyList(),
        trackRequestPatterns = emptyList(),
        trackResponsePatterns = emptyList(),
        blockedHeaders = emptyList(),
    )

    override val enableLogging: Boolean = defaultConfig.enableLogging
    override val screenshotMaskHexColor: String = defaultConfig.screenshotMaskHexColor
    override val screenshotCompressionQuality: Int = defaultConfig.screenshotCompressionQuality
    override val batchExportIntervalMs: Long = defaultConfig.batchExportIntervalMs
    override val attachmentExportIntervalMs: Long = defaultConfig.attachmentExportIntervalMs
    override val defaultHttpHeadersBlocklist: List<String> =
        defaultConfig.defaultHttpHeadersBlocklist
    override val sessionBackgroundTimeoutThresholdMs: Long =
        defaultConfig.sessionBackgroundTimeoutThresholdMs
    override val maxEventNameLength: Int = defaultConfig.maxEventNameLength
    override val maxUserDefinedAttributeKeyLength: Int =
        defaultConfig.maxUserDefinedAttributeKeyLength
    override val maxUserDefinedAttributeValueLength: Int =
        defaultConfig.maxUserDefinedAttributeValueLength
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
    override val estimatedEventSizeInKb: Int = defaultConfig.estimatedEventSizeInKb
    override val autoStart: Boolean = defaultConfig.autoStart
    override val maxDiskUsageInMb: Int = defaultConfig.maxDiskUsageInMb
    override val trackActivityIntentData: Boolean = defaultConfig.trackActivityIntentData
    override val requestHeadersProvider: MsrRequestHeadersProvider? =
        defaultConfig.requestHeadersProvider
    override val enableFullCollectionMode: Boolean = defaultConfig.enableFullCollectionMode
    override val enableDiagnosticMode: Boolean = defaultConfig.enableDiagnosticMode

    // Dynamic config properties - use getters so they reflect current dynamicConfig state
    override val maxEventsInBatch: Int
        get() = dynamicConfig.maxEventsInBatch
    override val crashTimelineDurationSeconds: Int
        get() = dynamicConfig.crashTimelineDurationSeconds
    override val anrTimelineDurationSeconds: Int
        get() = dynamicConfig.anrTimelineDurationSeconds
    override val bugReportTimelineDurationSeconds: Int
        get() = dynamicConfig.bugReportTimelineDurationSeconds
    override val traceSamplingRate: Float
        get() = dynamicConfig.traceSamplingRate
    override val journeySamplingRate: Float
        get() = dynamicConfig.journeySamplingRate
    override val screenshotMaskLevel: ScreenshotMaskLevel
        get() = dynamicConfig.screenshotMaskLevel
    override val cpuUsageInterval: Long
        get() = dynamicConfig.cpuUsageInterval
    override val memoryUsageInterval: Long
        get() = dynamicConfig.memoryUsageInterval
    override val crashTakeScreenshot: Boolean
        get() = dynamicConfig.crashTakeScreenshot
    override val anrTakeScreenshot: Boolean
        get() = dynamicConfig.anrTakeScreenshot
    override val launchSamplingRate: Float
        get() = dynamicConfig.launchSamplingRate
    override val gestureClickTakeSnapshot: Boolean
        get() = dynamicConfig.gestureClickTakeSnapshot
    override val httpDisableEventForUrls: List<String>
        get() = dynamicConfig.httpDisableEventForUrls.toList()
    override val httpSamplingRate: Float
        get() = dynamicConfig.httpSamplingRate
    override val httpTrackRequestForUrls: List<String>
        get() = dynamicConfig.httpTrackRequestForUrls.toList()
    override val httpTrackResponseForUrls: List<String>
        get() = dynamicConfig.httpTrackResponseForUrls.toList()
    override val httpBlockedHeaders: List<String>
        get() = dynamicConfig.httpBlockedHeaders.toList()

    override fun shouldTrackHttpEvent(url: String): Boolean {
        val state = httpPatternState
        return !state.disableEventPatterns.any { it.matches(url) }
    }

    override fun shouldTrackHttpRequestBody(url: String): Boolean {
        val state = httpPatternState
        return state.trackRequestPatterns.any { it.matches(url) }
    }

    override fun shouldTrackHttpResponseBody(url: String): Boolean {
        val state = httpPatternState
        return state.trackResponsePatterns.any { it.matches(url) }
    }

    override fun shouldTrackHttpHeader(key: String): Boolean {
        val state = httpPatternState
        return defaultHttpHeadersBlocklist.none { it.equals(key, ignoreCase = true) } &&
            state.blockedHeaders.none { it.equals(key, ignoreCase = true) }
    }

    override fun setDynamicConfig(config: DynamicConfig) {
        synchronized(lock) {
            dynamicConfig = config
            httpPatternState = HttpPatternState(
                disableEventPatterns = config.httpDisableEventForUrls.map { compilePattern(it) },
                trackRequestPatterns = config.httpTrackRequestForUrls.map { compilePattern(it) },
                trackResponsePatterns = config.httpTrackResponseForUrls.map { compilePattern(it) },
                blockedHeaders = config.httpBlockedHeaders.toList(),
            )
        }
    }

    private fun compilePattern(pattern: String): Regex {
        val regexPattern = if (pattern.contains("*")) {
            pattern.split("*").joinToString(".*") { Regex.escape(it) }
        } else {
            Regex.escape(pattern)
        }
        return Regex("^$regexPattern$", RegexOption.IGNORE_CASE)
    }
}
