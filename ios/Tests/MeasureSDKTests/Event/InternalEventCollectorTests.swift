//
//  InternalEventCollectorTests.swift
//  MeasureSDK
//
//  Created by Abhay Sood on 10/04/25.
//

import XCTest
@testable import Measure

final class BaseInternalEventCollectorTests: XCTestCase {
    private var logger: MockLogger!
    private var eventProcessor: MockEventProcessor!
    private var eventCollector: BaseInternalEventCollector!
    
    override func setUp() {
        super.setUp()

        logger = MockLogger()
        eventProcessor = MockEventProcessor()

        eventCollector = BaseInternalEventCollector(
            logger: logger,
            eventProcessor: eventProcessor
        )
    }
    
    func testTrackEvent_withMissingPlatformAttribute_shouldNotTrackEvent() {
        let data = "test data"
        let type = EventType.custom
        let timestamp = Int64(987654225667)
        let attributes = Attributes()
        let userDefinedAttrs = ""
        let attachments: [Attachment] = []
        let userTriggered = false
        let sessionId = "test_session_id"

        eventCollector.trackEvent(
            data: data,
            type: type,
            timestamp: timestamp,
            attributes: attributes,
            userDefinedAttrs: userDefinedAttrs,
            attachments: attachments,
            userTriggered: userTriggered,
            sessionId: sessionId
        )

        XCTAssertNil(eventProcessor.data)
    }
    
    func testTrackEvent_withValidPlatformAttribute_shouldTrackEvent() {
        let data = "test data"
        let type = EventType.custom
        let timestamp = Int64(987654225667)
        let attributes = Attributes(platform: "flutter")
        let userDefinedAttrs = ""
        let attachments: [Attachment] = []
        let userTriggered = false
        let sessionId = "test_session_id"

        eventCollector.trackEvent(
            data: data,
            type: type,
            timestamp: timestamp,
            attributes: attributes,
            userDefinedAttrs: userDefinedAttrs,
            attachments: attachments,
            userTriggered: userTriggered,
            sessionId: sessionId
        )

        XCTAssertNotNil(eventProcessor.data)
    }
    
    func testTrackEvent_withUserTriggeredSet_shouldTrackUserTriggeredEvent() {
        let data = "test data"
        let type = EventType.custom
        let timestamp = Int64(987654225667)
        let attributes = Attributes(platform: "flutter")
        let userDefinedAttrs = ""
        let attachments: [Attachment] = []
        let userTriggered = true
        let sessionId = "test_session_id"

        eventCollector.trackEvent(
            data: data,
            type: type,
            timestamp: timestamp,
            attributes: attributes,
            userDefinedAttrs: userDefinedAttrs,
            attachments: attachments,
            userTriggered: userTriggered,
            sessionId: sessionId
        )

        XCTAssertNotNil(eventProcessor.data)
        XCTAssertTrue(eventProcessor.userTriggered)
    }
}
