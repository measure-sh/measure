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
    static let sessionSamplingRate: Float = 0.0
    static let traceSamplingRate: Float = 0.0001
    static let trackHttpHeaders = false
    static let trackHttpBody = false
    static let httpHeadersBlocklist: [String] = []
    static let httpUrlBlocklist: [String] = []
    static let httpUrlAllowlist: [String] = []
    static let autoStart = true
    static let screenshotMaskLevel: ScreenshotMaskLevel = .allTextAndMedia
    static let disallowedCustomHeaders = ["Content-Type", "msr-req-id", "Authorization", "Content-Length"]
    static let maxEstimatedDiskUsageInMb = 50 // 50MB
    static let coldLaunchSamplingRate: Float = 0.01
    static let warmLaunchSamplingRate: Float = 0.01
    static let hotLaunchSamplingRate: Float = 0.01
    static let journeySamplingRate: Float = 0
}
