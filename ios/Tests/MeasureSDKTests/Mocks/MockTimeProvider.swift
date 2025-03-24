//
//  MockTimeProvider.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 02/09/24.
//

import Foundation
@testable import Measure

final class MockTimeProvider: TimeProvider {
    var millisTime: Number = 0
    var current: Number = 0
    var iso8601Timestamp: String = ""

    func now() -> Number {
        return current
    }

    func iso8601Timestamp(timeInMillis: Number) -> String {
        return iso8601Timestamp
    }
}
