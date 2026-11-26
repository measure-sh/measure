@file:Suppress("KotlinConstantConditions")

package sh.measure.android.config

import sh.measure.android.Measure
import sh.measure.android.logs.LogSeverity

/**
 * Configuration for the Measure SDK. See [MeasureConfig] for details.
 */
internal interface IMeasureConfig {
    val enableLogging: Boolean
    val autoStart: Boolean
    val maxDiskUsageInMb: Int
    val trackActivityIntentData: Boolean
    val requestHeadersProvider: MsrRequestHeadersProvider?
    val enableFullCollectionMode: Boolean
    val enableDiagnosticMode: Boolean
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
     * Set to false to delay starting the SDK, by default initializing the SDK also starts tracking.
     *
     * Defaults to true.
     *
     * @see [Measure.start] to start the SDK.
     */
    override val autoStart: Boolean = DefaultConfig.AUTO_START,

    /**
     * Whether to capture intent data used to launch an Activity. Defaults to `false`.
     */
    override val trackActivityIntentData: Boolean = DefaultConfig.TRACK_ACTIVITY_INTENT_DATA,

    /**
     * Allows configuring custom HTTP headers for requests made by the Measure SDK to the
     * Measure API. This is useful only for self-hosted clients who may require additional
     * headers for requests in their infrastructure.
     *
     * See [MsrRequestHeadersProvider] for usage details.
     */
    override val requestHeadersProvider: MsrRequestHeadersProvider? = null,

    /**
     * Override all sampling configs and track all events and traces.
     *
     * **Note** that enabling this flag can significantly increase the cost and should typically
     * only be enabled for debug mode.
     */
    override val enableFullCollectionMode: Boolean = DefaultConfig.ENABLE_FULL_COLLECTION_MODE,

    /**
     * Enables diagnostic mode which writes all SDK logs to a file. The log file can be attached
     * when reporting a bug to help with debugging SDK issues. Defaults to `false`.
     *
     * To pull all log files from a device:
     * ```
     * adb shell "run-as <your.package.name> tar cf - files/measure/sdk_debug_logs/" | tar xf - -C /tmp/
     * ```
     */
    override val enableDiagnosticMode: Boolean = DefaultConfig.ENABLE_DIAGNOSTIC_MODE,

    /**
     * Whether to take a screenshot when a fatal error occurs. Defaults to `true`.
     */
    val errorFatalTakeScreenshot: Boolean = DefaultConfig.ERROR_FATAL_SCREENSHOT_ENABLED,

    /**
     * Whether to collect a session replay with fatal errors. Defaults to `true`.
     */
    val errorFatalReplayEnabled: Boolean = DefaultConfig.ERROR_FATAL_REPLAY_ENABLED,

    /**
     * Whether to collect a session replay with unhandled errors. Defaults to `false`.
     */
    val errorUnhandledReplayEnabled: Boolean = DefaultConfig.ERROR_UNHANDLED_REPLAY_ENABLED,

    /**
     * Whether to collect a session replay with handled errors. Defaults to `false`.
     */
    val errorHandledReplayEnabled: Boolean = DefaultConfig.ERROR_HANDLED_REPLAY_ENABLED,

    /**
     * Duration of the session replay collected with an error, in seconds. Defaults to `300`.
     */
    val errorReplayDuration: Int = DefaultConfig.ERROR_REPLAY_DURATION_SECONDS,

    /**
     * Sampling rate for fatal errors. Defaults to `100`.
     */
    val errorFatalSamplingRate: Float = DefaultConfig.ERROR_FATAL_SAMPLING_RATE,

    /**
     * Sampling rate for unhandled errors. Defaults to `100`.
     */
    val errorUnhandledSamplingRate: Float = DefaultConfig.ERROR_UNHANDLED_SAMPLING_RATE,

    /**
     * Sampling rate for handled errors. Defaults to `0`.
     */
    val errorHandledSamplingRate: Float = DefaultConfig.ERROR_HANDLED_SAMPLING_RATE,

    /**
     * Whether to take a screenshot when an ANR occurs. Defaults to `true`.
     */
    val anrTakeScreenshot: Boolean = DefaultConfig.ANR_TAKE_SCREENSHOT,

    /**
     * Duration of the session replay collected with an ANR, in seconds. Defaults to `300`.
     */
    val anrTimelineDuration: Int = DefaultConfig.ANR_TIMELINE_DURATION_SECONDS,

    /**
     * Duration of the session replay collected with a bug report, in seconds. Defaults to `300`.
     */
    val bugReportTimelineDuration: Int = DefaultConfig.BUG_REPORT_TIMELINE_DURATION_SECONDS,

    /**
     * Sampling rate for traces. Defaults to `100`.
     */
    val traceSamplingRate: Float = DefaultConfig.TRACE_SAMPLING_RATE,

    /**
     * Whether to collect screen load (TTID) spans. Defaults to `true`.
     */
    val ttidTraceEnabled: Boolean = DefaultConfig.TTID_TRACE_ENABLED,

    /**
     * Sampling rate for launch metrics. Defaults to `100`.
     */
    val launchSamplingRate: Float = DefaultConfig.LAUNCH_SAMPLING_RATE,

    /**
     * Sampling rate for profiles. Defaults to `100`.
     */
    val profileSamplingRate: Float = DefaultConfig.PROFILE_SAMPLING_RATE,

    /**
     * Sampling rate for installations that send analytics events. Defaults to `100`.
     */
    val analyticsSamplingRate: Float = DefaultConfig.ANALYTICS_SAMPLING_RATE,

    /**
     * Interval to collect memory usage, in seconds. Defaults to `5`.
     */
    val memoryUsageInterval: Long = DefaultConfig.MEMORY_USAGE_INTERVAL,

    /**
     * Interval to collect memory usage while the app is in the background, in seconds. Defaults to `10`.
     */
    val memoryUsageBackgroundInterval: Long = DefaultConfig.MEMORY_USAGE_BACKGROUND_INTERVAL,

    /**
     * Sampling rate for sessions that report memory usage. Defaults to `0.01`.
     */
    val memoryUsageSessionSamplingRate: Float = DefaultConfig.MEMORY_USAGE_SESSION_SAMPLING_RATE,

    /**
     * Sampling rate for HTTP events. Defaults to `100`.
     */
    val httpSamplingRate: Float = DefaultConfig.HTTP_SAMPLING_RATE,

    /**
     * URLs to not collect HTTP events for. Supports `*` wildcards. Defaults to none.
     */
    val httpDisableEventForUrls: List<String> = DefaultConfig.HTTP_DISABLE_EVENT_FOR_URLS,

    /**
     * URLs to collect the HTTP request body for. Supports `*` wildcards. Defaults to none.
     */
    val httpTrackRequestForUrls: List<String> = DefaultConfig.HTTP_TRACK_REQUEST_FOR_URLS,

    /**
     * URLs to collect the HTTP response body for. Supports `*` wildcards. Defaults to none.
     */
    val httpTrackResponseForUrls: List<String> = DefaultConfig.HTTP_TRACK_RESPONSE_FOR_URLS,

    /**
     * HTTP headers to never collect. Defaults to common auth and cookie headers.
     */
    val httpBlockedHeaders: List<String> = DefaultConfig.HTTP_BLOCKED_HEADERS,

    /**
     * How much of a screenshot to mask. Defaults to [ScreenshotMaskLevel.AllTextAndMedia].
     */
    val screenshotMaskLevel: ScreenshotMaskLevel = DefaultConfig.SCREENSHOT_MASK_LEVEL,

    /**
     * Whether to take a layout snapshot with clicks. Defaults to `true`.
     */
    val layoutSnapshotClickEnabled: Boolean = DefaultConfig.LAYOUT_SNAPSHOT_CLICK_ENABLED,

    /**
     * Whether to take a layout snapshot with screen views, when an activity resumes and when the
     * app goes to the background. Defaults to `true`.
     */
    val layoutSnapshotScreenViewEnabled: Boolean = DefaultConfig.LAYOUT_SNAPSHOT_SCREEN_VIEW_ENABLED,

    /**
     * Whether to collect logs from the platform's logging APIs automatically. Defaults to `false`.
     */
    val logAutocollectEnabled: Boolean = DefaultConfig.LOG_AUTOCOLLECT_ENABLED,

    /**
     * Minimum severity of logs to collect. Defaults to [LogSeverity.Warning].
     */
    val logMinSeverity: LogSeverity = LogSeverity.Warning,

    /**
     * Regex patterns matched against the log body. Logs that match are dropped. Defaults to none.
     */
    val logIgnorePatterns: List<String> = DefaultConfig.LOG_IGNORE_PATTERNS,
) : IMeasureConfig {
    @Deprecated("Kept so code compiled against older SDK versions still links.", level = DeprecationLevel.HIDDEN)
    constructor(
        enableLogging: Boolean = DefaultConfig.ENABLE_LOGGING,
        maxDiskUsageInMb: Int = DefaultConfig.MAX_ESTIMATED_DISK_USAGE_IN_MB,
        autoStart: Boolean = DefaultConfig.AUTO_START,
        trackActivityIntentData: Boolean = DefaultConfig.TRACK_ACTIVITY_INTENT_DATA,
        requestHeadersProvider: MsrRequestHeadersProvider? = null,
        enableFullCollectionMode: Boolean = DefaultConfig.ENABLE_FULL_COLLECTION_MODE,
        enableDiagnosticMode: Boolean = DefaultConfig.ENABLE_DIAGNOSTIC_MODE,
    ) : this(
        enableLogging = enableLogging,
        maxDiskUsageInMb = maxDiskUsageInMb,
        autoStart = autoStart,
        trackActivityIntentData = trackActivityIntentData,
        requestHeadersProvider = requestHeadersProvider,
        enableFullCollectionMode = enableFullCollectionMode,
        enableDiagnosticMode = enableDiagnosticMode,
        errorFatalTakeScreenshot = DefaultConfig.ERROR_FATAL_SCREENSHOT_ENABLED,
    )
}

internal fun MeasureConfig.toDynamicConfig(): DynamicConfig = DynamicConfig(
    errorFatalTakeScreenshot = errorFatalTakeScreenshot,
    errorFatalReplayEnabled = errorFatalReplayEnabled,
    errorUnhandledReplayEnabled = errorUnhandledReplayEnabled,
    errorHandledReplayEnabled = errorHandledReplayEnabled,
    errorReplayDuration = errorReplayDuration,
    errorFatalSamplingRate = errorFatalSamplingRate,
    errorUnhandledSamplingRate = errorUnhandledSamplingRate,
    errorHandledSamplingRate = errorHandledSamplingRate,
    anrTakeScreenshot = anrTakeScreenshot,
    anrTimelineDurationSeconds = anrTimelineDuration,
    bugReportTimelineDurationSeconds = bugReportTimelineDuration,
    traceSamplingRate = traceSamplingRate,
    ttidTraceEnabled = ttidTraceEnabled,
    launchSamplingRate = launchSamplingRate,
    profileSamplingRate = profileSamplingRate,
    analyticsSamplingRate = analyticsSamplingRate,
    memoryUsageInterval = memoryUsageInterval,
    memoryUsageBackgroundInterval = memoryUsageBackgroundInterval,
    memoryUsageSessionSamplingRate = memoryUsageSessionSamplingRate,
    httpSamplingRate = httpSamplingRate,
    httpDisableEventForUrls = httpDisableEventForUrls,
    httpTrackRequestForUrls = httpTrackRequestForUrls,
    httpTrackResponseForUrls = httpTrackResponseForUrls,
    httpBlockedHeaders = httpBlockedHeaders,
    screenshotMaskLevel = screenshotMaskLevel,
    layoutSnapshotClickEnabled = layoutSnapshotClickEnabled,
    layoutSnapshotScreenViewEnabled = layoutSnapshotScreenViewEnabled,
    logAutocollectEnabled = logAutocollectEnabled,
    logMinSeverity = logMinSeverity.severityNumber,
    logIgnorePatterns = logIgnorePatterns,
)
