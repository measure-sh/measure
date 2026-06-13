//
//  LogEventCollectorTests.swift
//  MeasureSDKTests
//
//  Created by Abhay Sood on 11/06/26.
//

import XCTest
@testable import Measure

final class BaseLogEventCollectorTests: XCTestCase {
    private var logger: MockLogger!
    private var signalProcessor: MockSignalProcessor!
    private var timeProvider: MockTimeProvider!
    private var configProvider: MockConfigProvider!
    private var logEventCollector: BaseLogEventCollector!

    override func setUp() {
        super.setUp()

        logger = MockLogger()
        signalProcessor = MockSignalProcessor()
        timeProvider = MockTimeProvider()
        configProvider = MockConfigProvider()

        logEventCollector = BaseLogEventCollector(
            logger: logger,
            signalProcessor: signalProcessor,
            timeProvider: timeProvider,
            configProvider: configProvider,
            attributeValueValidator: BaseAttributeValueValidator(configProvider: configProvider, logger: logger)
        )
    }

    func testTrackLog_whenEnabled_sendsToProcessor() {
        logEventCollector.enable()

        logEventCollector.trackLog(body: "something happened", severity: .error, attributes: [:], timestamp: nil)

        guard let data = signalProcessor.data as? LogData else {
            XCTFail("Expected signalProcessor.data to be of type LogData")
            return
        }
        XCTAssertEqual(data.severityText, "error")
        XCTAssertEqual(data.body, "something happened")
        XCTAssertEqual(signalProcessor.type, .log)
    }

    func testTrackLog_withAttributes_serializesUserDefinedAttributes() {
        logEventCollector.enable()
        let attributes: [String: AttributeValue] = ["user_name": .string("Alice")]

        logEventCollector.trackLog(body: "something happened", severity: .info, attributes: attributes, timestamp: nil)

        XCTAssertNotNil(signalProcessor.data)
        XCTAssertTrue(signalProcessor.userDefinedAttributes!.contains("Alice"))
    }

    func testTrackLog_whenDisabled_doesNotSendToProcessor() {
        logEventCollector.disable()

        logEventCollector.trackLog(body: "something happened", severity: .info, attributes: [:], timestamp: nil)

        XCTAssertNil(signalProcessor.data)
    }

    func testTrackLog_whenMessageIsEmpty_logsWarning() {
        logEventCollector.enable()

        logEventCollector.trackLog(body: "", severity: .info, attributes: [:], timestamp: nil)

        XCTAssertNil(signalProcessor.data)
        XCTAssertTrue(logger.logs[1].contains("Log message is empty"))
    }

    func testTrackLog_whenMessageExceedsMaxLength_truncatesMessage() {
        logEventCollector.enable()
        let longMessage = String(repeating: "a", count: Int(configProvider.maxLogMessageLength) + 1)

        logEventCollector.trackLog(body: longMessage, severity: .info, attributes: [:], timestamp: nil)

        guard let data = signalProcessor.data as? LogData else {
            XCTFail("Expected signalProcessor.data to be of type LogData")
            return
        }
        XCTAssertEqual(data.body.count, Int(configProvider.maxLogMessageLength))
    }

    func testTrackLog_withExplicitTimestamp_usesTimestamp() {
        logEventCollector.enable()

        logEventCollector.trackLog(body: "something happened", severity: .info, attributes: [:], timestamp: 123456789)

        XCTAssertEqual(signalProcessor.timestamp, 123456789)
    }

    func testTrackLog_withoutTimestamp_usesCurrentTime() {
        logEventCollector.enable()
        timeProvider.current = 987654321

        logEventCollector.trackLog(body: "something happened", severity: .info, attributes: [:], timestamp: nil)

        XCTAssertEqual(signalProcessor.timestamp, 987654321)
    }

    func testTrackLog_whenSeverityBelowMinLevel_doesNotSendToProcessor() {
        configProvider.minLogSeverityNumber = 16
        logEventCollector.enable()

        logEventCollector.trackLog(body: "debug message", severity: .debug, attributes: [:], timestamp: nil)
        logEventCollector.trackLog(body: "info message", severity: .info, attributes: [:], timestamp: nil)

        XCTAssertNil(signalProcessor.data)
    }

    func testTrackLog_whenSeverityAtOrAboveMinLevel_sendsToProcessor() {
        configProvider.minLogSeverityNumber = 16
        logEventCollector.enable()

        logEventCollector.trackLog(body: "warning message", severity: .warning, attributes: [:], timestamp: nil)

        guard let data = signalProcessor.data as? LogData else {
            XCTFail("Expected signalProcessor.data to be of type LogData")
            return
        }
        XCTAssertEqual(data.severityText, "warning")
    }
}
