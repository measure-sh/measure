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

    /// The threshold to determine long press. Defaults to 0.5 second.
    var longPressTimeout: TimeInterval { get }

    /// The minimum movement before a touch is detected as a scroll. Defaults to 20 points.
    var scaledTouchSlop: CGFloat { get }
}