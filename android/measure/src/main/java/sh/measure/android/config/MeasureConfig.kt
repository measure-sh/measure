@file:Suppress("KotlinConstantConditions")

package sh.measure.android.config

import android.annotation.SuppressLint
import androidx.annotation.Keep
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import sh.measure.android.Measure
import sh.measure.android.serialization.jsonSerializer
import sh.measure.android.utils.toJsonElement

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
    val trackActivityLoadTime: Boolean
    val trackFragmentLoadTime: Boolean
    val maxDiskUsageInMb: Int
    val requestHeadersProvider: MsrRequestHeadersProvider?
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

    /**
     * Enable or disable automatic collection of Activity load time. Defaults to `true`.
     *
     * Activity load time measures the time between the Activity being created and the first
     * frame being drawn on the screen. This is also known as Time to First Frame (TTF) or
     * Time to Initial Display (TTID). A large value for this metric would mean users are waiting
     * for a long time before they see anything on the screen while navigating through the app.
     *
     * Each Activity load time is captured using a span with the name `Activity TTID` followed
     * by the fully qualified class name of the Activity. For example, for
     * `com.example.MainActivity` the span name would be `Activity TTID com.example.MainActivity`.
     */
    override val trackActivityLoadTime: Boolean = DefaultConfig.TRACK_ACTIVITY_LOAD_TIME,

    /**
     * Enable or disable automatic collection of Fragment load time. Defaults to `true`.
     *
     * Fragment load time measures the time between the Fragment view being created and the
     * first frame being drawn on the screen. This is also known as Time to First Frame (TTF)
     * or Time to Initial Display (TTID). A large value for this metric would mean users are
     * waiting for a long time before they see anything on the screen while navigating
     * through the app.
     */
    override val trackFragmentLoadTime: Boolean = DefaultConfig.TRACK_FRAGMENT_LOAD_TIME,

    /**
     * Configures the maximum disk usage in megabytes that the Measure SDK is allowed to use.
     *
     * This is useful to control the amount of disk space used by the SDK for storing session data,
     * crash reports, and other collected information.
     *
     * Defaults to `50MB`. Allowed values are between `20MB` and `1500MB`. Any value outside this
     * range will be clamped to the nearest limit.
     *
     * All Measure SDKs store data to disk and upload it to the server in batches. While the app is
     * in foreground, the data is synced periodically and usually the disk space used by the SDK is
     * low. However, if the device is offline or the server is unreachable, the SDK will continue to
     * store data on disk until it reaches the maximum disk usage limit.
     *
     * Note that the storage usage is not exact and works on estimates and typically the SDK will
     * use much less disk space than the configured limit. When the SDK reaches the maximum disk
     * usage limit, it will start deleting the oldest data to make space for new data.
     */
    override val maxDiskUsageInMb: Int = DefaultConfig.MAX_ESTIMATED_DISK_USAGE_IN_MB,

    /**
     * Allows configuring custom HTTP headers for requests made by the Measure SDK to the
     * Measure API. This is useful only for self-hosted clients who may require additional
     * headers for requests in their infrastructure.
     *
     * See [MsrRequestHeadersProvider] for usage details.
     */
    override val requestHeadersProvider: MsrRequestHeadersProvider? = null,
) : IMeasureConfig {
    init {
        require(samplingRateForErrorFreeSessions in 0.0..1.0) {
            "session sampling rate must be between 0.0 and 1.0"
        }

        require(traceSamplingRate in 0.0..1.0) {
            "Trace sampling rate must be between 0.0 and 1.0"
        }
    }

    companion object {
        /**
         * Allows converting a map of configuration values to a [MeasureConfig] object.
         * This is intended for internal use only by cross-platform frameworks that
         * need to pass the configuration to the native SDK.
         */
        @Keep
        fun fromJson(config: Map<String, Any?>): MeasureConfig {
            val json = config.toJsonElement()
            return jsonSerializer.decodeFromJsonElement(MeasureConfigSerializer, json)
        }
    }
}

/**
 * Internal serializable wrapper for MeasureConfig that mirrors its structure.
 * This keeps serialization concerns separate from the public API.
 */
@SuppressLint("UnsafeOptInUsageError")
@Serializable
internal data class SerializableMeasureConfig(
    val enableLogging: Boolean = DefaultConfig.ENABLE_LOGGING,
    val trackScreenshotOnCrash: Boolean = DefaultConfig.TRACK_SCREENSHOT_ON_CRASH,
    val screenshotMaskLevel: ScreenshotMaskLevel = DefaultConfig.SCREENSHOT_MASK_LEVEL,
    val trackHttpHeaders: Boolean = DefaultConfig.TRACK_HTTP_HEADERS,
    val trackHttpBody: Boolean = DefaultConfig.TRACK_HTTP_BODY,
    val httpHeadersBlocklist: List<String> = DefaultConfig.HTTP_HEADERS_BLOCKLIST,
    val httpUrlBlocklist: List<String> = DefaultConfig.HTTP_URL_BLOCKLIST,
    val httpUrlAllowlist: List<String> = DefaultConfig.HTTP_URL_ALLOWLIST,
    val trackActivityIntentData: Boolean = DefaultConfig.TRACK_ACTIVITY_INTENT_DATA,
    val samplingRateForErrorFreeSessions: Float = DefaultConfig.SESSION_SAMPLING_RATE,
    val autoStart: Boolean = DefaultConfig.AUTO_START,
    val traceSamplingRate: Float = DefaultConfig.TRACE_SAMPLING_RATE,
    val trackActivityLoadTime: Boolean = DefaultConfig.TRACK_ACTIVITY_LOAD_TIME,
    val trackFragmentLoadTime: Boolean = DefaultConfig.TRACK_FRAGMENT_LOAD_TIME,
    val maxEstimatedDiskUsageInMb: Int = DefaultConfig.MAX_ESTIMATED_DISK_USAGE_IN_MB,
    val requestHeadersProvider: MsrRequestHeadersProvider? = null,
) {
    fun toMeasureConfig(): MeasureConfig = MeasureConfig(
        enableLogging = enableLogging,
        trackScreenshotOnCrash = trackScreenshotOnCrash,
        screenshotMaskLevel = screenshotMaskLevel,
        trackHttpHeaders = trackHttpHeaders,
        trackHttpBody = trackHttpBody,
        httpHeadersBlocklist = httpHeadersBlocklist,
        httpUrlBlocklist = httpUrlBlocklist,
        httpUrlAllowlist = httpUrlAllowlist,
        trackActivityIntentData = trackActivityIntentData,
        samplingRateForErrorFreeSessions = samplingRateForErrorFreeSessions,
        autoStart = autoStart,
        traceSamplingRate = traceSamplingRate,
        trackActivityLoadTime = trackActivityLoadTime,
        trackFragmentLoadTime = trackFragmentLoadTime,
        maxDiskUsageInMb = maxEstimatedDiskUsageInMb,
        requestHeadersProvider = requestHeadersProvider,
    )

    companion object {
        fun fromMeasureConfig(config: MeasureConfig): SerializableMeasureConfig =
            SerializableMeasureConfig(
                enableLogging = config.enableLogging,
                trackScreenshotOnCrash = config.trackScreenshotOnCrash,
                screenshotMaskLevel = config.screenshotMaskLevel,
                trackHttpHeaders = config.trackHttpHeaders,
                trackHttpBody = config.trackHttpBody,
                httpHeadersBlocklist = config.httpHeadersBlocklist,
                httpUrlBlocklist = config.httpUrlBlocklist,
                httpUrlAllowlist = config.httpUrlAllowlist,
                trackActivityIntentData = config.trackActivityIntentData,
                samplingRateForErrorFreeSessions = config.samplingRateForErrorFreeSessions,
                autoStart = config.autoStart,
                traceSamplingRate = config.traceSamplingRate,
                trackActivityLoadTime = config.trackActivityLoadTime,
                trackFragmentLoadTime = config.trackFragmentLoadTime,
                maxEstimatedDiskUsageInMb = config.maxDiskUsageInMb,
                requestHeadersProvider = config.requestHeadersProvider,
            )
    }
}

/**
 * Custom serializer that delegates to the internal serializable wrapper.
 * This provides a clean separation between public API and serialization concerns.
 */
internal object MeasureConfigSerializer : KSerializer<MeasureConfig> {
    private val delegateSerializer = SerializableMeasureConfig.serializer()

    override val descriptor: SerialDescriptor = delegateSerializer.descriptor

    override fun serialize(encoder: Encoder, value: MeasureConfig) {
        val serializableConfig = SerializableMeasureConfig.fromMeasureConfig(value)
        encoder.encodeSerializableValue(delegateSerializer, serializableConfig)
    }

    override fun deserialize(decoder: Decoder): MeasureConfig {
        val serializableConfig = decoder.decodeSerializableValue(delegateSerializer)
        return serializableConfig.toMeasureConfig()
    }
}
