//
//  MockTimeProvider.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 02/09/24.
//

import Foundation
@testable import MeasureSDK

final class MockTimeProvider: TimeProvider {
    var currentTimeSinceEpochInMillis: Int64
    var currentTimeSinceEpochInNanos: Int64
    var uptimeInMillis: Int64
    private let iso8601Timestamp: String

    func iso8601Timestamp(timeInMillis: Int64) -> String {
        return iso8601Timestamp
    }

    init(currentTimeSinceEpochInMillis: Int64,
         currentTimeSinceEpochInNanos: Int64,
         uptimeInMillis: Int64,
         iso8601Timestamp: String) {
        self.currentTimeSinceEpochInMillis = currentTimeSinceEpochInMillis
        self.currentTimeSinceEpochInNanos = currentTimeSinceEpochInNanos
        self.uptimeInMillis = uptimeInMillis
        self.iso8601Timestamp = iso8601Timestamp
    }
}
