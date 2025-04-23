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
    private var signalProcessor: MockSignalProcessor!
    private var eventCollector: BaseInternalEventCollector!

    override func setUp() {
        super.setUp()

        logger = MockLogger()
        signalProcessor = MockSignalProcessor()

        eventCollector = BaseInternalEventCollector(
            logger: logger,
            signalProcessor: signalProcessor
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
        
        XCTAssertNil(signalProcessor.data)
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
        
        XCTAssertNotNil(signalProcessor.data)
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
        
        XCTAssertNil(signalProcessor.data)
        XCTAssertTrue(logger.logs[1].contains("Error processing event"))
    }
}
