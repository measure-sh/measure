package sh.measure.android.config

class MeasureConfig(
    /**
     * Whether to capture a screenshot of the app when it crashes due to an unhandled exception or
     * ANR. Defaults to `true`.
     */
    val trackScreenshotOnCrash: Boolean = true,

    /**
     * The level of masking to apply to the screenshot. Defaults to [ScreenshotMaskLevel.AllTextAndMedia].
     */
    val screenshotMaskLevel: ScreenshotMaskLevel = ScreenshotMaskLevel.AllTextAndMedia,

    /**
     * Whether to capture http headers of a network request and response. Defaults to `false`.
     */
    val enableHttpHeadersCapture: Boolean = false,

    /**
     * Whether to capture http body of a network request and response. Defaults to `false`.
     */
    val enableHttpBodyCapture: Boolean = false,

    /**
     * List of HTTP headers to not capture for network request and response. Defaults to an empty
     * list.
     *
     * Internally, this list is combined with [restrictedHttpHeadersBlocklist] to form the final
     * blocklist.
     */
    val httpHeadersBlocklist: List<String> = emptyList(),

    /**
     * List of HTTP URLs to not capture for network request and response. Defaults to an empty list.
     *
     * Internally, this list is combined with [restrictedHttpUrlBlocklist] to form the final
     * blocklist.
     */
    val httpUrlBlocklist: List<String> = emptyList(),

    /**
     * Whether to capture lifecycle activity intent data. Defaults to `false`.
     */
    val trackLifecycleActivityIntent: Boolean = false,

    /**
     * Whether to capture intent data for the activity launched as part of a cold launch. Defaults
     * to `false`.
     */
    val trackColdLaunchIntent: Boolean = false,

    /**
     * Whether to capture intent data for the activity launched as part of a warm launch. Defaults
     * to `false`.
     */
    val trackWarmLaunchIntent: Boolean = false,

    /**
     * Whether to capture intent data for the activity launched as part of a hot launch. Defaults
     * to `false`.
     */
    val trackHotLaunchIntent: Boolean = false,
) {
    /**
     * The maximum size of a batch to export in /events API, in MB. Defaults to 5 MB.
     */
    val maxEventsBatchSizeMb: Int = 5

    /**
     * The maximum number of events to export in /events API. Defaults to 1000.
     */
    val eventsBatchingIntervalMs: Long = 30_000 // 30 seconds

    /**
     * The maximum number of events to export in /events API. Defaults to 500.
     */
    val maxEventsInBatch: Int = 500

    /**
     * When `httpBodyCapture` is enabled, this determines whether to capture the body or not based
     * on the content type of the request/response. Defaults to `application/json`.
     */
    val httpContentTypeAllowlist: List<String> = listOf("application/json")

    /**
     * List of HTTP headers to not capture for network request and response.
     */
    val restrictedHttpHeadersBlocklist: List<String> = listOf(
        "Authorization",
        "Cookie",
        "Set-Cookie",
        "Proxy-Authorization",
        "WWW-Authenticate",
        "X-Api-Key",
    )

    /**
     * List of HTTP URLs to not capture for network request and response.
     *
     * // TODO: describe the logic of how the URLs are matched.
     */
    val restrictedHttpUrlBlocklist: List<String> = listOf(
        // TODO(abhay): review this list to block all measure API endpoints.
        "api.measure.sh",
        "localhost:8080/events",
    )
}