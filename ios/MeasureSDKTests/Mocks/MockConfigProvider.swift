//
//  MockConfigProvider.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 02/09/24.
//

import Foundation
@testable import MeasureSDK

final class MockConfigProvider: ConfigProvider {
    var enableLogging: Bool
    var trackScreenshotOnCrash: Bool
    var sessionSamplingRate: Float
    var eventsBatchingIntervalMs: Number
    var sessionEndThresholdMs: Number
    var longPressTimeout: TimeInterval
    var scaledTouchSlop: CGFloat
    var maxAttachmentSizeInEventsBatchInBytes: Number
    var maxEventsInBatch: Number
    var timeoutIntervalForRequest: TimeInterval

    init(enableLogging: Bool = false,
         trackScreenshotOnCrash: Bool = true,
         sessionSamplingRate: Float = 1.0,
         eventsBatchingIntervalMs: Number = 30000,
         sessionEndThresholdMs: Number = 60 * 1000, // 1 minitue
         longPressTimeout: TimeInterval = 500,
         scaledTouchSlop: CGFloat = 3.5,
         maxAttachmentSizeInEventsBatchInBytes: Number = 3_000_000,
         maxEventsInBatch: Number = 500,
         timeoutIntervalForRequest: TimeInterval = 30) {
        self.enableLogging = enableLogging
        self.trackScreenshotOnCrash = trackScreenshotOnCrash
        self.sessionSamplingRate = sessionSamplingRate
        self.eventsBatchingIntervalMs = eventsBatchingIntervalMs
        self.sessionEndThresholdMs = sessionEndThresholdMs
        self.longPressTimeout = longPressTimeout
        self.scaledTouchSlop = scaledTouchSlop
        self.maxAttachmentSizeInEventsBatchInBytes = maxAttachmentSizeInEventsBatchInBytes
        self.maxEventsInBatch = maxEventsInBatch
        self.timeoutIntervalForRequest = timeoutIntervalForRequest
    }

    func loadNetworkConfig() {}
}
