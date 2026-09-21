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
    var mockAvailableMemory: UnsignedNumber?

    func getCurrentMemoryUsage() -> MemoryUsageSnapshot? {
        return mockMemoryUsage.map { MemoryUsageSnapshot(usedMemory: $0, availableMemory: mockAvailableMemory) }
    }
}
