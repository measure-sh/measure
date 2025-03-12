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
    var samplingRateForErrorFreeSessions: Float { get }
}

/// Configuration options for the Measure SDK. Used to customize the behavior of the SDK on initialization.
///
/// Properties:
/// - `enableLogging`: Whether to enable internal SDK logging. Defaults to `false`.
/// - `sessionSamplingRate`: The sampling rate for non-crashed sessions. Must be between 0.0 and 1.0. Defaults to 1.0.
///
@objc public final class BaseMeasureConfig: NSObject, MeasureConfig {
    let enableLogging: Bool
    let samplingRateForErrorFreeSessions: Float

    /// Configuration options for the Measure SDK. Used to customize the behavior of the SDK on initialization.
    /// - Parameters:
    ///   - enableLogging: Enable or disable internal SDK logs. Defaults to `false`.
    ///   - samplingRateForErrorFreeSessions: Sampling rate for sessions without a crash. The sampling rate is a value between 0 and 1.
    ///   For example, a value of `0.5` will export only 50% of the non-crashed sessions, and a value of `0` will disable sending non-crashed sessions to the server.
    public init(enableLogging: Bool? = nil,
                samplingRateForErrorFreeSessions: Float? = nil) {
        self.enableLogging = enableLogging ?? DefaultConfig.enableLogging
        self.samplingRateForErrorFreeSessions = samplingRateForErrorFreeSessions ?? DefaultConfig.sessionSamplingRate

        if !(0.0...1.0).contains(self.samplingRateForErrorFreeSessions) {
            fatalError("Session sampling rate must be between 0.0 and 1.0")
        }
    }
}
