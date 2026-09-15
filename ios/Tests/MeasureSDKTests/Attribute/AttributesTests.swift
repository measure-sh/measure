//
//  AttributesTests.swift
//  MeasureSDKTests
//

import XCTest
@testable import Measure

final class AttributesTests: XCTestCase {
    func testTotalMemorySurvivesEncodingAndDecoding() throws {
        for memory: UnsignedNumber in [0, 6 * 1024 * 1024] {
            let attributes = Attributes(deviceTotalMemory: memory)
            let data = try JSONEncoder().encode(attributes)
            let json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])

            XCTAssertEqual(json["device_total_memory"] as? UnsignedNumber, memory)
            XCTAssertNil(json["deviceTotalMemory"])
            XCTAssertEqual(try JSONDecoder().decode(Attributes.self, from: data).deviceTotalMemory, memory)
            XCTAssertEqual(Attributes(dict: json).deviceTotalMemory, memory)
        }
    }

    func testOlderAttributesWithoutTotalMemoryStillDecode() throws {
        let data = try JSONEncoder().encode(Attributes())
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])

        XCTAssertNil(json["device_total_memory"])
        XCTAssertNil(try JSONDecoder().decode(Attributes.self, from: data).deviceTotalMemory)
        XCTAssertNil(Attributes(dict: json).deviceTotalMemory)
    }
}
