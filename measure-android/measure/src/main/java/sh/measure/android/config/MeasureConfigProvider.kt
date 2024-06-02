package sh.measure.android.config

internal class MeasureConfigProvider(private val defaultConfig: MeasureConfig) : IMeasureConfig {
    private var cachedConfig: MeasureConfig? = null
    private var networkConfig: MeasureConfig? = null

    fun loadCachedConfig() {

    }

    fun loadNetworkConfig() {

    }

    override val trackScreenshotOnCrash: Boolean
        get() = networkConfig?.trackScreenshotOnCrash ?: cachedConfig?.trackScreenshotOnCrash
        ?: defaultConfig.trackScreenshotOnCrash
    override val screenshotMaskLevel: ScreenshotMaskLevel
        get() = networkConfig?.screenshotMaskLevel ?: cachedConfig?.screenshotMaskLevel
        ?: defaultConfig.screenshotMaskLevel
    override val enableHttpHeadersCapture: Boolean
        get() = TODO("Not yet implemented")
    override val enableHttpBodyCapture: Boolean
        get() = TODO("Not yet implemented")
    override val httpHeadersBlocklist: List<String>
        get() = TODO("Not yet implemented")
    override val httpUrlBlocklist: List<String>
        get() = TODO("Not yet implemented")
    override val trackLifecycleActivityIntent: Boolean
        get() = TODO("Not yet implemented")
    override val trackColdLaunchIntent: Boolean
        get() = TODO("Not yet implemented")
    override val trackWarmLaunchIntent: Boolean
        get() = TODO("Not yet implemented")
    override val trackHotLaunchIntent: Boolean
        get() = TODO("Not yet implemented")
    override val maxEventsBatchSizeMb: Int
        get() = TODO("Not yet implemented")
    override val eventsBatchingIntervalMs: Long
        get() = TODO("Not yet implemented")
    override val maxEventsInBatch: Int
        get() = TODO("Not yet implemented")
    override val httpContentTypeAllowlist: List<String>
        get() = TODO("Not yet implemented")
    override val restrictedHttpHeadersBlocklist: List<String>
        get() = TODO("Not yet implemented")
    override val restrictedHttpUrlBlocklist: List<String>
        get() = TODO("Not yet implemented")
}