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
    let samplingRateForErrorFreeSessions: Float
    let traceSamplingRate: Float
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
    let screenshotMaskHexColor: String
    let screenshotCompressionQuality: Int
    let layoutSnapshotDebounceInterval: Number
    let trackHttpHeaders: Bool
    let trackHttpBody: Bool
    let httpHeadersBlocklist: [String]
    let httpUrlBlocklist: [String]
    let httpUrlAllowlist: [String]
    let autoStart: Bool
    let maxSpanNameLength: Int
    let maxCheckpointNameLength: Int
    let maxCheckpointsPerSpan: Int
    let trackViewControllerLoadTime: Bool
    let maxAttachmentsInBugReport: Int
    let maxDescriptionLengthInBugReport: Int
    let shakeAccelerationThreshold: Float
    let shakeMinTimeIntervalMs: Number
    let accelerometerUpdateInterval: TimeInterval
    let screenshotMaskLevel: ScreenshotMaskLevel
    let requestHeadersProvider: MsrRequestHeadersProvider?
    let disallowedCustomHeaders: [String]

    internal init(enableLogging: Bool = DefaultConfig.enableLogging, // swiftlint:disable:this function_body_length
                  samplingRateForErrorFreeSessions: Float = DefaultConfig.sessionSamplingRate,
                  traceSamplingRate: Float = DefaultConfig.traceSamplingRate,
                  trackHttpHeaders: Bool = DefaultConfig.trackHttpHeaders,
                  trackHttpBody: Bool = DefaultConfig.trackHttpBody,
                  httpHeadersBlocklist: [String] = DefaultConfig.httpHeadersBlocklist,
                  httpUrlBlocklist: [String] = DefaultConfig.httpUrlBlocklist,
                  httpUrlAllowlist: [String] = DefaultConfig.httpUrlAllowlist,
                  autoStart: Bool = DefaultConfig.autoStart,
                  trackViewControllerLoadTime: Bool = DefaultConfig.trackViewControllerLoadTime,
                  screenshotMaskLevel: ScreenshotMaskLevel = DefaultConfig.screenshotMaskLevel,
                  requestHeadersProvider: MsrRequestHeadersProvider? = nil) {
        self.enableLogging = enableLogging
        self.samplingRateForErrorFreeSessions = samplingRateForErrorFreeSessions
        self.traceSamplingRate = traceSamplingRate
        self.trackHttpHeaders = trackHttpHeaders
        self.trackHttpBody = trackHttpBody
        self.httpHeadersBlocklist = httpHeadersBlocklist
        self.httpUrlBlocklist = httpUrlBlocklist
        self.httpUrlAllowlist = httpUrlAllowlist
        self.autoStart = autoStart
        self.trackViewControllerLoadTime = trackViewControllerLoadTime
        self.screenshotMaskLevel = screenshotMaskLevel
        self.eventsBatchingIntervalMs = 30000 // 30 seconds
        self.maxEventsInBatch = 500
        self.sessionEndLastEventThresholdMs = 20 * 60 * 1000 // 20 minitues
        self.timeoutIntervalForRequest = 30 // 30 seconds
        self.longPressTimeout = 500 // 500 ms
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
        self.screenshotMaskHexColor = "#222222"
        self.screenshotCompressionQuality = 25
        self.layoutSnapshotDebounceInterval = 750 // 750 ms
        self.maxSpanNameLength = 64
        self.maxCheckpointNameLength = 64
        self.maxCheckpointsPerSpan = 100
        self.maxAttachmentsInBugReport = 5
        self.maxDescriptionLengthInBugReport = 4000
        self.shakeAccelerationThreshold = 2.5
        self.shakeMinTimeIntervalMs = 1500
        self.accelerometerUpdateInterval = 0.1
        self.requestHeadersProvider = requestHeadersProvider
        self.disallowedCustomHeaders = DefaultConfig.disallowedCustomHeaders
    }
}
