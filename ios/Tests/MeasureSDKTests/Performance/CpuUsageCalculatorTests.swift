//
//  CpuUsageCalculatorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 11/11/24.
//

import XCTest
@testable import Measure

final class CpuUsageCalculatorTests: XCTestCase {

    var cpuUsageCalculator: BaseCpuUsageCalculator!

    override func setUp() {
        super.setUp()
        cpuUsageCalculator = BaseCpuUsageCalculator()
    }

    override func tearDown() {
        cpuUsageCalculator = nil
        super.tearDown()
    }

    func testGetCurrentMemoryUsagePerformance() {
        // This measures the time it takes to execute getCurrentMemoryUsage()
        measure {
            _ = cpuUsageCalculator.getCurrentCpuUsage()
        }
    }
}
