package sh.measure.android.config

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

internal interface IDynamicConfig {
    val maxEventsInBatch: Int
    val crashTimelineDuration: Long
    val anrTimelineDuration: Long
    val bugReportTimelineDuration: Long
    val traceSamplingRate: Float
    val journeySamplingRate: Float
    val screenshotMaskLevel: ScreenshotMaskLevel
    val cpuUsageInterval: Long
    val memoryUsageInterval: Long
    val crashTakeScreenshot: Boolean
    val crashTimelineSamplingRate: Float
    val anrTakeScreenshot: Boolean
    val anrTimelineSamplingRate: Float
    val launchSamplingRate: Float
    val gestureClickTakeSnapshot: Boolean
    val httpDisableEventForUrls: List<String>
    val httpTrackRequestForUrls: List<String>
    val httpTrackResponseForUrls: List<String>
    val httpBlockedHeaders: List<String>
}

@Serializable
internal data class DynamicConfig(
    @SerialName("max_events_in_batch")
    override val maxEventsInBatch: Int,

    @SerialName("crash_timeline_duration")
    override val crashTimelineDuration: Long,

    @SerialName("anr_timeline_duration")
    override val anrTimelineDuration: Long,

    @SerialName("bug_report_timeline_duration")
    override val bugReportTimelineDuration: Long,

    @SerialName("trace_sampling_rate")
    override val traceSamplingRate: Float,

    @SerialName("journey_sampling_rate")
    override val journeySamplingRate: Float,

    @SerialName("screenshot_mask_level")
    override val screenshotMaskLevel: ScreenshotMaskLevel,

    @SerialName("cpu_usage_interval")
    override val cpuUsageInterval: Long,

    @SerialName("memory_usage_interval")
    override val memoryUsageInterval: Long,

    @SerialName("crash_take_screenshot")
    override val crashTakeScreenshot: Boolean,

    @SerialName("crash_timeline_sampling_rate")
    override val crashTimelineSamplingRate: Float,

    @SerialName("anr_take_screenshot")
    override val anrTakeScreenshot: Boolean,

    @SerialName("anr_timeline_sampling_rate")
    override val anrTimelineSamplingRate: Float,

    @SerialName("launch_sampling_rate")
    override val launchSamplingRate: Float,

    @SerialName("gesture_click_take_snapshot")
    override val gestureClickTakeSnapshot: Boolean,

    @SerialName("http_disable_event_for_urls")
    override val httpDisableEventForUrls: MutableList<String>,

    @SerialName("http_track_request_for_urls")
    override val httpTrackRequestForUrls: List<String>,

    @SerialName("http_track_response_for_urls")
    override val httpTrackResponseForUrls: List<String>,

    @SerialName("http_blocked_headers")
    override val httpBlockedHeaders: List<String>
) : IDynamicConfig