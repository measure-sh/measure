//
//  TimeProviderTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 23/10/24.
//

import XCTest
@testable import Measure

class TimeProviderTests: XCTestCase {
    var timeProvider: BaseTimeProvider!

    override func setUp() {
        super.setUp()
        timeProvider = BaseTimeProvider()
    }

    override func tearDown() {
        timeProvider = nil
        super.tearDown()
    }

    func testIso8601Timestamp_withKnownTimestamp() {
        let timestamp: Number = 1729675641769
        let expectedIso8601String = "2024-10-23T09:27:21.769Z"

        let result = timeProvider.iso8601Timestamp(timeInMillis: timestamp)

        XCTAssertEqual(result, expectedIso8601String, "The iso8601Timestamp should return the correct formatted string.")
    }

    func testIso8601Timestamp_withCurrentTime() {
        let timestamp = timeProvider.now()
        let isoTimestamp = timeProvider.iso8601Timestamp(timeInMillis: timestamp)

        XCTAssertTrue(isoTimestamp.matchesIso8601Pattern(), "The iso8601Timestamp should return a valid ISO 8601 formatted string.")
    }
}

private extension String {
    func matchesIso8601Pattern() -> Bool {
        let regex = #"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$"#
        return self.range(of: regex, options: .regularExpression) != nil
    }
}
