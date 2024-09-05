//
//  BaseSystemTimeTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 02/09/24.
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

    func testISO8601Timestamp() {
        let timeInMillis: Int64 = 1_000_000_000_000
        let expectedTimestamp = "2001-09-09T01:46:40.000Z"
        let timestamp = systemTime.iso8601Timestamp(timeInMillis: timeInMillis)

        XCTAssertEqual(timestamp, expectedTimestamp, "ISO 8601 timestamp should match the expected value")
    }
}
