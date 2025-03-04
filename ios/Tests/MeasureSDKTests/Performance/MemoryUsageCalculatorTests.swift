//
//  MemoryUsageCalculatorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 11/11/24.
//

import XCTest
@testable import MeasureSDK

final class MemoryUsageCalculatorTests: XCTestCase {
    var memoryUsageCalculator: BaseMemoryUsageCalculator!

    override func setUp() {
        super.setUp()
        memoryUsageCalculator = BaseMemoryUsageCalculator()
    }

    override func tearDown() {
        memoryUsageCalculator = nil
        super.tearDown()
    }

    func testGetCurrentMemoryUsagePerformance() {
        // This measures the time it takes to execute getCurrentMemoryUsage()
        measure {
            _ = memoryUsageCalculator.getCurrentMemoryUsage()
        }
    }
}
