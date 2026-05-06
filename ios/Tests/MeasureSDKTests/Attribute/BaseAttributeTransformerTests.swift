//
//  BaseAttributeTransformerTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 05/05/26.
//

import XCTest
@testable import Measure

final class BaseAttributeTransformerTests: XCTestCase {
    private var logger: MockLogger!
    private var transformer: BaseAttributeTransformer!

    override func setUp() {
        super.setUp()
        logger = MockLogger()
        transformer = BaseAttributeTransformer(logger: logger)
    }

    override func tearDown() {
        logger = nil
        transformer = nil
        super.tearDown()
    }

    func test_returnsEmptyDict_whenInputIsNil() {
        let result = transformer.transformAttributes(nil)
        XCTAssertTrue(result.isEmpty)
    }

    func test_convertsStringValue() {
        let result = transformer.transformAttributes(["key": "hello"])
        guard case .string(let value) = result["key"] else {
            return XCTFail("Expected .string, got \(String(describing: result["key"]))")
        }
        XCTAssertEqual(value, "hello")
    }

    func test_convertsBoolValue() {
        let result = transformer.transformAttributes(["key": true])
        guard case .boolean(let value) = result["key"] else {
            return XCTFail("Expected .boolean, got \(String(describing: result["key"]))")
        }
        XCTAssertTrue(value)
    }

    func test_convertsIntValue() {
        let result = transformer.transformAttributes(["key": 42])
        guard case .int(let value) = result["key"] else {
            return XCTFail("Expected .int, got \(String(describing: result["key"]))")
        }
        XCTAssertEqual(value, 42)
    }

    func test_convertsInt64Value() {
        let result = transformer.transformAttributes(["key": Int64(9_000_000_000)])
        guard case .long(let value) = result["key"] else {
            return XCTFail("Expected .long, got \(String(describing: result["key"]))")
        }
        XCTAssertEqual(value, 9_000_000_000)
    }

    func test_convertsFloatValue() {
        let result = transformer.transformAttributes(["key": Float(1.5)])
        guard case .float(let value) = result["key"] else {
            return XCTFail("Expected .float, got \(String(describing: result["key"]))")
        }
        XCTAssertEqual(value, Float(1.5))
    }

    func test_convertsDoubleValue() {
        let result = transformer.transformAttributes(["key": Double(2.5)])
        guard case .double(let value) = result["key"] else {
            return XCTFail("Expected .double, got \(String(describing: result["key"]))")
        }
        XCTAssertEqual(value, 2.5)
    }

    func test_skipsUnsupportedTypes() {
        let result = transformer.transformAttributes(["key": NSArray()])
        XCTAssertNil(result["key"])
    }

    func test_prefersBoolOverInt_forNSNumberBoolValues() {
        // NSNumber(value: true) satisfies both `as? Bool` and `as? Int` when bridged from ObjC.
        // The transformer must resolve to .boolean, not .int.
        let result = transformer.transformAttributes(["flag": NSNumber(value: true)])
        guard case .boolean(let value) = result["flag"] else {
            return XCTFail("Expected .boolean, got \(String(describing: result["flag"]))")
        }
        XCTAssertTrue(value)
    }

    func test_logsError_whenValueTypeIsUnsupported() {
        var capturedLevel: LogLevel?
        logger.onLog = { level, _, _, _ in capturedLevel = level }

        _ = transformer.transformAttributes(["key": NSArray()])

        XCTAssertEqual(capturedLevel, .fatal)
    }
}
