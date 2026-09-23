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
    static let enableDiagnosticMode = false
    static let enableDiagnosticModeGesture = false

    static let maxEventsInBatch: Number = 10_000
    static let errorReplayDurationSeconds: Number = 300
    static let anrTimelineDurationSeconds: Number = 300
    static let bugReportTimelineDurationSeconds: Number = 300
    static let traceSamplingRate: Float = 100
    static let journeySamplingRate: Float = 100
    static let screenshotMaskLevel: ScreenshotMaskLevel = .allTextAndMedia
    static let logAutocollectEnabled: Bool = false
    static let logMinSeverity: Int = 16
    static let logIgnorePatterns: [String] = []
    static let cpuUsageInterval: Number = 5
    static let memoryUsageInterval: Number = 5
    static let memoryUsageSessionSamplingRate: Float = 0.01
    static let errorFatalTakeScreenshot: Bool = true
    static let errorFatalReplayEnabled: Bool = true
    static let errorUnhandledReplayEnabled: Bool = false
    static let errorHandledReplayEnabled: Bool = false
    static let errorFatalSamplingRate: Float = 100
    static let errorUnhandledSamplingRate: Float = 100
    static let errorHandledSamplingRate: Float = 0
    static let anrTakeScreenshot: Bool = true
    static let appHangThresholdMillis: Number = 2_000
    static let appHangTimelineDurationSeconds: Number = 300
    static let appHangSamplingRate: Float = 100
    static let appHangReplayEnabled: Bool = true

    /// Lower bound applied to `appHangThresholdMillis`, whatever the server sends.
    ///
    /// Measured on an idle iPhone 17: detection costs +18.4 interrupt wake-ups per second at the
    /// 2s default and +34.1 at 1s, against a 1.6/s baseline. Below 1s the cost climbs steeply —
    /// Apple's 250ms "micro hang" tier would extrapolate to roughly 85x an idle app's baseline,
    /// which is not defensible for an always-on SDK.
    ///
    /// `AppHangConstants.minIdleIntervalMs` caps the polling cost separately, so a threshold at
    /// this floor now polls no faster than the default does.
    static let minAppHangThresholdMillis: Number = 1_000
    static let launchSamplingRate: Float = 100
    static let gestureClickTakeSnapshot: Bool = true
    static let httpSamplingRate: Float = 100
    static let httpDisableEventForUrls: [String] = []
    static let httpTrackRequestForUrls: [String] = []
    static let httpTrackResponseForUrls: [String] = []
    static let httpBlockedHeaders: [String] = [
        "Authorization",
        "Cookie",
        "Set-Cookie",
        "Proxy-Authorization",
        "WWW-Authenticate",
        "X-Api-Key"
    ]
}
