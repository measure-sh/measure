package sh.measure.android.config

/**
 * Configuration for the Measure SDK. See [MeasureConfig] for details.
 */
internal interface IMeasureConfig {
    val enableLogging: Boolean
    val trackScreenshotOnCrash: Boolean
    val screenshotMaskLevel: ScreenshotMaskLevel
    val trackHttpHeaders: Boolean
    val trackHttpBody: Boolean
    val httpHeadersBlocklist: List<String>
    val httpUrlBlocklist: List<String>
    val trackActivityIntentData: Boolean
    val sessionSamplingRate: Float
}

/**
 * Configuration options for the Measure SDK. Used to customize the behavior of the SDK on
 * initialization.
 */
class MeasureConfig(
    /**
     * Enable or disable internal SDK logs. Defaults to `false`.
     */
    override val enableLogging: Boolean = DefaultConfig.ENABLE_LOGGING,
    /**
     * Whether to capture a screenshot of the app when it crashes due to an unhandled exception or
     * ANR. Defaults to `true`.
     */
    override val trackScreenshotOnCrash: Boolean = DefaultConfig.TRACK_SCREENSHOT_ON_CRASH,

    /**
     * Allows changing the masking level of screenshots to prevent sensitive information from leaking.
     * Defaults to [ScreenshotMaskLevel.AllTextAndMedia].
     */
    override val screenshotMaskLevel: ScreenshotMaskLevel = DefaultConfig.SCREENSHOT_MASK_LEVEL,

    /**
     * Whether to capture http headers of a network request and response. Defaults to `false`.
     */
    override val trackHttpHeaders: Boolean = DefaultConfig.TRACK_HTTP_HEADERS,

    /**
     * Whether to capture http body of a network request and response. Defaults to `false`.
     */
    override val trackHttpBody: Boolean = DefaultConfig.TRACK_HTTP_BODY,

    /**
     * List of HTTP headers to not collect with the `http` event for both request and response.
     * Defaults to an empty list. The following headers are always excluded:
     * * Authorization
     * * Cookie
     * * Set-Cookie
     * * Proxy-Authorization
     * * WWW-Authenticate
     * * X-Api-Key
     */
    override val httpHeadersBlocklist: List<String> = DefaultConfig.HTTP_HEADERS_BLOCKLIST,

    /**
     * Allows disabling collection of `http` events for certain URLs. This is useful to setup if you do not
     * want to collect data for certain endpoints or third party domains.
     *
     * The check is made using [String.contains] to see if the URL contains any of the strings in
     * the list.
     *
     * Example:
     *
     * ```kotlin
     * MeasureConfig(
     *     httpUrlBlocklist = listOf(
     *         "example.com", // disables a domain
     *         "api.example.com", // disable a subdomain
     *         "example.com/order" // disable a particular path
     *     )
     * )
     * ```
     */
    override val httpUrlBlocklist: List<String> = DefaultConfig.HTTP_URL_BLOCKLIST,

    /**
     * Whether to capture intent data used to launch an Activity. Defaults to `false`.
     */
    override val trackActivityIntentData: Boolean = DefaultConfig.TRACK_ACTIVITY_INTENT_DATA,

    /**
     * Allows setting a sampling rate for non-crashed sessions. By default, all non-crashed
     * sessions are always exported. Non-crashed sessions are ones which did not end due to an
     * unhandled exception or ANR.
     *
     * The sampling rate is a value between 0 and 1. For example, a value of `0.5` will export only 50%
     * of the non-crashed sessions, a value of `0` will disable exporting of non-crashed sessions.
     *
     * Setting a value outside the range will throw an [IllegalArgumentException].
     */
    override val sessionSamplingRate: Float = DefaultConfig.SESSION_SAMPLING_RATE,
) : IMeasureConfig {
    init {
        require(sessionSamplingRate in 0.0..1.0) {
            "Session sampling rate must be between 0.0 and 1.0"
        }
    }
}
