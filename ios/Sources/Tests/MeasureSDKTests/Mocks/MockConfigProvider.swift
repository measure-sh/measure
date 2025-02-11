//
//  MockConfigProvider.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 02/09/24.
//

import Foundation
@testable import MeasureSDK

final class MockConfigProvider: ConfigProvider {
    var cpuTrackingIntervalMs: UnsignedNumber
    var memoryTrackingIntervalMs: UnsignedNumber
    var maxSessionDurationMs: Number
    var enableLogging: Bool
    var trackScreenshotOnCrash: Bool
    var samplingRateForErrorFreeSessions: Float
    var eventsBatchingIntervalMs: Number
    var sessionEndLastEventThresholdMs: Number
    var longPressTimeout: TimeInterval
    var scaledTouchSlop: CGFloat
    var maxAttachmentSizeInEventsBatchInBytes: Number
    var maxEventsInBatch: Number
    var timeoutIntervalForRequest: TimeInterval
    var customEventNameRegex: String
    var maxEventNameLength: Int
    var maxUserDefinedAttributeKeyLength: Int
    var maxUserDefinedAttributeValueLength: Int
    var maxUserDefinedAttributesPerEvent: Int
    var httpContentTypeAllowlist: [String]
    var defaultHttpHeadersBlocklist: [String]
    var eventTypeExportAllowList: [EventType]
    var screenshotMaskHexColor: String
    var screenshotCompressionQuality: Int
    var layoutSnapshotDebounceInterval: Number

    init(enableLogging: Bool = false,
         trackScreenshotOnCrash: Bool = true,
         samplingRateForErrorFreeSessions: Float = 1.0,
         eventsBatchingIntervalMs: Number = 30000,
         sessionEndLastEventThresholdMs: Number = 60 * 1000,
         longPressTimeout: TimeInterval = 500,
         scaledTouchSlop: CGFloat = 3.5,
         maxAttachmentSizeInEventsBatchInBytes: Number = 3_000_000,
         maxEventsInBatch: Number = 500,
         timeoutIntervalForRequest: TimeInterval = 30,
         maxSessionDurationMs: Number = 60 * 60 * 1000,
         cpuTrackingIntervalMs: UnsignedNumber = 3000,
         memoryTrackingIntervalMs: UnsignedNumber = 2000,
         customEventNameRegex: String = "^[a-zA-Z0-9_-]",
         maxEventNameLength: Int = 64,
         maxUserDefinedAttributeKeyLength: Int = 256,
         maxUserDefinedAttributeValueLength: Int = 256,
         maxUserDefinedAttributesPerEvent: Int = 100,
         httpContentTypeAllowlist: [String] = ["application/json"],
         defaultHttpHeadersBlocklist: [String] = ["Authorization",
                                                  "Cookie",
                                                  "Set-Cookie",
                                                  "Proxy-Authorization",
                                                  "WWW-Authenticate",
                                                  "X-Api-Key"],
         eventTypeExportAllowList: [EventType] = [.coldLaunch,
                                                  .hotLaunch,
                                                  .warmLaunch,
                                                  .lifecycleSwiftUI,
                                                  .lifecycleViewController,
                                                  .screenView],
         screenshotMaskHexColor: String = "#222222",
         screenshotCompressionQuality: Int = 25,
         layoutSnapshotDebounceInterval: Number = 750) {
        self.enableLogging = enableLogging
        self.trackScreenshotOnCrash = trackScreenshotOnCrash
        self.samplingRateForErrorFreeSessions = samplingRateForErrorFreeSessions
        self.eventsBatchingIntervalMs = eventsBatchingIntervalMs
        self.sessionEndLastEventThresholdMs = sessionEndLastEventThresholdMs
        self.longPressTimeout = longPressTimeout
        self.scaledTouchSlop = scaledTouchSlop
        self.maxAttachmentSizeInEventsBatchInBytes = maxAttachmentSizeInEventsBatchInBytes
        self.maxEventsInBatch = maxEventsInBatch
        self.timeoutIntervalForRequest = timeoutIntervalForRequest
        self.maxSessionDurationMs = maxSessionDurationMs
        self.cpuTrackingIntervalMs = cpuTrackingIntervalMs
        self.memoryTrackingIntervalMs = memoryTrackingIntervalMs
        self.customEventNameRegex = customEventNameRegex
        self.maxEventNameLength = maxEventNameLength
        self.maxUserDefinedAttributeKeyLength = maxUserDefinedAttributeKeyLength
        self.maxUserDefinedAttributeValueLength = maxUserDefinedAttributeValueLength
        self.maxUserDefinedAttributesPerEvent = maxUserDefinedAttributesPerEvent
        self.httpContentTypeAllowlist = httpContentTypeAllowlist
        self.defaultHttpHeadersBlocklist = defaultHttpHeadersBlocklist
        self.eventTypeExportAllowList = eventTypeExportAllowList
        self.screenshotMaskHexColor = screenshotMaskHexColor
        self.screenshotCompressionQuality = screenshotCompressionQuality
        self.layoutSnapshotDebounceInterval = layoutSnapshotDebounceInterval
    }

    func loadNetworkConfig() {}
}
