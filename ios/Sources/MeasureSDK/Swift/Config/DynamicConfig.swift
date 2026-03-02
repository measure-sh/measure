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

    /// Duration of session timeline collected with a crash, in seconds.
    /// Defaults to 300 seconds.
    var crashTimelineDurationSeconds: Number { get }

    /// Duration of session timeline collected with an ANR, in seconds.
    /// Defaults to 300 seconds.
    var anrTimelineDurationSeconds: Number { get }

    /// Duration of session timeline collected with a bug report, in seconds.
    /// Defaults to 300 seconds.
    var bugReportTimelineDurationSeconds: Number { get }

    /// Sampling rate for traces.
    /// Defaults to 0.01%, i.e. 1 in 10,000 traces.
    var traceSamplingRate: Float { get }

    /// Sampling rate for sessions that should track journey events.
    /// Defaults to 0.01%, i.e. 1 in 10,000 sessions.
    var journeySamplingRate: Float { get }

    /// Screenshot masking level.
    var screenshotMaskLevel: ScreenshotMaskLevel { get }

    /// Interval in seconds to collect CPU usage.
    /// Defaults to 5 seconds.
    var cpuUsageInterval: Number { get }

    /// Interval in seconds to collect memory usage.
    /// Defaults to 5 seconds.
    var memoryUsageInterval: Number { get }

    /// Whether to take a screenshot on crash.
    /// Defaults to true.
    var crashTakeScreenshot: Bool { get }

    /// Whether to take a screenshot on ANR.
    /// Defaults to true.
    var anrTakeScreenshot: Bool { get }

    /// Sampling rate for launch metrics.
    /// Defaults to 0.01%.
    var launchSamplingRate: Float { get }

    /// Whether to take a layout snapshot on gesture click.
    /// Defaults to true.
    var gestureClickTakeSnapshot: Bool { get }

    /// Sampling rate for htto events.
    /// Defaults to 0.01%.
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
    let crashTimelineDurationSeconds: Number
    let anrTimelineDurationSeconds: Number
    let bugReportTimelineDurationSeconds: Number
    let traceSamplingRate: Float
    let journeySamplingRate: Float
    let screenshotMaskLevel: ScreenshotMaskLevel
    let cpuUsageInterval: Number
    let memoryUsageInterval: Number
    let crashTakeScreenshot: Bool
    let anrTakeScreenshot: Bool
    let launchSamplingRate: Float
    let gestureClickTakeSnapshot: Bool
    let httpSamplingRate: Float
    let httpDisableEventForUrls: [String]
    let httpTrackRequestForUrls: [String]
    let httpTrackResponseForUrls: [String]
    let httpBlockedHeaders: [String]
    
    init(maxEventsInBatch: Number = DefaultConfig.maxEventsInBatch,
         crashTimelineDurationSeconds: Number = DefaultConfig.crashTimelineDurationSeconds,
         anrTimelineDurationSeconds: Number = DefaultConfig.anrTimelineDurationSeconds,
         bugReportTimelineDurationSeconds: Number = DefaultConfig.bugReportTimelineDurationSeconds,
         traceSamplingRate: Float = DefaultConfig.traceSamplingRate,
         journeySamplingRate: Float = DefaultConfig.journeySamplingRate,
         screenshotMaskLevel: ScreenshotMaskLevel = DefaultConfig.screenshotMaskLevel,
         cpuUsageInterval: Number = DefaultConfig.cpuUsageInterval,
         memoryUsageInterval: Number = DefaultConfig.memoryUsageInterval,
         crashTakeScreenshot: Bool = DefaultConfig.crashTakeScreenshot,
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
        self.crashTimelineDurationSeconds = crashTimelineDurationSeconds
        self.anrTimelineDurationSeconds = anrTimelineDurationSeconds
        self.bugReportTimelineDurationSeconds = bugReportTimelineDurationSeconds
        self.traceSamplingRate = traceSamplingRate
        self.journeySamplingRate = journeySamplingRate
        self.screenshotMaskLevel = screenshotMaskLevel
        self.cpuUsageInterval = cpuUsageInterval
        self.memoryUsageInterval = memoryUsageInterval
        self.crashTakeScreenshot = crashTakeScreenshot
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
        let c = try decoder.container(keyedBy: CodingKeys.self)
    
        maxEventsInBatch = try c.decodeIfPresent(Number.self, forKey: .maxEventsInBatch) ?? DefaultConfig.maxEventsInBatch
        crashTimelineDurationSeconds = try c.decodeIfPresent(Number.self, forKey: .crashTimelineDurationSeconds) ?? DefaultConfig.crashTimelineDurationSeconds
        anrTimelineDurationSeconds = try c.decodeIfPresent(Number.self, forKey: .anrTimelineDurationSeconds) ?? DefaultConfig.anrTimelineDurationSeconds
        bugReportTimelineDurationSeconds = try c.decodeIfPresent(Number.self, forKey: .bugReportTimelineDurationSeconds) ?? DefaultConfig.bugReportTimelineDurationSeconds
        traceSamplingRate = try c.decodeIfPresent(Float.self, forKey: .traceSamplingRate) ?? DefaultConfig.traceSamplingRate
        journeySamplingRate = try c.decodeIfPresent(Float.self, forKey: .journeySamplingRate) ?? DefaultConfig.journeySamplingRate
        screenshotMaskLevel = try c.decodeIfPresent(ScreenshotMaskLevel.self, forKey: .screenshotMaskLevel) ?? DefaultConfig.screenshotMaskLevel
        cpuUsageInterval = try c.decodeIfPresent(Number.self, forKey: .cpuUsageInterval) ?? DefaultConfig.cpuUsageInterval
        memoryUsageInterval = try c.decodeIfPresent(Number.self, forKey: .memoryUsageInterval) ?? DefaultConfig.memoryUsageInterval
        crashTakeScreenshot = try c.decodeIfPresent(Bool.self, forKey: .crashTakeScreenshot) ?? DefaultConfig.crashTakeScreenshot
        anrTakeScreenshot = try c.decodeIfPresent(Bool.self, forKey: .anrTakeScreenshot) ?? DefaultConfig.anrTakeScreenshot
        launchSamplingRate = try c.decodeIfPresent(Float.self, forKey: .launchSamplingRate) ?? DefaultConfig.launchSamplingRate
        gestureClickTakeSnapshot = try c.decodeIfPresent(Bool.self, forKey: .gestureClickTakeSnapshot) ?? DefaultConfig.gestureClickTakeSnapshot
        httpSamplingRate = try c.decodeIfPresent(Float.self, forKey: .httpSamplingRate) ?? DefaultConfig.httpSamplingRate
        httpDisableEventForUrls = try c.decodeIfPresent([String].self, forKey: .httpDisableEventForUrls) ?? DefaultConfig.httpDisableEventForUrls
        httpTrackRequestForUrls = try c.decodeIfPresent([String].self, forKey: .httpTrackRequestForUrls) ?? DefaultConfig.httpTrackRequestForUrls
        httpTrackResponseForUrls = try c.decodeIfPresent([String].self, forKey: .httpTrackResponseForUrls) ?? DefaultConfig.httpTrackResponseForUrls
        httpBlockedHeaders = try c.decodeIfPresent([String].self, forKey: .httpBlockedHeaders) ?? DefaultConfig.httpBlockedHeaders
    }

    private enum CodingKeys: String, CodingKey {
        case maxEventsInBatch = "max_events_in_batch"
        case crashTimelineDurationSeconds = "crash_timeline_duration"
        case anrTimelineDurationSeconds = "anr_timeline_duration"
        case bugReportTimelineDurationSeconds = "bug_report_timeline_duration"
        case traceSamplingRate = "trace_sampling_rate"
        case journeySamplingRate = "journey_sampling_rate"
        case screenshotMaskLevel = "screenshot_mask_level"
        case cpuUsageInterval = "cpu_usage_interval"
        case memoryUsageInterval = "memory_usage_interval"
        case crashTakeScreenshot = "crash_take_screenshot"
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
