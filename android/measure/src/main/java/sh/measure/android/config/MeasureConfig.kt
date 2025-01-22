package sh.measure.android.config

import sh.measure.android.Measure

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
    val httpUrlAllowlist: List<String>
    val trackActivityIntentData: Boolean
    val samplingRateForErrorFreeSessions: Float
    val autoStart: Boolean
    val traceSamplingRate: Float
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
     * want to collect data for certain endpoints.
     *
     * The check is made using [String.contains] to see if the URL contains any of the strings in
     * the list.
     *
     * Note that this config is ignored if [httpUrlAllowlist] is set.
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
     * Allows enabling collection of `http` events for only certain URLs. This is useful to setup if you do not
     * want to collect data for all endpoints except for a few.
     *
     * The check is made using [String.contains] to see if the URL contains any of the strings in
     * the list.
     *
     * Example:
     *
     * ```kotlin
     * MeasureConfig(
     *    httpUrlAllowlist = listOf(
     *      "example.com", // enables a domain
     *      "api.example.com", // enable a subdomain
     *      "example.com/order" // enable a particular path
     *    )
     * )
     */
    override val httpUrlAllowlist: List<String> = DefaultConfig.HTTP_URL_ALLOWLIST,

    /**
     * Whether to capture intent data used to launch an Activity. Defaults to `false`.
     */
    override val trackActivityIntentData: Boolean = DefaultConfig.TRACK_ACTIVITY_INTENT_DATA,

    /**
     * Sampling rate for sessions without a crash or ANR.
     *
     * The sampling rate is a value between 0 and 1. For example, a value of `0.5` will export
     * only 50% of the non-crashed sessions, a value of `0` will disable send non-crashed
     * sessions to the server.
     *
     * Setting a value outside the range will throw an [IllegalArgumentException].
     */
    override val samplingRateForErrorFreeSessions: Float = DefaultConfig.SESSION_SAMPLING_RATE,

    /**
     * Set to false to delay starting the SDK, by default initializing the SDK also starts tracking.
     *
     * Defaults to true.
     *
     * @see Measure.start to start the SDK.
     */
    override val autoStart: Boolean = DefaultConfig.AUTO_START,

    /**
     * Allows setting a sampling rate for traces. Defaults to 0.1.
     *
     * The sampling rate is a value between 0 and 1. For example, a value of `0.1` will export
     * only 10% of all traces, a value of `0` will disable exporting of traces.
     *
     * Setting a value outside the range will throw an [IllegalArgumentException].
     */
    override val traceSamplingRate: Float = DefaultConfig.TRACE_SAMPLING_RATE,
) : IMeasureConfig {
    init {
        require(samplingRateForErrorFreeSessions in 0.0..1.0) {
            "session sampling rate must be between 0.0 and 1.0"
        }

        require(traceSamplingRate in 0.0..1.0) {
            "Trace sampling rate must be between 0.0 and 1.0"
        }
    }
}
