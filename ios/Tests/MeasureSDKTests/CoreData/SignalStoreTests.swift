//
//  SignalStoreTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/01/26.
//

import CoreData
@testable import Measure
import XCTest

final class BaseSignalStoreTests: XCTestCase {
    
    private var eventStore: MockEventStore!
    private var spanStore: MockSpanStore!
    private var sessionStore: MockSessionStore!
    private var logger: MockLogger!
    private var config: MockConfigProvider!
    private var signalStore: BaseSignalStore!

    override func setUp() {
        super.setUp()

        eventStore = MockEventStore()
        spanStore = MockSpanStore()
        sessionStore = MockSessionStore()
        logger = MockLogger()
        config = MockConfigProvider()

        config.crashTimelineDurationSeconds = 30
        config.bugReportTimelineDurationSeconds = 20

        signalStore = BaseSignalStore(
            eventStore: eventStore,
            spanStore: spanStore,
            sessionStore: sessionStore,
            logger: logger,
            config: config
        )
    }

    override func tearDown() {
        eventStore = nil
        spanStore = nil
        sessionStore = nil
        logger = nil
        config = nil
        signalStore = nil
        super.tearDown()
    }

    private func makeBaseEvent<T: Codable>(
        type: EventType,
        data: T?
    ) -> Event<T> {
        Event<T>(
            id: "e1",
            sessionId: "s1",
            timestamp: "2024-01-01T00:00:00Z",
            timestampInMillis: 1,
            type: type,
            data: data,
            attachments: nil,
            attributes: nil,
            userTriggered: false
        )
    }

    // MARK: - Tests

    func testStoresRegularEvent() {
        let event = makeBaseEvent(type: .custom, data: Optional<CustomEventData>.none)

        signalStore.store(event, needsReporting: false)

        let events = eventStore.getAllEvents()
        XCTAssertEqual(events.count, 1)
        XCTAssertFalse(events.first!.needsReporting)
    }

    func testMarksTimelineForCrashEvent() {
        let exception = Exception(handled: false, exceptions: [ExceptionDetail(type: nil, message: nil, frames: nil, signal: nil, threadName: nil, threadSequence: 0, osBuildNumber: nil)], threads: nil, binaryImages: nil, framework: nil, error: nil)

        let event = makeBaseEvent(type: .exception, data: exception)

        signalStore.store(event, needsReporting: false)

        let events = eventStore.getAllEvents()
        XCTAssertEqual(events.count, 1)
        XCTAssertTrue(events.first!.needsReporting)
    }

    func testMarksTimelineForBugReportEvent() {
        let bugReport = BugReportData(description: "bug")
        let event = makeBaseEvent(type: .bugReport, data: bugReport)

        signalStore.store(event, needsReporting: false)

        let events = eventStore.getAllEvents()
        XCTAssertEqual(events.count, 1)
        XCTAssertTrue(events.first!.needsReporting)
    }

    func testDoesNotMarkTimelineForHandledException() {
        let exception = Exception(handled: true, exceptions: [ExceptionDetail(type: nil, message: nil, frames: nil, signal: nil, threadName: nil, threadSequence: 0, osBuildNumber: nil)], threads: nil, binaryImages: nil, framework: nil, error: nil)

        let event = makeBaseEvent(type: .exception, data: exception)

        signalStore.store(event, needsReporting: false)

        let events = eventStore.getAllEvents()
        XCTAssertEqual(events.count, 1)
        XCTAssertFalse(events.first!.needsReporting)
    }

    func testStoresSampledSpan() {
        let span = TestDataGenerator.generateSpans(isSampled: true)

        signalStore.store(span)

        let spans = spanStore.getAllSpans()
        XCTAssertEqual(spans.count, 1)
    }

    func testDoesNotStoreNonSampledSpan() {
        let span = TestDataGenerator.generateSpans(isSampled: false)

        signalStore.store(span)

        let spans = spanStore.getAllSpans()
        XCTAssertTrue(spans.isEmpty)
    }
}
