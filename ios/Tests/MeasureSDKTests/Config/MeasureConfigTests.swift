//
//  MeasureConfigTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 25/11/25.
//

import XCTest
@testable import Measure

final class MeasureConfigTests: XCTestCase {
    func testAllCodingKeysDecodeCorrectly() throws {
        let json = """
        {
            "enableLogging": true,
            "enableFullCollectionMode": true,
            "autoStart": false,
            "maxDiskUsageInMb": 999
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        let config = try decoder.decode(BaseMeasureConfig.self, from: json)

        XCTAssertTrue(config.enableLogging)
        XCTAssertFalse(config.autoStart)
        XCTAssertEqual(config.maxDiskUsageInMb, 999)
    }

    func testDiskUsageBelowMinimumIsClamped() {
        let config = BaseMeasureConfig(maxDiskUsageInMb: 5)
        XCTAssertEqual(config.maxDiskUsageInMb, 20)
    }

    func testDiskUsageAboveMaximumIsClamped() {
        let config = BaseMeasureConfig(maxDiskUsageInMb: 5000)
        XCTAssertEqual(config.maxDiskUsageInMb, 1500)
    }

    func testDiskUsageWithinRangeIsAccepted() {
        let config = BaseMeasureConfig(maxDiskUsageInMb: 300)
        XCTAssertEqual(config.maxDiskUsageInMb, 300)
    }
}
