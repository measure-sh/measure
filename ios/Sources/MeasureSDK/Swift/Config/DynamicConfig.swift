//
//  DynamicConfig.swift
//  Measure
//
//  Created by Adwin Ross on 07/01/26.
//

import Foundation

protocol DynamicConfig {
    /// Maximum number of events and spans in a batch.
    /// Defaults to 1000.
    var maxEventsInBatch: Number { get }

    /// Duration of session timeline collected with an error, in seconds.
    /// Defaults to 300 seconds.
    var errorReplayDurationSeconds: Number { get }

    /// Duration of session timeline collected with an ANR, in seconds.
    /// Defaults to 300 seconds.
    var anrTimelineDurationSeconds: Number { get }

    /// Duration of session timeline collected with a bug report, in seconds.
    /// Defaults to 300 seconds.
    var bugReportTimelineDurationSeconds: Number { get }

    /// Sampling rate for traces.
    /// Defaults to 100%, i.e. all traces.
    var traceSamplingRate: Float { get }

    /// Sampling rate for sessions that should track journey events.
    /// Defaults to 100%, i.e. all sessions.
    var journeySamplingRate: Float { get }

    /// Screenshot masking level.
    var screenshotMaskLevel: ScreenshotMaskLevel { get }

    /// Whether the SDK automatically collects logs from the platform's logging APIs.
    /// Manually tracked logs are always collected. Defaults to false.
    var logAutocollectEnabled: Bool { get }

    /// Minimum severity number of logs to collect. Logs below this number are dropped.
    /// Defaults to 16 (warning).
    var logMinSeverity: Int { get }

    /// Regex patterns matched against the log body. A log whose body matches any of the
    /// patterns is dropped before it is tracked. Defaults to empty list.
    var logIgnorePatterns: [String] { get }

    /// Interval in seconds to collect CPU usage.
    /// Defaults to 5 seconds.
    var cpuUsageInterval: Number { get }

    /// Interval in seconds to collect memory usage.
    /// Defaults to 5 seconds.
    var memoryUsageInterval: Number { get }

    /// Whether to take a screenshot on a fatal error.
    /// Defaults to true.
    var errorFatalTakeScreenshot: Bool { get }

    /// Whether to collect a session replay with fatal errors, the ones that
    /// terminated the app. Defaults to true.
    var errorFatalReplayEnabled: Bool { get }

    /// Whether to collect a session replay with unhandled, the ones that
    /// were not caught but did not terminate the app. Defaults to false.
    var errorUnhandledReplayEnabled: Bool { get }

    /// Whether to collect a session replay with handled errors, the ones reported
    /// by the app. Defaults to false.
    var errorHandledReplayEnabled: Bool { get }

    /// Sampling rate for fatal errors. Defaults to 100.
    var errorFatalSamplingRate: Float { get }

    /// Sampling rate for unhandled errors. Defaults to 100.
    var errorUnhandledSamplingRate: Float { get }

    /// Sampling rate for handled errors. Defaults to 0.
    var errorHandledSamplingRate: Float { get }

    /// Whether to take a screenshot on ANR.
    /// Defaults to true.
    var anrTakeScreenshot: Bool { get }

    /// Sampling rate for launch metrics.
    /// Defaults to 100%.
    var launchSamplingRate: Float { get }

    /// Whether to take a layout snapshot on gesture click.
    /// Defaults to true.
    var gestureClickTakeSnapshot: Bool { get }

    /// Sampling rate for htto events.
    /// Defaults to 100%.
    var httpSamplingRate: Float { get }

    /// URLs for which HTTP events should be disabled.
    var httpDisableEventForUrls: [String] { get }

    /// URLs for which HTTP requests should be tracked.
    var httpTrackRequestForUrls: [String] { get }

    /// URLs for which HTTP responses should be tracked.
    var httpTrackResponseForUrls: [String] { get }

    /// HTTP headers that should never be collected.
    var httpBlockedHeaders: [String] { get }
}

struct BaseDynamicConfig: DynamicConfig, Codable {
    let maxEventsInBatch: Number
    let errorReplayDurationSeconds: Number
    let anrTimelineDurationSeconds: Number
    let bugReportTimelineDurationSeconds: Number
    let traceSamplingRate: Float
    let journeySamplingRate: Float
    let screenshotMaskLevel: ScreenshotMaskLevel
    let logAutocollectEnabled: Bool
    let logMinSeverity: Int
    let logIgnorePatterns: [String]
    let cpuUsageInterval: Number
    let memoryUsageInterval: Number
    let errorFatalTakeScreenshot: Bool
    let errorFatalReplayEnabled: Bool
    let errorUnhandledReplayEnabled: Bool
    let errorHandledReplayEnabled: Bool
    let errorFatalSamplingRate: Float
    let errorUnhandledSamplingRate: Float
    let errorHandledSamplingRate: Float
    let anrTakeScreenshot: Bool
    let launchSamplingRate: Float
    let gestureClickTakeSnapshot: Bool
    let httpSamplingRate: Float
    let httpDisableEventForUrls: [String]
    let httpTrackRequestForUrls: [String]
    let httpTrackResponseForUrls: [String]
    let httpBlockedHeaders: [String]

    init(maxEventsInBatch: Number = DefaultConfig.maxEventsInBatch,
         errorReplayDurationSeconds: Number = DefaultConfig.errorReplayDurationSeconds,
         anrTimelineDurationSeconds: Number = DefaultConfig.anrTimelineDurationSeconds,
         bugReportTimelineDurationSeconds: Number = DefaultConfig.bugReportTimelineDurationSeconds,
         traceSamplingRate: Float = DefaultConfig.traceSamplingRate,
         journeySamplingRate: Float = DefaultConfig.journeySamplingRate,
         screenshotMaskLevel: ScreenshotMaskLevel = DefaultConfig.screenshotMaskLevel,
         logAutocollectEnabled: Bool = DefaultConfig.logAutocollectEnabled,
         logMinSeverity: Int = DefaultConfig.logMinSeverity,
         logIgnorePatterns: [String] = DefaultConfig.logIgnorePatterns,
         cpuUsageInterval: Number = DefaultConfig.cpuUsageInterval,
         memoryUsageInterval: Number = DefaultConfig.memoryUsageInterval,
         errorFatalTakeScreenshot: Bool = DefaultConfig.errorFatalTakeScreenshot,
         errorFatalReplayEnabled: Bool = DefaultConfig.errorFatalReplayEnabled,
         errorUnhandledReplayEnabled: Bool = DefaultConfig.errorUnhandledReplayEnabled,
         errorHandledReplayEnabled: Bool = DefaultConfig.errorHandledReplayEnabled,
         errorFatalSamplingRate: Float = DefaultConfig.errorFatalSamplingRate,
         errorUnhandledSamplingRate: Float = DefaultConfig.errorUnhandledSamplingRate,
         errorHandledSamplingRate: Float = DefaultConfig.errorHandledSamplingRate,
         anrTakeScreenshot: Bool = DefaultConfig.anrTakeScreenshot,
         launchSamplingRate: Float = DefaultConfig.launchSamplingRate,
         gestureClickTakeSnapshot: Bool = DefaultConfig.gestureClickTakeSnapshot,
         httpSamplingRate: Float = DefaultConfig.httpSamplingRate,
         httpDisableEventForUrls: [String] = DefaultConfig.httpDisableEventForUrls,
         httpTrackRequestForUrls: [String] = DefaultConfig.httpTrackRequestForUrls,
         httpTrackResponseForUrls: [String] = DefaultConfig.httpTrackResponseForUrls,
         httpBlockedHeaders: [String] = DefaultConfig.httpBlockedHeaders
    ) {
        self.maxEventsInBatch = maxEventsInBatch
        self.errorReplayDurationSeconds = errorReplayDurationSeconds
        self.anrTimelineDurationSeconds = anrTimelineDurationSeconds
        self.bugReportTimelineDurationSeconds = bugReportTimelineDurationSeconds
        self.traceSamplingRate = traceSamplingRate
        self.journeySamplingRate = journeySamplingRate
        self.screenshotMaskLevel = screenshotMaskLevel
        self.logAutocollectEnabled = logAutocollectEnabled
        self.logMinSeverity = logMinSeverity
        self.logIgnorePatterns = logIgnorePatterns
        self.cpuUsageInterval = cpuUsageInterval
        self.memoryUsageInterval = memoryUsageInterval
        self.errorFatalTakeScreenshot = errorFatalTakeScreenshot
        self.errorFatalReplayEnabled = errorFatalReplayEnabled
        self.errorUnhandledReplayEnabled = errorUnhandledReplayEnabled
        self.errorHandledReplayEnabled = errorHandledReplayEnabled
        self.errorFatalSamplingRate = errorFatalSamplingRate
        self.errorUnhandledSamplingRate = errorUnhandledSamplingRate
        self.errorHandledSamplingRate = errorHandledSamplingRate
        self.anrTakeScreenshot = anrTakeScreenshot
        self.launchSamplingRate = launchSamplingRate
        self.gestureClickTakeSnapshot = gestureClickTakeSnapshot
        self.httpSamplingRate = httpSamplingRate
        self.httpDisableEventForUrls = httpDisableEventForUrls
        self.httpTrackRequestForUrls = httpTrackRequestForUrls
        self.httpTrackResponseForUrls = httpTrackResponseForUrls
        self.httpBlockedHeaders = httpBlockedHeaders
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self) // swiftlint:disable:this identifier_name

        maxEventsInBatch = try c.decodeIfPresent(Number.self, forKey: .maxEventsInBatch) ?? DefaultConfig.maxEventsInBatch
        errorReplayDurationSeconds = try c.decodeIfPresent(Number.self, forKey: .errorReplayDurationSeconds)
            ?? c.decodeIfPresent(Number.self, forKey: .crashTimelineDuration)
            ?? DefaultConfig.errorReplayDurationSeconds
        anrTimelineDurationSeconds = try c.decodeIfPresent(Number.self, forKey: .anrTimelineDurationSeconds) ?? DefaultConfig.anrTimelineDurationSeconds
        bugReportTimelineDurationSeconds = try c.decodeIfPresent(Number.self, forKey: .bugReportTimelineDurationSeconds) ?? DefaultConfig.bugReportTimelineDurationSeconds
        traceSamplingRate = try c.decodeIfPresent(Float.self, forKey: .traceSamplingRate) ?? DefaultConfig.traceSamplingRate
        journeySamplingRate = try c.decodeIfPresent(Float.self, forKey: .journeySamplingRate) ?? DefaultConfig.journeySamplingRate
        screenshotMaskLevel = try c.decodeIfPresent(ScreenshotMaskLevel.self, forKey: .screenshotMaskLevel) ?? DefaultConfig.screenshotMaskLevel
        logAutocollectEnabled = try c.decodeIfPresent(Bool.self, forKey: .logAutocollectEnabled) ?? DefaultConfig.logAutocollectEnabled
        logMinSeverity = try c.decodeIfPresent(Int.self, forKey: .logMinSeverity) ?? DefaultConfig.logMinSeverity
        logIgnorePatterns = try c.decodeIfPresent([String].self, forKey: .logIgnorePatterns) ?? DefaultConfig.logIgnorePatterns
        cpuUsageInterval = try c.decodeIfPresent(Number.self, forKey: .cpuUsageInterval) ?? DefaultConfig.cpuUsageInterval
        memoryUsageInterval = try c.decodeIfPresent(Number.self, forKey: .memoryUsageInterval) ?? DefaultConfig.memoryUsageInterval
        errorFatalTakeScreenshot = try c.decodeIfPresent(Bool.self, forKey: .errorFatalTakeScreenshot)
            ?? c.decodeIfPresent(Bool.self, forKey: .crashTakeScreenshot)
            ?? DefaultConfig.errorFatalTakeScreenshot
        errorFatalReplayEnabled = try c.decodeIfPresent(Bool.self, forKey: .errorFatalReplayEnabled) ?? DefaultConfig.errorFatalReplayEnabled
        errorUnhandledReplayEnabled = try c.decodeIfPresent(Bool.self, forKey: .errorUnhandledReplayEnabled) ?? DefaultConfig.errorUnhandledReplayEnabled
        errorHandledReplayEnabled = try c.decodeIfPresent(Bool.self, forKey: .errorHandledReplayEnabled) ?? DefaultConfig.errorHandledReplayEnabled
        errorFatalSamplingRate = try c.decodeIfPresent(Float.self, forKey: .errorFatalSamplingRate) ?? DefaultConfig.errorFatalSamplingRate
        errorUnhandledSamplingRate = try c.decodeIfPresent(Float.self, forKey: .errorUnhandledSamplingRate) ?? DefaultConfig.errorUnhandledSamplingRate
        errorHandledSamplingRate = try c.decodeIfPresent(Float.self, forKey: .errorHandledSamplingRate) ?? DefaultConfig.errorHandledSamplingRate
        anrTakeScreenshot = try c.decodeIfPresent(Bool.self, forKey: .anrTakeScreenshot) ?? DefaultConfig.anrTakeScreenshot
        launchSamplingRate = try c.decodeIfPresent(Float.self, forKey: .launchSamplingRate) ?? DefaultConfig.launchSamplingRate
        gestureClickTakeSnapshot = try c.decodeIfPresent(Bool.self, forKey: .gestureClickTakeSnapshot) ?? DefaultConfig.gestureClickTakeSnapshot
        httpSamplingRate = try c.decodeIfPresent(Float.self, forKey: .httpSamplingRate) ?? DefaultConfig.httpSamplingRate
        httpDisableEventForUrls = try c.decodeIfPresent([String].self, forKey: .httpDisableEventForUrls) ?? DefaultConfig.httpDisableEventForUrls
        httpTrackRequestForUrls = try c.decodeIfPresent([String].self, forKey: .httpTrackRequestForUrls) ?? DefaultConfig.httpTrackRequestForUrls
        httpTrackResponseForUrls = try c.decodeIfPresent([String].self, forKey: .httpTrackResponseForUrls) ?? DefaultConfig.httpTrackResponseForUrls
        httpBlockedHeaders = try c.decodeIfPresent([String].self, forKey: .httpBlockedHeaders) ?? DefaultConfig.httpBlockedHeaders
    }

    // Flutter and React Native read this file, and Flutter SDKs released before the rename
    // only know the older keys, so both key families are written.
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self) // swiftlint:disable:this identifier_name

        try c.encode(maxEventsInBatch, forKey: .maxEventsInBatch)
        try c.encode(errorReplayDurationSeconds, forKey: .errorReplayDurationSeconds)
        try c.encode(errorReplayDurationSeconds, forKey: .crashTimelineDuration)
        try c.encode(anrTimelineDurationSeconds, forKey: .anrTimelineDurationSeconds)
        try c.encode(bugReportTimelineDurationSeconds, forKey: .bugReportTimelineDurationSeconds)
        try c.encode(traceSamplingRate, forKey: .traceSamplingRate)
        try c.encode(journeySamplingRate, forKey: .journeySamplingRate)
        try c.encode(screenshotMaskLevel, forKey: .screenshotMaskLevel)
        try c.encode(logAutocollectEnabled, forKey: .logAutocollectEnabled)
        try c.encode(logMinSeverity, forKey: .logMinSeverity)
        try c.encode(logIgnorePatterns, forKey: .logIgnorePatterns)
        try c.encode(cpuUsageInterval, forKey: .cpuUsageInterval)
        try c.encode(memoryUsageInterval, forKey: .memoryUsageInterval)
        try c.encode(errorFatalTakeScreenshot, forKey: .errorFatalTakeScreenshot)
        try c.encode(errorFatalTakeScreenshot, forKey: .crashTakeScreenshot)
        try c.encode(errorFatalReplayEnabled, forKey: .errorFatalReplayEnabled)
        try c.encode(errorUnhandledReplayEnabled, forKey: .errorUnhandledReplayEnabled)
        try c.encode(errorHandledReplayEnabled, forKey: .errorHandledReplayEnabled)
        try c.encode(errorFatalSamplingRate, forKey: .errorFatalSamplingRate)
        try c.encode(errorUnhandledSamplingRate, forKey: .errorUnhandledSamplingRate)
        try c.encode(errorHandledSamplingRate, forKey: .errorHandledSamplingRate)
        try c.encode(anrTakeScreenshot, forKey: .anrTakeScreenshot)
        try c.encode(launchSamplingRate, forKey: .launchSamplingRate)
        try c.encode(gestureClickTakeSnapshot, forKey: .gestureClickTakeSnapshot)
        try c.encode(httpSamplingRate, forKey: .httpSamplingRate)
        try c.encode(httpDisableEventForUrls, forKey: .httpDisableEventForUrls)
        try c.encode(httpTrackRequestForUrls, forKey: .httpTrackRequestForUrls)
        try c.encode(httpTrackResponseForUrls, forKey: .httpTrackResponseForUrls)
        try c.encode(httpBlockedHeaders, forKey: .httpBlockedHeaders)
    }

    private enum CodingKeys: String, CodingKey {
        case maxEventsInBatch = "max_events_in_batch"
        case errorReplayDurationSeconds = "error_replay_duration"
        // The key this setting used before it was renamed to error_replay_duration. Remove
        // once every supported backend and Flutter SDK use the newer key.
        case crashTimelineDuration = "crash_timeline_duration"
        case anrTimelineDurationSeconds = "anr_timeline_duration"
        case bugReportTimelineDurationSeconds = "bug_report_timeline_duration"
        case traceSamplingRate = "trace_sampling_rate"
        case journeySamplingRate = "journey_sampling_rate"
        case screenshotMaskLevel = "screenshot_mask_level"
        case logAutocollectEnabled = "log_autocollect_enabled"
        case logMinSeverity = "log_min_severity"
        case logIgnorePatterns = "log_ignore_patterns"
        case cpuUsageInterval = "cpu_usage_interval"
        case memoryUsageInterval = "memory_usage_interval"
        case errorFatalTakeScreenshot = "error_fatal_take_screenshot"
        // The key this setting used before it was renamed to error_fatal_take_screenshot.
        // Remove once every supported backend and Flutter SDK use the newer key.
        case crashTakeScreenshot = "crash_take_screenshot"
        case errorFatalReplayEnabled = "error_fatal_replay_enabled"
        case errorUnhandledReplayEnabled = "error_unhandled_replay_enabled"
        case errorHandledReplayEnabled = "error_handled_replay_enabled"
        case errorFatalSamplingRate = "error_fatal_sampling_rate"
        case errorUnhandledSamplingRate = "error_unhandled_sampling_rate"
        case errorHandledSamplingRate = "error_handled_sampling_rate"
        case anrTakeScreenshot = "anr_take_screenshot"
        case launchSamplingRate = "launch_sampling_rate"
        case gestureClickTakeSnapshot = "gesture_click_take_snapshot"
        case httpSamplingRate = "http_sampling_rate"
        case httpDisableEventForUrls = "http_disable_event_for_urls"
        case httpTrackRequestForUrls = "http_track_request_for_urls"
        case httpTrackResponseForUrls = "http_track_response_for_urls"
        case httpBlockedHeaders = "http_blocked_headers"
    }
}
