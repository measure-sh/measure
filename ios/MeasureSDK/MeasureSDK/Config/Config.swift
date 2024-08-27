//
//  Config.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 25/08/24.
//

import Foundation

struct Config: InternalConfig, MeasureConfig {
    let enableLogging: Bool
    let trackScreenshotOnCrash: Bool
    let sessionSamplingRate: Float
    let eventsBatchingIntervalMs: TimeInterval

    // Additional properties with specific values
    let maxEventsInBatch: Int

    internal init(enableLogging: Bool = DefaultConfig.enableLogging,
                  trackScreenshotOnCrash: Bool = DefaultConfig.trackScreenshotOnCrash,
                  sessionSamplingRate: Float = DefaultConfig.sessionSamplingRate) {
        self.enableLogging = enableLogging
        self.trackScreenshotOnCrash = trackScreenshotOnCrash
        self.sessionSamplingRate = sessionSamplingRate
        self.eventsBatchingIntervalMs = 30000.0 // 30 seconds
        self.maxEventsInBatch = 500
    }
}
