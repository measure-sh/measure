//
//  MeasureConfig.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 25/08/24.
//

import Foundation

/// Configuration for the Measure SDK. See `MeasureConfig` for details.
protocol MeasureConfigProtocol {
    var enableLogging: Bool { get }
    var trackScreenshotOnCrash: Bool { get }
    var sessionSamplingRate: Float { get }
}

/// Configuration options for the Measure SDK. Used to customize the behavior of the SDK on initialization.
@objc public class MeasureConfig: NSObject, MeasureConfigProtocol {
    /// Enable or disable internal SDK logs. Defaults to `false`.
    let enableLogging: Bool

    /// Whether to capture a screenshot of the app when it crashes due to an unhandled exception or ANR. Defaults to `true`.
    let trackScreenshotOnCrash: Bool

    /// Allows setting a sampling rate for non-crashed sessions. By default, all non-crashed sessions are always exported.
    let sessionSamplingRate: Float

    public init(enableLogging: Bool = DefaultConfig.enableLogging,
                trackScreenshotOnCrash: Bool = DefaultConfig.trackScreenshotOnCrash,
                sessionSamplingRate: Float = DefaultConfig.sessionSamplingRate) {
        self.enableLogging = enableLogging
        self.trackScreenshotOnCrash = trackScreenshotOnCrash
        self.sessionSamplingRate = sessionSamplingRate

        if !(0.0...1.0).contains(sessionSamplingRate) {
            fatalError("Session sampling rate must be between 0.0 and 1.0")
        }
    }
}
