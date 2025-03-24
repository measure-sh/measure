//
//  MockMemoryUsageCalculator.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 11/11/24.
//

import Foundation
@testable import Measure

final class MockMemoryUsageCalculator: MemoryUsageCalculator {
    var mockMemoryUsage: UnsignedNumber?

    func getCurrentMemoryUsage() -> UnsignedNumber? {
        return mockMemoryUsage
    }
}
