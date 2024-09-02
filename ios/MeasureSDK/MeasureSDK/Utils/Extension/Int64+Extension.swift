//
//  Int64+Extension.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 30/08/24.
//

import Foundation

internal extension Int64 {
    /// Returns a timestamp in an ISO 8601 string.
    func iso8601Timestamp() -> String {
        let date = Date(timeIntervalSince1970: TimeInterval(self) / 1000)

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }
}
