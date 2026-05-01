//
//  WebPEncoderTests.swift
//  MeasureSDKTests
//

import XCTest
@testable import Measure

final class WebPEncoderTests: XCTestCase {
    func testEncode_returnsNilForMalformedInput() {
        XCTAssertNil(WebPEncoder.encode(pixels: Data(count: 4), width: 2, height: 2, quality: 25))
    }

    func testEncode_returnsBytesForValidInput() {
        let pixels = Data(count: 2 * 2 * 4)

        let encoded = WebPEncoder.encode(pixels: pixels, width: 2, height: 2, quality: 25)

        XCTAssertNotNil(encoded)
    }
}
