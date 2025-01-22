//
//  TimeProvider.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 30/08/24.
//

import Foundation

/// Protocol that provides current time functionality.
protocol TimeProvider {
    /// Returns a time measurement with millisecond precision for calculating time intervals.
    var millisTime: Number { get }

    /// Returns the current epoch timestamp in milliseconds.
    /// Once initialized, this time remains stable regardless of clock skew.
    func now() -> Number

    /// Returns a ISO 8601 standard timestamp as `String`
    /// - Parameter timeInMillis: A `Int64` timestamp in milliseconds
    /// - Returns: A ISO 8601 standard timestamp as `String`
    func iso8601Timestamp(timeInMillis: Number) -> String
}

/// Implementation of TimeProvider using system uptime and anchored epoch time.
final class BaseTimeProvider: TimeProvider {
    private let formatter: ISO8601DateFormatter
    private let anchoredEpochTime: Number
    private let anchoredElapsedRealtime: Number

    init() {
        self.anchoredEpochTime = Number(Date().timeIntervalSince1970 * 1000)
        self.anchoredElapsedRealtime = Number(ProcessInfo.processInfo.systemUptime * 1000)
        self.formatter = ISO8601DateFormatter()
        self.formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    }

    var millisTime: Number {
        return Number(ProcessInfo.processInfo.systemUptime * 1000)
    }

    func now() -> Number {
        return anchoredEpochTime + (Number(ProcessInfo.processInfo.systemUptime * 1000) - anchoredElapsedRealtime)
    }

    func iso8601Timestamp(timeInMillis: Number) -> String {
        let date = Date(timeIntervalSince1970: TimeInterval(timeInMillis) / 1000)
        return self.formatter.string(from: date)
    }
}
