package sh.measure.android.config

/**
 * Defines all the configuration options for the Measure SDK.
 */
internal interface IMeasureConfig {
    /**
     * Whether to capture a screenshot of the app when it crashes due to an unhandled exception or
     * ANR. Defaults to `true`.
     */
    val trackScreenshotOnCrash: Boolean

    /**
     * The level of masking to apply to the screenshot. Defaults to [ScreenshotMaskLevel.AllTextAndMedia].
     */
    val screenshotMaskLevel: ScreenshotMaskLevel

    /**
     * The color of the mask to apply to the screenshot. The value should be a hex color string.
     * For example, "#222222".
     */
    val screenshotMaskHexColor: String

    /**
     * The compression quality of the screenshot. Must be between 0 and 100, where 0 is lowest quality
     * and smallest size while 100 is highest quality and largest size.
     */
    val screenshotCompressionQuality: Int

    /**
     * Whether to capture http headers of a network request and response. Defaults to `false`.
     */
    val enableHttpHeaders: Boolean

    /**
     * Whether to capture http body of a network request and response. Defaults to `false`.
     */
    val enableHttpBody: Boolean

    /**
     * List of HTTP headers to not capture for network request and response. Defaults to an empty
     * list.
     *
     * Internally, this list is combined with [restrictedHttpHeadersBlocklist] to form the final
     * blocklist.
     */
    val httpHeadersBlocklist: List<String>

    /**
     * List of HTTP URLs to not capture for network request and response. Defaults to an empty list.
     *
     * Internally, this list is combined with [restrictedHttpUrlBlocklist] to form the final
     * blocklist.
     */
    val httpUrlBlocklist: List<String>

    /**
     * Whether to capture lifecycle activity intent data. Defaults to `false`.
     */
    val trackLifecycleActivityIntentData: Boolean

    /**
     * Whether to capture intent data for the activity launched as part of a cold launch. Defaults
     * to `false`.
     */
    val trackColdLaunchIntentData: Boolean

    /**
     * Whether to capture intent data for the activity launched as part of a warm launch. Defaults
     * to `false`.
     */
    val trackWarmLaunchIntentData: Boolean

    /**
     * Whether to capture intent data for the activity launched as part of a hot launch. Defaults
     * to `false`.
     */
    val trackHotLaunchIntentData: Boolean

    /**
     * The maximum size of attachments allowed in a single batch. Defaults to 3MB
     */
    val maxEventsAttachmentSizeInBatchBytes: Int

    /**
     * The interval at which to create a batch for export.
     */
    val eventsBatchingIntervalMs: Long

    /**
     * The maximum number of events to export in /events API. Defaults to 500.
     */
    val maxEventsInBatch: Int

    /**
     * When `httpBodyCapture` is enabled, this determines whether to capture the body or not based
     * on the content type of the request/response. Defaults to `application/json`.
     */
    val httpContentTypeAllowlist: List<String>

    /**
     * List of HTTP headers to not capture for network request and response.
     */
    val restrictedHttpHeadersBlocklist: List<String>

    /**
     * List of HTTP URLs to not capture for network request and response.
     *
     * // TODO: describe the logic of how the URLs are matched.
     */
    val restrictedHttpUrlBlocklist: List<String>
}

class MeasureConfig(
    override val trackScreenshotOnCrash: Boolean = true,
    override val screenshotMaskLevel: ScreenshotMaskLevel = ScreenshotMaskLevel.AllTextAndMedia,
    override val enableHttpHeaders: Boolean = false,
    override val enableHttpBody: Boolean = false,
    override val httpHeadersBlocklist: List<String> = emptyList(),
    override val httpUrlBlocklist: List<String> = emptyList(),
    override val trackLifecycleActivityIntentData: Boolean = false,
    override val trackColdLaunchIntentData: Boolean = false,
    override val trackWarmLaunchIntentData: Boolean = false,
    override val trackHotLaunchIntentData: Boolean = false,
) : IMeasureConfig {
    override val screenshotMaskHexColor: String = "#222222"
    override val screenshotCompressionQuality: Int = 25
    override val maxEventsAttachmentSizeInBatchBytes: Int = 3
    override val eventsBatchingIntervalMs: Long = 30_000 // 30 seconds
    override val maxEventsInBatch: Int = 500
    override val httpContentTypeAllowlist: List<String> = listOf("application/json")
    override val restrictedHttpHeadersBlocklist: List<String> = listOf(
        "Authorization",
        "Cookie",
        "Set-Cookie",
        "Proxy-Authorization",
        "WWW-Authenticate",
        "X-Api-Key",
    )
    override val restrictedHttpUrlBlocklist: List<String> = listOf(
        // TODO(abhay): review this list to block all measure API endpoints.
        "api.measure.sh",
        "10.0.2.2:8080/events",
    )
}