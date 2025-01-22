//
//  Config.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 25/08/24.
//

import Foundation

/// Represents the configuration for initializing the Measure SDK.
///
/// The `Config` struct is used to specify the settings for the Measure SDK. It includes properties
/// that control various aspects of the SDK's behavior.
///
/// - Note: If no values are provided during initialization, the struct will use default values specified in `DefaultConfig` where applicable.
///
struct Config: InternalConfig, MeasureConfig {
    let enableLogging: Bool
    let trackScreenshotOnCrash: Bool
    let samplingRateForErrorFreeSessions: Float
    let eventsBatchingIntervalMs: Number
    let sessionEndLastEventThresholdMs: Number
    let longPressTimeout: TimeInterval
    let scaledTouchSlop: CGFloat
    let maxAttachmentSizeInEventsBatchInBytes: Number
    let maxEventsInBatch: Number
    let timeoutIntervalForRequest: TimeInterval
    let maxSessionDurationMs: Number
    let cpuTrackingIntervalMs: UnsignedNumber
    let memoryTrackingIntervalMs: UnsignedNumber
    let httpContentTypeAllowlist: [String]
    let defaultHttpHeadersBlocklist: [String]
    let customEventNameRegex: String
    let maxEventNameLength: Int
    let maxUserDefinedAttributeKeyLength: Int
    let maxUserDefinedAttributeValueLength: Int
    let maxUserDefinedAttributesPerEvent: Int
    let eventTypeExportAllowList: [EventType]

    internal init(enableLogging: Bool = DefaultConfig.enableLogging,
                  trackScreenshotOnCrash: Bool = DefaultConfig.trackScreenshotOnCrash,
                  samplingRateForErrorFreeSessions: Float = DefaultConfig.sessionSamplingRate) {
        self.enableLogging = enableLogging
        self.trackScreenshotOnCrash = trackScreenshotOnCrash
        self.samplingRateForErrorFreeSessions = samplingRateForErrorFreeSessions
        self.eventsBatchingIntervalMs = 30000 // 30 seconds
        self.maxEventsInBatch = 500
        self.sessionEndLastEventThresholdMs = 20 * 60 * 1000 // 20 minitues
        self.timeoutIntervalForRequest = 30 // 30 seconds
        self.longPressTimeout = 0.5 // 0.5 seconds
        self.scaledTouchSlop = 3.5 // 3.5 points
        self.maxAttachmentSizeInEventsBatchInBytes = 3_000_000 // 3 MB
        self.maxSessionDurationMs = 6 * 60 * 60 * 1000 // 6 hours
        self.cpuTrackingIntervalMs = 3 * 1000 // 3 seconds
        self.memoryTrackingIntervalMs = 2 * 1000 // 2 seconds
        self.httpContentTypeAllowlist = ["application/json"]
        self.defaultHttpHeadersBlocklist = ["Authorization",
                                            "Cookie",
                                            "Set-Cookie",
                                            "Proxy-Authorization",
                                            "WWW-Authenticate",
                                            "X-Api-Key"]
        self.customEventNameRegex = "^[a-zA-Z0-9_-]+$"
        self.maxEventNameLength = 64 // 64 chars
        self.maxUserDefinedAttributeKeyLength = 256 // 256 chars
        self.maxUserDefinedAttributeValueLength = 256 // 256 chars
        self.maxUserDefinedAttributesPerEvent = 100
        self.eventTypeExportAllowList = [.coldLaunch,
                                         .hotLaunch,
                                         .warmLaunch,
                                         .lifecycleSwiftUI,
                                         .lifecycleViewController,
                                         .screenView]
    }
}
