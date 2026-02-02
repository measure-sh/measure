//
//  DataCleanupServiceTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 15/01/25.
//

import CoreData
@testable import Measure
import XCTest

final class DataCleanupServiceTests: XCTestCase {
    var coreDataManager: MockCoreDataManager!
    var logger: MockLogger!
    var eventStore: EventStore!
    var spanStore: SpanStore!
    var sessionStore: SessionStore!
    var attachmentStore: AttachmentStore!
    var dataCleanupService: BaseDataCleanupService!
    var sessionManager: MockSessionManager!
    var configProvider: MockConfigProvider!

    var tempBugReportDir: URL?

    override func setUp() {
        super.setUp()

        coreDataManager = MockCoreDataManager()
        logger = MockLogger()

        eventStore = BaseEventStore(coreDataManager: coreDataManager, logger: logger)
        spanStore = BaseSpanStore(coreDataManager: coreDataManager, logger: logger)
        sessionStore = BaseSessionStore(coreDataManager: coreDataManager, logger: logger)
        attachmentStore = BaseAttachmentStore(coreDataManager: coreDataManager, logger: logger)

        sessionManager = MockSessionManager(sessionId: "currentSession")
        configProvider = MockConfigProvider()

        dataCleanupService = BaseDataCleanupService(
            eventStore: eventStore,
            spanStore: spanStore,
            sessionStore: sessionStore,
            logger: logger,
            sessionManager: sessionManager,
            configProvider: configProvider,
            attachmentStore: attachmentStore
        )
    }

    override func tearDown() {
        if let dir = tempBugReportDir {
            try? FileManager.default.removeItem(at: dir)
        }

        tempBugReportDir = nil
        coreDataManager = nil
        logger = nil
        eventStore = nil
        spanStore = nil
        sessionStore = nil
        attachmentStore = nil
        configProvider = nil
        sessionManager = nil
        dataCleanupService = nil

        super.tearDown()
    }

    // MARK: - Helpers

    private func makeSession(_ id: String,
                             createdAt: Int64,
                             needsReporting: Bool) -> SessionEntity {
        SessionEntity(
            sessionId: id,
            pid: 1,
            createdAt: createdAt,
            needsReporting: needsReporting,
            crashed: false
        )
    }

    // MARK: - Basic deletion

    func testDeleteSessionsAndAllEvents() {
        let e1 = TestDataGenerator.generateEvents(id: "e1", sessionId: "s1", needsReporting: false)
        let e2 = TestDataGenerator.generateEvents(id: "e2", sessionId: "s1", needsReporting: false)
        let span = TestDataGenerator.generateSpans(name: "span", sessionId: "s1")
        let session = makeSession("s1", createdAt: 1, needsReporting: false)

        eventStore.insertEvent(event: e1)
        eventStore.insertEvent(event: e2)
        spanStore.insertSpan(span: span)
        sessionStore.insertSession(session)

        dataCleanupService.clearStaleData()

        XCTAssertTrue(eventStore.getAllEvents().isEmpty)
        XCTAssertTrue(spanStore.getAllSpans().isEmpty)
        XCTAssertTrue(sessionStore.getAllSessions().isEmpty)
    }

    func testDeleteSessionsAndEvents_onlyWhereNeedsReportingIsFalse() {
        let e1 = TestDataGenerator.generateEvents(id: "e1", sessionId: "s1", needsReporting: false)
        let e2 = TestDataGenerator.generateEvents(id: "e2", sessionId: "s1", needsReporting: false)
        let session = makeSession("s1", createdAt: 1, needsReporting: false)

        eventStore.insertEvent(event: e1)
        eventStore.insertEvent(event: e2)
        sessionStore.insertSession(session)

        dataCleanupService.clearStaleData()

        XCTAssertEqual(eventStore.getAllEvents().count, 0)
        XCTAssertTrue(sessionStore.getAllSessions().isEmpty)
    }

    func testDontDeleteSessionsAndEvents() {
        let e1 = TestDataGenerator.generateEvents(id: "e1", sessionId: "s1", needsReporting: true)
        let span = TestDataGenerator.generateSpans(name: "span", sessionId: "s1")
        let session = makeSession("s1", createdAt: 1, needsReporting: true)

        eventStore.insertEvent(event: e1)
        spanStore.insertSpan(span: span)
        sessionStore.insertSession(session)

        dataCleanupService.clearStaleData()

        XCTAssertEqual(eventStore.getAllEvents().count, 1)
        XCTAssertEqual(spanStore.getAllSpans().count, 1)
        XCTAssertEqual(sessionStore.getAllSessions().count, 1)
    }

    func testDontDeleteCurrentSessionAndEvents() {
        let e1 = TestDataGenerator.generateEvents(id: "e1", sessionId: "currentSession", needsReporting: false)
        let e2 = TestDataGenerator.generateEvents(id: "e2", sessionId: "s1", needsReporting: false)
        let span = TestDataGenerator.generateSpans(name: "span", sessionId: "s1")

        sessionStore.insertSession(makeSession("currentSession", createdAt: 1, needsReporting: false))
        sessionStore.insertSession(makeSession("s1", createdAt: 2, needsReporting: false))

        eventStore.insertEvent(event: e1)
        eventStore.insertEvent(event: e2)
        spanStore.insertSpan(span: span)

        dataCleanupService.clearStaleData()

        let events = eventStore.getAllEvents()
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events.first?.sessionId, "currentSession")

        XCTAssertTrue(spanStore.getAllSpans().isEmpty)

        let sessions = sessionStore.getAllSessions()
        XCTAssertEqual(sessions.count, 1)
        XCTAssertEqual(sessions.first?.sessionId, "currentSession")
    }

    // MARK: - Disk trimming

    func testDeletesOldestSessionIfDiskLimitBreached() {
        configProvider.maxDiskUsageInMb = 25
        configProvider.estimatedEventSizeInKb = 25_000

        sessionStore.insertSession(makeSession("s1", createdAt: 1, needsReporting: true))
        sessionStore.insertSession(makeSession("s2", createdAt: 2, needsReporting: true))
        sessionStore.insertSession(makeSession("currentSession", createdAt: 3, needsReporting: true))

        let e1 = TestDataGenerator.generateEvents(id: "e1", sessionId: "s1", needsReporting: false)
        let span = TestDataGenerator.generateSpans(name: "span", sessionId: "s2")

        eventStore.insertEvent(event: e1)
        spanStore.insertSpan(span: span)

        dataCleanupService.clearStaleData()

        let remaining = sessionStore.getAllSessions().map { $0.sessionId }
        XCTAssertEqual(remaining.sorted(), ["currentSession", "s2"])
    }

    func testTrimDoesNothingWhenUnderLimit() {
        configProvider.maxDiskUsageInMb = 50
        configProvider.estimatedEventSizeInKb = 15

        for i in 0..<100 {
            let e = TestDataGenerator.generateEvents(id: "e\(i)", sessionId: "s1", needsReporting: true)
            eventStore.insertEvent(event: e)
        }

        sessionStore.insertSession(makeSession("s1", createdAt: 1, needsReporting: true))

        dataCleanupService.clearStaleData()

        XCTAssertEqual(sessionStore.getAllSessions().count, 1)
    }

    func testTrimDoesNotDeleteCurrentSessionEvenIfOldest() {
        configProvider.maxDiskUsageInMb = 1
        configProvider.estimatedEventSizeInKb = 1000

        sessionStore.insertSession(makeSession("currentSession", createdAt: 1, needsReporting: true))

        let e = TestDataGenerator.generateEvents(id: "e1", sessionId: "currentSession", needsReporting: true)
        eventStore.insertEvent(event: e)

        dataCleanupService.clearStaleData()

        XCTAssertEqual(sessionStore.getAllSessions().count, 1)
    }
}
