//
//  StringExtensionTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 08/10/26.
//

import XCTest
@testable import Measure

final class StringExtensionTests: XCTestCase {
    func testTruncated_returnsStringUnchanged_whenShorterThanMaxLength() {
        XCTAssertEqual("abc".truncated(maxLength: 5), "abc")
    }

    func testTruncated_returnsStringUnchanged_whenEqualToMaxLength() {
        let value = String(repeating: "a", count: 128)

        XCTAssertEqual(value.truncated(maxLength: 128), value)
    }

    func testTruncated_truncatesToMaxLength_whenLongerThanMaxLength() {
        let value = String(repeating: "a", count: 129)

        let result = value.truncated(maxLength: 128)

        XCTAssertEqual(result.count, 128)
        XCTAssertEqual(result, String(repeating: "a", count: 128))
    }

    func testTruncated_keepsPrefix() {
        XCTAssertEqual("MyApp.HomeViewController".truncated(maxLength: 5), "MyApp")
    }

    func testTruncated_returnsEmptyString_whenStringIsEmpty() {
        XCTAssertEqual("".truncated(maxLength: 10), "")
    }

    func testTruncated_returnsEmptyString_whenMaxLengthIsZero() {
        XCTAssertEqual("abc".truncated(maxLength: 0), "")
    }

    func testTruncated_returnsEmptyString_whenMaxLengthIsNegative() {
        XCTAssertEqual("abc".truncated(maxLength: -1), "")
    }

    func testTruncated_launchedActivityLimit_staysBelowBackendLimit() {
        let className = String(repeating: "c", count: 200)

        let result = className.truncated(maxLength: ValidationLimits.launchedActivity)

        XCTAssertEqual(result.count, 127)
    }
}
