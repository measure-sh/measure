//
//  CustomEventCollectorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 07/01/25.
//

import XCTest
@testable import Measure

final class BaseCustomEventCollectorTests: XCTestCase {
    private var logger: MockLogger!
    private var signalProcessor: MockSignalProcessor!
    private var timeProvider: MockTimeProvider!
    private var configProvider: MockConfigProvider!
    private var eventCollector: BaseCustomEventCollector!

    override func setUp() {
        super.setUp()

        logger = MockLogger()
        signalProcessor = MockSignalProcessor()
        timeProvider = MockTimeProvider()
        configProvider = MockConfigProvider()

        configProvider.customEventNameRegex = "^[a-zA-Z0-9_-]+$"
        configProvider.maxEventNameLength = 50
        configProvider.maxUserDefinedAttributesPerEvent = 10
        configProvider.maxUserDefinedAttributeKeyLength = 20
        configProvider.maxUserDefinedAttributeValueLength = 100

        eventCollector = BaseCustomEventCollector(
            logger: logger,
            signalProcessor: signalProcessor,
            timeProvider: timeProvider,
            configProvider: configProvider
        )
    }

    func testTrackEvent_whenEnabled_andValidEvent_sendsToProcessor() {
        eventCollector.enable()
        let attributes: [String: AttributeValue] = [
            "user_name": .string("Alice"),
            "is_premium": .boolean(true)
        ]

        eventCollector.trackEvent(name: "custom_event", attributes: attributes, timestamp: 123456789)

        XCTAssertNotNil(signalProcessor.data)
        XCTAssertEqual(signalProcessor.timestamp, 123456789)
        XCTAssertEqual(signalProcessor.type, .custom)
        XCTAssertTrue(signalProcessor.userDefinedAttributes!.contains("Alice"))
        XCTAssertTrue(signalProcessor.userDefinedAttributes!.contains("true"))
    }

    func testTrackEvent_whenDisabled_doesNotSendToProcessor() {
        eventCollector.disable()
        eventCollector.trackEvent(name: "custom_event", attributes: [:], timestamp: nil)

        XCTAssertNil(signalProcessor.data)
    }

    func testTrackEvent_whenNameIsEmpty_logsWarning() {
        eventCollector.enable()
        eventCollector.trackEvent(name: "", attributes: [:], timestamp: nil)

        XCTAssertNil(signalProcessor.data)
        XCTAssertTrue(logger.logs[1].contains("Event name is empty"))
    }

    func testTrackEvent_whenNameExceedsMaxLength_logsWarning() {
        eventCollector.enable()
        let longName = String(repeating: "a", count: configProvider.maxEventNameLength + 1)
        eventCollector.trackEvent(name: longName, attributes: [:], timestamp: nil)

        XCTAssertNil(signalProcessor.data)
        XCTAssertTrue(logger.logs[1].contains("exceeded max allowed length"))
    }

    func testTrackEvent_whenNameDoesNotMatchRegex_logsWarning() {
        eventCollector.enable()
        eventCollector.trackEvent(name: "invalid name!", attributes: [:], timestamp: nil)

        XCTAssertNil(signalProcessor.data)
        XCTAssertTrue(logger.logs[1].contains("does not match the allowed pattern"))
    }

    func testTrackEvent_whenTooManyAttributes_logsWarning() {
        eventCollector.enable()
        let attributes = (1...configProvider.maxUserDefinedAttributesPerEvent + 1)
            .reduce(into: [String: AttributeValue]()) { $0["key\($1)"] = .int($1) }

        eventCollector.trackEvent(name: "custom_event", attributes: attributes, timestamp: nil)

        XCTAssertNil(signalProcessor.data)
        XCTAssertTrue(logger.logs[1].contains("contains more than max allowed attributes"))
    }

    func testTrackEvent_whenAttributeKeyExceedsMaxLength_logsWarning() {
        eventCollector.enable()
        let attributes: [String: AttributeValue] = [
            String(repeating: "a", count: configProvider.maxUserDefinedAttributeKeyLength + 1): .int(1)
        ]

        eventCollector.trackEvent(name: "custom_event", attributes: attributes, timestamp: nil)

        XCTAssertNil(signalProcessor.data)
        XCTAssertTrue(logger.logs[1].contains("contains invalid attribute key"))
    }

    func testTrackEvent_whenAttributeValueExceedsMaxLength_logsWarning() {
        eventCollector.enable()
        let attributes: [String: AttributeValue] = [
            "valid_key": .string(String(repeating: "a", count: configProvider.maxUserDefinedAttributeValueLength + 1))
        ]

        eventCollector.trackEvent(name: "custom_event", attributes: attributes, timestamp: nil)

        XCTAssertNil(signalProcessor.data)
        XCTAssertTrue(logger.logs[1].contains("contains invalid attribute value"))
    }
}
