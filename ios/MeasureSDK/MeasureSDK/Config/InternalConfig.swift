//
//  InternalConfig.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 25/08/24.
//

import Foundation

/// Internal configuration options for the Measure SDK.
protocol InternalConfig {
    /// The interval at which to create a batch for export.
    var eventsBatchingIntervalMs: Number { get }

    /// The threshold after which a session is considered ended. Defaults to 1 minute.
    var sessionEndThresholdMs: Number { get }
}
