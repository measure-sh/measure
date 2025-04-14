//
//  InternalEventCollectorTests.swift
//  MeasureSDK
//
//  Created by Abhay Sood on 14/04/25.
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
    
    func testTrackEvent_withoutPlatformAttribute_logsWarning() {
        eventCollector.enable()
        let eventData: [String: Any?] = ["key": "value"]
        let type = EventType.custom.rawValue
        
        
        eventCollector.trackEvent(
            data: eventData,
            type: type,
            timestamp: 097654121,
            attributes: [:],
            userDefinedAttrs: [:],
            userTriggered: true,
            sessionId: nil,
            threadName: nil
        )
        
        XCTAssertNil(eventProcessor.data)
        XCTAssertTrue(logger.logs[1].contains("Platform not found in attributes, cannot process event"))
    }
    
    func testTrackEvent_tracksCustomEvent() {
        eventCollector.enable()
        let eventData: [String: Any?] = ["name": "custom-event"]
        let type = EventType.custom.rawValue
        
        eventCollector.trackEvent(
            data: eventData,
            type: type,
            timestamp: 097654121,
            attributes: ["platform": "flutter"],
            userDefinedAttrs: [:],
            userTriggered: true,
            sessionId: nil,
            threadName: nil
        )
        
        XCTAssertNotNil(eventProcessor.data)
    }
    
    func testTrackEvent_WithInvalidArgument_logsError() {
        eventCollector.enable()
        let eventData: [String: Any?] = [:]
        let type = EventType.custom.rawValue
        
        eventCollector.trackEvent(
            data: eventData,
            type: type,
            timestamp: 097654121,
            attributes: ["platform": "flutter"],
            userDefinedAttrs: [:],
            userTriggered: true,
            sessionId: nil,
            threadName: nil
        )
        
        XCTAssertNil(eventProcessor.data)
        XCTAssertTrue(logger.logs[1].contains("Error processing event"))
    }
}
