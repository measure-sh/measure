package sh.measure.android.config

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

internal interface IDynamicConfig {
    /**
     * Maximum number of events and spans in a batch. Defaults to 10000.
     */
    val maxEventsInBatch: Int

    /**
     * Duration of session timeline collected with a crash, in seconds. Defaults to 300 seconds.
     */
    val crashTimelineDurationSeconds: Int

    /**
     * Duration of session timeline collected with an ANR, in seconds. Defaults to 300 seconds.
     */
    val anrTimelineDurationSeconds: Int

    /**
     * Duration of session timeline collected with a bug report, in seconds. Defaults to 300 seconds.
     */
    val bugReportTimelineDurationSeconds: Int

    /**
     * Sampling rate for traces. Defaults to 0.01%, which means one in 10000 traces will be sampled.
     */
    val traceSamplingRate: Float

    /**
     * Sampling rate in percentage for sessions that should track journey events. Defaults
     * to 0.01%, which means one in 10000 sessions will track journey events.
     */
    val journeySamplingRate: Float

    /**
     * The screenshot mask level to be applied to screenshots. Defaults
     * to [ScreenshotMaskLevel.AllTextAndMedia].
     */
    val screenshotMaskLevel: ScreenshotMaskLevel

    /**
     * Interval in seconds to collect CPU usage. Defaults to 5 seconds.
     */
    val cpuUsageInterval: Long

    /**
     * Interval in seconds to collect memory usage. Defaults to 5 seconds.
     */
    val memoryUsageInterval: Long

    /**
     * Whether to take a screenshot when a crash occurs. Defaults to true.
     */
    val crashTakeScreenshot: Boolean

    /**
     * Whether to take a screenshot when an ANR occurs. Defaults to true.
     */
    val anrTakeScreenshot: Boolean

    /**
     * Sampling rate for launch metrics in percentage. Defaults to 0.01%, i.e., 1 in 10000.
     */
    val launchSamplingRate: Float

    /**
     * Whether to take a layout snapshot when a gesture click occurs. Defaults to true.
     */
    val gestureClickTakeSnapshot: Boolean

    /**
     * Sampling rate for HTTP events. Defaults to 0.01%, which means
     * one in 10000 HTTP events will be sampled.
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
}

@Serializable
internal data class DynamicConfig(
    @SerialName("max_events_in_batch")
    override val maxEventsInBatch: Int = 10000,

    @SerialName("crash_timeline_duration")
    override val crashTimelineDurationSeconds: Int = 300,

    @SerialName("anr_timeline_duration")
    override val anrTimelineDurationSeconds: Int = 300,

    @SerialName("bug_report_timeline_duration")
    override val bugReportTimelineDurationSeconds: Int = 300,

    @SerialName("trace_sampling_rate")
    override val traceSamplingRate: Float = 0.01f,

    @SerialName("journey_sampling_rate")
    override val journeySamplingRate: Float = 0.01f,

    @SerialName("screenshot_mask_level")
    override val screenshotMaskLevel: ScreenshotMaskLevel =
        ScreenshotMaskLevel.AllTextAndMedia,

    @SerialName("cpu_usage_interval")
    override val cpuUsageInterval: Long = 5,

    @SerialName("memory_usage_interval")
    override val memoryUsageInterval: Long = 5,

    @SerialName("crash_take_screenshot")
    override val crashTakeScreenshot: Boolean = true,

    @SerialName("anr_take_screenshot")
    override val anrTakeScreenshot: Boolean = true,

    @SerialName("launch_sampling_rate")
    override val launchSamplingRate: Float = 0.01f,

    @SerialName("gesture_click_take_snapshot")
    override val gestureClickTakeSnapshot: Boolean = true,

    @SerialName("http_sampling_rate")
    override val httpSamplingRate: Float = 0.01f,

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
) : IDynamicConfig
