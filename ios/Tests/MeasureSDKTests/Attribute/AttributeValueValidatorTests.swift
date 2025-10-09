//
//  AttributeValueValidatorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 09/10/25.
//

import XCTest
@testable import Measure

final class AttributeValueValidatorTests: XCTestCase {
    private var mockConfigProvider: MockConfigProvider!
    private var mockLogger: MockLogger!
    private var validator: BaseAttributeValueValidator!
    
    override func setUp() {
        super.setUp()
        mockConfigProvider = MockConfigProvider()
        mockLogger = MockLogger()
        validator = BaseAttributeValueValidator(
            configProvider: mockConfigProvider,
            logger: mockLogger
        )
    }
    
    override func tearDown() {
        mockConfigProvider = nil
        mockLogger = nil
        validator = nil
        super.tearDown()
    }

    func testValidateAttributes_whenAttributesAreNil_returnsTrue() {
        let isValid = validator.validateAttributes(name: "testEvent", attributes: nil)

        XCTAssertTrue(isValid)
        XCTAssertTrue(mockLogger.logs.isEmpty)
    }
    
    func testValidateAttributes_whenAttributeCountExceedsLimit_returnsFalseAndLogsWarning() {
        let eventName = "CountTestEvent"
        mockConfigProvider.maxUserDefinedAttributesPerEvent = 1
        let attributes: [String: AttributeValue] = ["key1": .int(1), "key2": .int(2)]

        let isValid = validator.validateAttributes(name: eventName, attributes: attributes)

        XCTAssertFalse(isValid)
        XCTAssertEqual(mockLogger.logs.count, 1)
        XCTAssertTrue(mockLogger.logs.first!.contains("Event(\(eventName)) contains more than max allowed attributes. This event will be dropped."))
    }
    
    func testValidateAttributes_whenAttributeCountIsAtLimit_returnsTrue() {
        mockConfigProvider.maxUserDefinedAttributesPerEvent = 2
        let attributes: [String: AttributeValue] = ["key1": .int(1), "key2": .int(2)]

        let isValid = validator.validateAttributes(name: "testEvent", attributes: attributes)

        XCTAssertTrue(isValid)
        XCTAssertTrue(mockLogger.logs.isEmpty)
    }

    func testValidateAttributes_whenKeyLengthExceedsLimit_returnsFalseAndLogsWarning() {
        let eventName = "KeyTestEvent"
        mockConfigProvider.maxUserDefinedAttributeKeyLength = 5
        let invalidKey = "key_long"
        let attributes: [String: AttributeValue] = [invalidKey: .int(1)]

        let isValid = validator.validateAttributes(name: eventName, attributes: attributes)

        XCTAssertFalse(isValid)
        XCTAssertEqual(mockLogger.logs.count, 1)
        XCTAssertTrue(mockLogger.logs.first!.contains("Event(\(eventName)) contains invalid attribute key: \(invalidKey). This event will be dropped."))
    }
    
    func testValidateAttributes_whenKeyLengthIsWithinLimit_returnsTrue() {
        mockConfigProvider.maxUserDefinedAttributeKeyLength = 10
        let validKey = "short_key"
        let attributes: [String: AttributeValue] = [validKey: .int(1)]

        let isValid = validator.validateAttributes(name: "testEvent", attributes: attributes)

        XCTAssertTrue(isValid)
        XCTAssertTrue(mockLogger.logs.isEmpty)
    }

    func testValidateAttributes_whenStringValueLengthExceedsLimit_returnsFalseAndLogsWarning() {
        let eventName = "ValueTestEvent"
        mockConfigProvider.maxUserDefinedAttributeValueLength = 5
        let invalidString = String(repeating: "Z", count: 6)
        let attributes: [String: AttributeValue] = ["key1": .string(invalidString)]

        let isValid = validator.validateAttributes(name: eventName, attributes: attributes)

        XCTAssertFalse(isValid)
        XCTAssertEqual(mockLogger.logs.count, 1)
        XCTAssertTrue(mockLogger.logs.first!.contains("Event(\(eventName)) contains invalid attribute value. This event will be dropped."))
    }
    
    func testValidateAttributes_whenValueIsNotString_returnsTrue() {
        mockConfigProvider.maxUserDefinedAttributeValueLength = 1
        let attributes: [String: AttributeValue] = [
            "int_key": .int(9999999),
            "bool_key": .boolean(true),
        ]

        let isValid = validator.validateAttributes(name: "testEvent", attributes: attributes)

        XCTAssertTrue(isValid)
        XCTAssertTrue(mockLogger.logs.isEmpty)
    }

    func testValidateAttributes_whenMultipleValidationFails_logsBothErrorsAndReturnsFalse() {
        let eventName = "CombinedTestEvent"
        mockConfigProvider.maxUserDefinedAttributeKeyLength = 2
        mockConfigProvider.maxUserDefinedAttributeValueLength = 2
        let attributes: [String: AttributeValue] = ["long": .string("long")]

        let isValid = validator.validateAttributes(name: eventName, attributes: attributes)

        XCTAssertFalse(isValid)
        XCTAssertEqual(mockLogger.logs.count, 2)
        XCTAssertTrue(mockLogger.logs.contains(where: { $0.contains("invalid attribute key: long") }))
        XCTAssertTrue(mockLogger.logs.contains(where: { $0.contains("invalid attribute value") }))
    }
    
    func testValidateAttributes_whenCountLimitFails_keyAndValueValidationIsSkipped() {
        let eventName = "ShortCircuitEvent"
        mockConfigProvider.maxUserDefinedAttributesPerEvent = 1
        mockConfigProvider.maxUserDefinedAttributeKeyLength = 1
        let attributes: [String: AttributeValue] = [
            "key1_long": .int(1),
            "key2_long": .int(2)
        ]

        let isValid = validator.validateAttributes(name: eventName, attributes: attributes)

        XCTAssertFalse(isValid)
        XCTAssertEqual(mockLogger.logs.count, 1)
        XCTAssertTrue(mockLogger.logs.first!.contains("Event(\(eventName)) contains more than max allowed attributes."))
    }
}
