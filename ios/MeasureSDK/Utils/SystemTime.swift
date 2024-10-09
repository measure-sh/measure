//
//  SystemTime.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 02/09/24.
//

import Foundation

protocol SystemTime {
    var timeIntervalSince1970: Number { get }
    var systemUptime: Number { get }
    func iso8601Timestamp(timeInMillis: Number) -> String
}

struct BaseSystemTime: SystemTime {
    let formatter: ISO8601DateFormatter
    var timeIntervalSince1970: Number {
        return Number(Date().timeIntervalSince1970)
    }
    var systemUptime: Number {
        return Number(ProcessInfo.processInfo.systemUptime)
    }

    init() {
        self.formatter = ISO8601DateFormatter()
        self.formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    }

    /// Returns an ISO 8601 standard timestamp as `String`.
    /// - Parameter timeInMillis: The time in milliseconds since the Unix epoch.
    /// - Returns: A ISO 8601 standard timestamp as `String`.
    func iso8601Timestamp(timeInMillis: Number) -> String {
        let date = Date(timeIntervalSince1970: TimeInterval(timeInMillis) / 1000)
        return self.formatter.string(from: date)
    }
}
