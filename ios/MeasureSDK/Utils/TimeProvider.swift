//
//  TimeProvider.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 30/08/24.
//

import Foundation

/// Provides time from different clocks.
protocol TimeProvider {
    var currentTimeSinceEpochInMillis: Number { get }
    var currentTimeSinceEpochInNanos: Number { get }
    var uptimeInMillis: Number { get }
    func iso8601Timestamp(timeInMillis: Number) -> String
}

/// Client Info identifiers for the Measure SDK.
///
/// Properties:
/// - `currentTimeSinceEpochInMillis`: The standard "wall" clock (time and date) expressing milliseconds since the epoch.
/// - `currentTimeSinceEpochInNanos`: Same as `currentTimeSinceEpochInMillis`, but in nanoseconds.
/// - `uptimeInMillis`: Milliseconds since the system was booted. This clock stops when the system enters deep sleep but is not affected by clock scaling, idle, or other power-saving mechanisms.
///
struct SystemTimeProvider: TimeProvider {
    private let systemTime: SystemTime
    var currentTimeSinceEpochInMillis: Number {
        return systemTime.timeIntervalSince1970 * 1000
    }

    var currentTimeSinceEpochInNanos: Number {
        return currentTimeSinceEpochInMillis * 1_000_000
    }

    var uptimeInMillis: Number {
        return systemTime.systemUptime * 1000
    }

    init(systemTime: SystemTime) {
        self.systemTime = systemTime
    }

    /// Returns a ISO 8601 standard timestamp as `String`
    /// - Parameter timeInMillis: A `Int64` timestamp in milliseconds
    /// - Returns: A ISO 8601 standard timestamp as `String`
    func iso8601Timestamp(timeInMillis: Number) -> String {
        return systemTime.iso8601Timestamp(timeInMillis: timeInMillis)
    }
}
