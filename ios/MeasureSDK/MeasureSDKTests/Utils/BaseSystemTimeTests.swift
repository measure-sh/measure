//
//  BaseSystemTimeTests.swift
//  MeasureSDKTests
//
//  Created by EdPu on 02/09/24.
//

import XCTest
@testable import MeasureSDK

final class BaseSystemTimeTests: XCTestCase {
    var systemTime: BaseSystemTime!

    override func setUp() {
        super.setUp()
        systemTime = BaseSystemTime()
    }

    override func tearDown() {
        systemTime = nil
        super.tearDown()
    }

    func testTimeIntervalSince1970() {
        let timeInterval = systemTime.timeIntervalSince1970

        let expectedTimeInterval = Int64(Date().timeIntervalSince1970)

        let tolerance: Int64 = 1

        XCTAssertEqual(timeInterval, expectedTimeInterval, accuracy: Int64(tolerance), "timeIntervalSince1970 should be close to the current time interval")
    }

    func testSystemUptime() {
        let systemUptime = systemTime.systemUptime

        let expectedUptime = Int64(ProcessInfo.processInfo.systemUptime)

        let tolerance: Int64 = 1

        XCTAssertEqual(systemUptime, expectedUptime, accuracy: Int64(tolerance), "systemUptime should be close to the current system uptime")
    }

    func testISO8601Timestamp() {
        let timeInMillis: Int64 = 1_000_000_000_000
        let expectedTimestamp = "2001-09-09T01:46:40.000Z"
        let timestamp = systemTime.iso8601Timestamp(timeInMillis: timeInMillis)

        XCTAssertEqual(timestamp, expectedTimestamp, "ISO 8601 timestamp should match the expected value")
    }
}
