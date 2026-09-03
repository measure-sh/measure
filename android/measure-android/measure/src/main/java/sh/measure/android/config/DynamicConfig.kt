package sh.measure.android.config

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

internal interface IDynamicConfig {
    /**
     * Maximum number of events and spans in a batch. Defaults to 10000.
     */
    val maxEventsInBatch: Int

    /**
     * Duration of session timeline collected with an error, in seconds. Defaults to 300 seconds.
     */
    val errorReplayDurationSeconds: Int

    /**
     * Duration of session timeline collected with an ANR, in seconds. Defaults to 300 seconds.
     */
    val anrTimelineDurationSeconds: Int

    /**
     * Duration of session timeline collected with a bug report, in seconds. Defaults to 300 seconds.
     */
    val bugReportTimelineDurationSeconds: Int

    /**
     * Sampling rate for traces. Defaults to 100%, which means all traces will be sampled.
     */
    val traceSamplingRate: Float

    /**
     * Sampling rate in percentage for sessions that should track journey events. Defaults
     * to 100%, which means all sessions will track journey events.
     */
    val journeySamplingRate: Float

    /**
     * The screenshot mask level to be applied to screenshots. Defaults
     * to [ScreenshotMaskLevel.AllTextAndMedia].
     */
    val screenshotMaskLevel: ScreenshotMaskLevel

    /**
     * Whether the SDK automatically collects logs from the platform's logging APIs.
     * Manually tracked logs are always collected. Defaults to false.
     */
    val logAutocollectEnabled: Boolean

    /**
     * Minimum severity number of logs to collect. Logs below this number are dropped.
     * Defaults to 16 (warning).
     */
    val logMinSeverity: Int

    /**
     * Regex patterns matched against the log body. A log whose body matches any of the
     * patterns is dropped before it is tracked. Defaults to empty list.
     */
    val logIgnorePatterns: List<String>

    /**
     * Interval in seconds to collect CPU usage. Defaults to 5 seconds.
     */
    val cpuUsageInterval: Long

    /**
     * Interval in seconds to collect memory usage. Defaults to 5 seconds.
     */
    val memoryUsageInterval: Long

    /**
     * Whether to take a screenshot when a fatal error occurs. Defaults to true.
     */
    val errorFatalScreenshotEnabled: Boolean

    /**
     * Whether to collect a session replay with fatal errors, the ones that terminated
     * the app. Defaults to true.
     */
    val errorFatalReplayEnabled: Boolean

    /**
     * Whether to collect a session replay with unhandled errors, the ones that were not
     * caught but did not terminate the app. Defaults to false.
     */
    val errorUnhandledReplayEnabled: Boolean

    /**
     * Whether to collect a session replay with handled errors, the ones reported by the
     * app. Defaults to false.
     */
    val errorHandledReplayEnabled: Boolean

    /**
     * Sampling rate for fatal errors. Defaults to 100.
     */
    val errorFatalSamplingRate: Float

    /**
     * Sampling rate for unhandled errors. Defaults to 100.
     */
    val errorUnhandledSamplingRate: Float

    /**
     * Sampling rate for handled errors. Defaults to 0.
     */
    val errorHandledSamplingRate: Float

    /**
     * Whether to take a screenshot when an ANR occurs. Defaults to true.
     */
    val anrTakeScreenshot: Boolean

    /**
     * Sampling rate for launch metrics in percentage. Defaults to 100%, i.e., all launches.
     */
    val launchSamplingRate: Float

    /**
     * Whether to take a layout snapshot when a gesture click occurs. Defaults to true.
     */
    val gestureClickTakeSnapshot: Boolean

    /**
     * Sampling rate for HTTP events. Defaults to 100%, which means
     * all HTTP events will be sampled.
     */
    val httpSamplingRate: Float

    /**
     * List of URLs to disable sending events for. Defaults to empty list.
     *
     * The URLs can use wildcard patterns.
     */
    val httpDisableEventForUrls: List<String>

    /**
     * List of URLs to track requests for. Defaults to empty list.
     *
     * The URLs can use wildcard patterns.
     */
    val httpTrackRequestForUrls: List<String>

    /**
     * List of URLs to track responses for. Defaults to empty list.
     *
     * The URLs can use wildcard patterns.
     */
    val httpTrackResponseForUrls: List<String>

    /**
     * List of HTTP headers to not collect with the `http` event for both request and response.
     *
     * The following headers are always excluded:
     * * Authorization
     * * Cookie
     * * Set-Cookie
     * * Proxy-Authorization
     * * WWW-Authenticate
     * * X-Api-Key
     */
    val httpBlockedHeaders: List<String>

    /**
     * Sampling rate in percentage for profile events. Defaults to 100%, i.e. every profile that
     * survives the system's own throttling is collected. The OS already rate limits these, so this
     * is an additional, remotely tunable cap on top of that.
     */
    val profileSamplingRate: Float
}

@Serializable
internal data class DynamicConfig(
    @SerialName("max_events_in_batch")
    override val maxEventsInBatch: Int = 10000,

    @SerialName("error_replay_duration")
    val errorReplayDuration: Int? = null,

    /**
     * Renamed to `error_replay_duration`. Only
     * read when the the new key is absent.
     */
    @Deprecated("Use errorReplayDurationSeconds instead.")
    @SerialName("crash_timeline_duration")
    val crashTimelineDuration: Int? = null,

    @SerialName("anr_timeline_duration")
    override val anrTimelineDurationSeconds: Int = 300,

    @SerialName("bug_report_timeline_duration")
    override val bugReportTimelineDurationSeconds: Int = 300,

    @SerialName("trace_sampling_rate")
    override val traceSamplingRate: Float = 100f,

    @SerialName("journey_sampling_rate")
    override val journeySamplingRate: Float = 100f,

    @SerialName("screenshot_mask_level")
    override val screenshotMaskLevel: ScreenshotMaskLevel =
        ScreenshotMaskLevel.AllTextAndMedia,

    @SerialName("log_autocollect_enabled")
    override val logAutocollectEnabled: Boolean = false,

    @SerialName("log_min_severity")
    override val logMinSeverity: Int = 16,

    @SerialName("log_ignore_patterns")
    override val logIgnorePatterns: List<String> = emptyList(),

    @SerialName("cpu_usage_interval")
    override val cpuUsageInterval: Long = 5,

    @SerialName("memory_usage_interval")
    override val memoryUsageInterval: Long = 5,

    @SerialName("error_fatal_take_screenshot")
    val errorFatalTakeScreenshot: Boolean? = null,

    /**
     * Renamed to `error_fatal_take_screenshot`. Only
     * read when the the new key is absent.
     */
    @Deprecated("Use errorFatalScreenshotEnabled instead.")
    @SerialName("crash_take_screenshot")
    val crashTakeScreenshot: Boolean? = null,

    @SerialName("error_fatal_replay_enabled")
    override val errorFatalReplayEnabled: Boolean = true,

    @SerialName("error_unhandled_replay_enabled")
    override val errorUnhandledReplayEnabled: Boolean = false,

    @SerialName("error_handled_replay_enabled")
    override val errorHandledReplayEnabled: Boolean = false,

    @SerialName("error_fatal_sampling_rate")
    override val errorFatalSamplingRate: Float = 100f,

    @SerialName("error_unhandled_sampling_rate")
    override val errorUnhandledSamplingRate: Float = 100f,

    @SerialName("error_handled_sampling_rate")
    override val errorHandledSamplingRate: Float = 0f,

    @SerialName("anr_take_screenshot")
    override val anrTakeScreenshot: Boolean = true,

    @SerialName("launch_sampling_rate")
    override val launchSamplingRate: Float = 100f,

    @SerialName("gesture_click_take_snapshot")
    override val gestureClickTakeSnapshot: Boolean = true,

    @SerialName("http_sampling_rate")
    override val httpSamplingRate: Float = 100f,

    @SerialName("http_disable_event_for_urls")
    override val httpDisableEventForUrls: List<String> = emptyList(),

    @SerialName("http_track_request_for_urls")
    override val httpTrackRequestForUrls: List<String> = emptyList(),

    @SerialName("http_track_response_for_urls")
    override val httpTrackResponseForUrls: List<String> = emptyList(),

    @SerialName("http_blocked_headers")
    override val httpBlockedHeaders: List<String> = listOf(
        "Authorization",
        "Cookie",
        "Set-Cookie",
        "Proxy-Authorization",
        "WWW-Authenticate",
        "X-Api-Key",
    ),

    @SerialName("profile_sampling_rate")
    override val profileSamplingRate: Float = 100f,
) : IDynamicConfig {
    @Suppress("DEPRECATION")
    override val errorReplayDurationSeconds: Int
        get() = errorReplayDuration ?: crashTimelineDuration ?: 300

    @Suppress("DEPRECATION")
    override val errorFatalScreenshotEnabled: Boolean
        get() = errorFatalTakeScreenshot ?: crashTakeScreenshot ?: true
}
