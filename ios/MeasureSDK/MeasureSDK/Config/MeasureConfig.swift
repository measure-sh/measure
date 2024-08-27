//
//  MeasureConfig.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 25/08/24.
//

import Foundation

/// Configuration for the Measure SDK. See `MeasureConfig` for details.
protocol MeasureConfig {
    var enableLogging: Bool { get }
    var trackScreenshotOnCrash: Bool { get }
    var sessionSamplingRate: Float { get }
}

/// Configuration options for the Measure SDK. Used to customize the behavior of the SDK on initialization.
@objc public class BaseMeasureConfig: NSObject, MeasureConfig {
    /// Enable or disable internal SDK logs. Defaults to `false`.
    let enableLogging: Bool

    /// Whether to capture a screenshot of the app when it crashes due to an unhandled exception. Defaults to `true`.
    let trackScreenshotOnCrash: Bool

    /// Allows setting a sampling rate for non-crashed sessions. Session sampling rate must be between 0.0 and 1.0. By default, all non-crashed sessions are always exported.
    let sessionSamplingRate: Float

    /// Configuration options for the Measure SDK. Used to customize the behavior of the SDK on initialization.
    /// - Parameters:
    ///   - enableLogging: Enable or disable internal SDK logs. Defaults to `false`.
    ///   - trackScreenshotOnCrash: Whether to capture a screenshot of the app when it crashes due to an unhandled exception. Defaults to `true`.
    ///   - sessionSamplingRate: Allows setting a sampling rate for non-crashed sessions. Session sampling rate must be between 0.0 and 1.0. By default, all non-crashed sessions are always exported.
    public init(enableLogging: Bool? = nil,
                trackScreenshotOnCrash: Bool? = nil,
                sessionSamplingRate: Float? = nil) {
        self.enableLogging = enableLogging ?? DefaultConfig.enableLogging
        self.trackScreenshotOnCrash = trackScreenshotOnCrash ?? DefaultConfig.trackScreenshotOnCrash
        self.sessionSamplingRate = sessionSamplingRate ?? DefaultConfig.sessionSamplingRate

        if !(0.0...1.0).contains(self.sessionSamplingRate) {
            fatalError("Session sampling rate must be between 0.0 and 1.0")
        }
    }
}
