//
//  MockTimeProvider.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 02/09/24.
//

import Foundation
@testable import MeasureSDK

final class MockTimeProvider: TimeProvider {
    var elapsedRealtime: Number
    var currentTimeSinceEpochInMillis: Number
    var currentTimeSinceEpochInNanos: Number
    var uptimeInMillis: Number
    private let iso8601Timestamp: String

    func iso8601Timestamp(timeInMillis: Number) -> String {
        return iso8601Timestamp
    }

    init(currentTimeSinceEpochInMillis: Number = 0,
         currentTimeSinceEpochInNanos: Number = 0,
         uptimeInMillis: Number = 0,
         iso8601Timestamp: String = "",
         elapsedRealtime: Number = 0) {
        self.currentTimeSinceEpochInMillis = currentTimeSinceEpochInMillis
        self.currentTimeSinceEpochInNanos = currentTimeSinceEpochInNanos
        self.uptimeInMillis = uptimeInMillis
        self.iso8601Timestamp = iso8601Timestamp
        self.elapsedRealtime = elapsedRealtime
    }
}
