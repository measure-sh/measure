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
    var eventsBatchingIntervalMs: Int64
    var sessionEndThresholdMs: Int64

    init(enableLogging: Bool,
         trackScreenshotOnCrash: Bool,
         sessionSamplingRate: Float,
         eventsBatchingIntervalMs: Int64,
         sessionEndThresholdMs: Int64) {
        self.enableLogging = enableLogging
        self.trackScreenshotOnCrash = trackScreenshotOnCrash
        self.sessionSamplingRate = sessionSamplingRate
        self.eventsBatchingIntervalMs = eventsBatchingIntervalMs
        self.sessionEndThresholdMs = sessionEndThresholdMs
    }

    func loadNetworkConfig() {}
}
