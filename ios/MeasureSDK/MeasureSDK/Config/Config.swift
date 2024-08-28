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
