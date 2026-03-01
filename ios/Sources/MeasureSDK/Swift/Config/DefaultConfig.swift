//
//  DefaultConfig.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 25/08/24.
//

import Foundation

/// Default values of configuration options for the Measure SDK.
struct DefaultConfig {
    static let enableLogging = false
    static let autoStart = true
    static let maxDiskUsageInMb: Number = 50
    static let enableFullCollectionMode = false
    static let disallowedCustomHeaders: [String] = ["Content-Type",
                                                    "msr-req-id",
                                                    "Authorization",
                                                    "Content-Length"]
    static let journeyEvents: [EventType] = [.lifecycleSwiftUI,
                                             .lifecycleViewController,
                                             .screenView]

    static let maxEventsInBatch: Number = 10_000
    static let crashTimelineDurationSeconds: Number = 300
    static let anrTimelineDurationSeconds: Number = 300
    static let bugReportTimelineDurationSeconds: Number = 300
    static let traceSamplingRate: Float = 0.01
    static let journeySamplingRate: Float = 0.01
    static let screenshotMaskLevel: ScreenshotMaskLevel = .allTextAndMedia
    static let cpuUsageInterval: Number = 5
    static let memoryUsageInterval: Number = 5
    static let crashTakeScreenshot: Bool = true
    static let anrTakeScreenshot: Bool = true
    static let launchSamplingRate: Float = 0.01
    static let gestureClickTakeSnapshot: Bool = true
    static let httpSamplingRate: Float = 0.01
    static let httpDisableEventForUrls: [String] = []
    static let httpTrackRequestForUrls: [String] = []
    static let httpTrackResponseForUrls: [String] = []
    static let httpBlockedHeaders: [String] = [
        "Authorization",
        "Cookie",
        "Set-Cookie",
        "Proxy-Authorization",
        "WWW-Authenticate",
        "X-Api-Key",
    ]
}
