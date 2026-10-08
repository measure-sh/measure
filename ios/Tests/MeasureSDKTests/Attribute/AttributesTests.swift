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

    func testSanitize_truncatesValuesLongerThanBackendLimits() {
        let attributes = Attributes()
        attributes.threadName = String(repeating: "t", count: 200)
        attributes.deviceName = String(repeating: "n", count: 200)
        attributes.deviceModel = String(repeating: "m", count: 200)
        attributes.deviceLocale = String(repeating: "l", count: 200)
        attributes.networkProvider = String(repeating: "p", count: 200)
        attributes.userId = String(repeating: "u", count: 200)
        attributes.patchVersion = String(repeating: "v", count: 300)
        attributes.appVersion = String(repeating: "a", count: 200)
        attributes.appBuild = String(repeating: "b", count: 200)

        attributes.sanitize()

        XCTAssertEqual(attributes.threadName?.count, ValidationLimits.threadName)
        XCTAssertEqual(attributes.deviceName?.count, ValidationLimits.deviceName)
        XCTAssertEqual(attributes.deviceModel?.count, ValidationLimits.deviceModel)
        XCTAssertEqual(attributes.deviceLocale?.count, ValidationLimits.deviceLocale)
        XCTAssertEqual(attributes.networkProvider?.count, ValidationLimits.networkProvider)
        XCTAssertEqual(attributes.userId?.count, ValidationLimits.userId)
        XCTAssertEqual(attributes.patchVersion?.count, ValidationLimits.patchVersion)
        XCTAssertEqual(attributes.appVersion.count, ValidationLimits.appVersion)
        XCTAssertEqual(attributes.appBuild.count, ValidationLimits.appBuild)
    }

    func testSanitize_leavesValuesWithinLimitsUnchanged() {
        let attributes = Attributes()
        attributes.threadName = "main"
        attributes.deviceName = "iPhone"
        attributes.deviceModel = "iPhone 17 Pro"
        attributes.deviceLocale = "en_US"
        attributes.appVersion = "1.0.0"
        attributes.appBuild = "100"

        attributes.sanitize()

        XCTAssertEqual(attributes.threadName, "main")
        XCTAssertEqual(attributes.deviceName, "iPhone")
        XCTAssertEqual(attributes.deviceModel, "iPhone 17 Pro")
        XCTAssertEqual(attributes.deviceLocale, "en_US")
        XCTAssertEqual(attributes.appVersion, "1.0.0")
        XCTAssertEqual(attributes.appBuild, "100")
        XCTAssertNil(attributes.networkProvider)
        XCTAssertNil(attributes.userId)
        XCTAssertNil(attributes.patchVersion)
    }

    func testOlderAttributesWithoutTotalMemoryStillDecode() throws {
        let data = try JSONEncoder().encode(Attributes())
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])

        XCTAssertNil(json["device_total_memory"])
        XCTAssertNil(try JSONDecoder().decode(Attributes.self, from: data).deviceTotalMemory)
        XCTAssertNil(Attributes(dict: json).deviceTotalMemory)
    }
}
