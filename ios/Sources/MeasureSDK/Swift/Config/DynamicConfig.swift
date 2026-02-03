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
    let httpDisableEventForUrls: [String]
    let httpTrackRequestForUrls: [String]
    let httpTrackResponseForUrls: [String]
    let httpBlockedHeaders: [String]

    static func `default`() -> BaseDynamicConfig {
        BaseDynamicConfig(maxEventsInBatch: 10_000,
                          crashTimelineDurationSeconds: 300,
                          anrTimelineDurationSeconds: 300,
                          bugReportTimelineDurationSeconds: 300,
                          traceSamplingRate: 0.01,
                          journeySamplingRate: 0.01,
                          screenshotMaskLevel: .allTextAndMedia,
                          cpuUsageInterval: 5,
                          memoryUsageInterval: 5,
                          crashTakeScreenshot: true,
                          anrTakeScreenshot: true,
                          launchSamplingRate: 0.01,
                          gestureClickTakeSnapshot: true,
                          httpDisableEventForUrls: [],
                          httpTrackRequestForUrls: [],
                          httpTrackResponseForUrls: [],
                          httpBlockedHeaders: [
                            "Authorization",
                            "Cookie",
                            "Set-Cookie",
                            "Proxy-Authorization",
                            "WWW-Authenticate",
                            "X-Api-Key",
                          ])
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
        case httpDisableEventForUrls = "http_disable_event_for_urls"
        case httpTrackRequestForUrls = "http_track_request_for_urls"
        case httpTrackResponseForUrls = "http_track_response_for_urls"
        case httpBlockedHeaders = "http_blocked_headers"
    }
}
