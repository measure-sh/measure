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

    init(enableLogging: Bool,
         trackScreenshotOnCrash: Bool,
         sessionSamplingRate: Float,
         eventsBatchingIntervalMs: Number,
         sessionEndThresholdMs: Number,
         longPressTimeout: TimeInterval,
         scaledTouchSlop: CGFloat) {
        self.enableLogging = enableLogging
        self.trackScreenshotOnCrash = trackScreenshotOnCrash
        self.sessionSamplingRate = sessionSamplingRate
        self.eventsBatchingIntervalMs = eventsBatchingIntervalMs
        self.sessionEndThresholdMs = sessionEndThresholdMs
        self.longPressTimeout = longPressTimeout
        self.scaledTouchSlop = scaledTouchSlop
    }

    func loadNetworkConfig() {}
}
