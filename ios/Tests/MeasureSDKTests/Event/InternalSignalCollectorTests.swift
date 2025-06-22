//
//  InternalSignalCollectorTests.swift
//  MeasureSDK
//
//  Created by Abhay Sood on 14/04/25.
//

import XCTest
@testable import Measure

final class BaseInternalSignalCollectorTests: XCTestCase {
    private var logger: MockLogger!
    private var signalProcessor: MockSignalProcessor!
    private var eventCollector: BaseInternalSignalCollector!
    private var fileManagerHelper = FileManagerHelper()
    private var timeProvider = MockTimeProvider()
    private var sessionManager = MockSessionManager()

    override func setUp() {
        super.setUp()
        logger = MockLogger()
        signalProcessor = MockSignalProcessor()
        eventCollector = BaseInternalSignalCollector(
            logger: logger,
            timeProvider: timeProvider,
            signalProcessor: signalProcessor,
            sessionManager: sessionManager,
            attributeProcessors: []
        )
    }

    func testTrackEvent_tracksCustomEvent() {
        eventCollector.enable()
        var eventData: [String: Any?] = ["name": "custom-event"]
        let type = EventType.custom.rawValue

        eventCollector.trackEvent(
            data: &eventData,
            type: type,
            timestamp: 1234567890,
            attributes: [:],
            userDefinedAttrs: [:],
            userTriggered: true,
            sessionId: nil,
            threadName: nil
        )

        XCTAssertNotNil(signalProcessor.data)
    }

    func testTrackEvent_tracksScreenViewEvent() {
        eventCollector.enable()
        var eventData: [String: Any?] = ["name": "home"]
        let type = EventType.screenView.rawValue

        eventCollector.trackEvent(
            data: &eventData,
            type: type,
            timestamp: 1234567890,
            attributes: [:],
            userDefinedAttrs: [:],
            userTriggered: true,
            sessionId: nil,
            threadName: nil
        )

        XCTAssertNotNil(signalProcessor.data)
    }

    func testTrackEvent_WithInvalidArgument_logsError() {
        eventCollector.enable()
        var eventData: [String: Any?] = [:]
        let type = EventType.custom.rawValue

        eventCollector.trackEvent(
            data: &eventData,
            type: type,
            timestamp: 1234567890,
            attributes: ["platform": "flutter"],
            userDefinedAttrs: [:],
            userTriggered: true,
            sessionId: nil,
            threadName: nil
        )

        XCTAssertNil(signalProcessor.data)
        XCTAssertTrue(logger.logs.contains { $0.contains("Error processing event") })
    }

    func testTrackEvent_WithObfuscatedFlutterException_tracksExceptionEvent() {
        eventCollector.enable()
        let type = EventType.exception.rawValue

        guard var eventData = fileManagerHelper.getExceptionDict(fileName: "flutter_obfuscated", fileExtension: "json") else {
            XCTFail("Missing flutter_obfuscated.json in test bundle.")
            return
        }

        eventCollector.trackEvent(
            data: &eventData,
            type: type,
            timestamp: 1234567890,
            attributes: ["platform": "flutter"],
            userDefinedAttrs: [:],
            userTriggered: true,
            sessionId: nil,
            threadName: nil
        )

        guard let data = signalProcessor.data as? Exception else {
            XCTFail("Expected signalProcessor.data to be of type Exception")
            return
        }

        XCTAssertEqual(data.framework, "ios")
        XCTAssertEqual(data.exceptions.count, 1)
        XCTAssertEqual(data.exceptions.first?.frames?.count, 2)
    }

    func testTrackEvent_WithUnobfuscatedFlutterException_tracksExceptionEvent() {
        eventCollector.enable()
        let type = EventType.exception.rawValue

        guard var eventData = fileManagerHelper.getExceptionDict(fileName: "flutter_unobfuscated", fileExtension: "json") else {
            XCTFail("Missing flutter_unobfuscated.json in test bundle.")
            return
        }

        eventCollector.trackEvent(
            data: &eventData,
            type: type,
            timestamp: 1234567890,
            attributes: [:],
            userDefinedAttrs: [:],
            userTriggered: true,
            sessionId: nil,
            threadName: nil
        )

        guard let data = signalProcessor.data as? Exception else {
            XCTFail("Expected signalProcessor.data to be of type Exception")
            return
        }

        XCTAssertEqual(data.framework, "ios")
        XCTAssertEqual(data.exceptions.count, 1)
        XCTAssertEqual(data.exceptions.first?.frames?.count, 3)
    }

    func testTrackEvent_WithExceptionEvent_updatesForegroundProperty() {
        eventCollector.enable()
        let type = EventType.exception.rawValue

        guard var eventData = fileManagerHelper.getExceptionDict(fileName: "flutter_background", fileExtension: "json") else {
            XCTFail("Missing flutter_background.json in test bundle.")
            return
        }

        eventCollector.trackEvent(
            data: &eventData,
            type: type,
            timestamp: 1234567890,
            attributes: ["platform": "flutter"],
            userDefinedAttrs: [:],
            userTriggered: true,
            sessionId: nil,
            threadName: nil
        )

        guard let data = signalProcessor.data as? Exception else {
            XCTFail("Expected signalProcessor.data to be of type Exception")
            return
        }

        XCTAssertTrue((data.foreground != nil))
    }

    func testTrackSpan_tracksSpan() {
        eventCollector.enable()

        eventCollector.trackSpan(
            name: "span_name",
            traceId: "trace_id",
            spanId: "span_id",
            parentId: "parent_id",
            startTime: 1234567890,
            endTime: 1234568890,
            duration: 1000,
            status: 1,
            attributes: ["threadName": "main"],
            userDefinedAttrs: ["key": AttributeValue.string("value")],
            checkpoints: ["checkpoint_name": 1234567890],
            hasEnded: true,
            isSampled: true
        )

        guard let spanData = signalProcessor.spanData else {
            XCTFail("SpanData should not be nil")
            return
        }

        XCTAssertEqual(spanData.name, "span_name")
        XCTAssertEqual(spanData.traceId, "trace_id")
        XCTAssertEqual(spanData.spanId, "span_id")
        XCTAssertEqual(spanData.parentId, "parent_id")
        XCTAssertEqual(spanData.sessionId, sessionManager.sessionId)
        XCTAssertEqual(spanData.startTime, 1234567890)
        XCTAssertEqual(spanData.endTime, 1234568890)
        XCTAssertEqual(spanData.duration, 1000)
        XCTAssertEqual(spanData.status, .ok)
        XCTAssertTrue(spanData.hasEnded)
        XCTAssertTrue(spanData.isSampled)
        XCTAssertEqual(spanData.attributes?.threadName, "main")
        XCTAssertEqual(spanData.userDefinedAttrs?["key"]?.value as? String, "value")
        XCTAssertEqual(spanData.checkpoints.first?.name, "checkpoint_name")
        XCTAssertEqual(spanData.checkpoints.first?.timestamp, timeProvider.iso8601Timestamp)
    }
}
