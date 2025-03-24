//
//  DataCleanupServiceTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 15/01/25.
//

import CoreData
@testable import Measure
import XCTest

class DataCleanupServiceTests: XCTestCase {
    var coreDataManager: MockCoreDataManager!
    var logger: MockLogger!
    var eventStore: EventStore!
    var sessionStore: SessionStore!
    var dataCleanupService: DataCleanupService!
    var sessionManager: SessionManager!

    override func setUp() {
        super.setUp()
        coreDataManager = MockCoreDataManager()
        logger = MockLogger()
        eventStore = BaseEventStore(coreDataManager: coreDataManager, logger: logger)
        sessionStore = BaseSessionStore(coreDataManager: coreDataManager, logger: logger)
        sessionManager = MockSessionManager(sessionId: "currentSession")
        dataCleanupService = BaseDataCleanupService(eventStore: eventStore,
                                                    sessionStore: sessionStore,
                                                    logger: logger,
                                                    sessionManager: sessionManager)
    }

    override func tearDown() {
        eventStore = nil
        coreDataManager = nil
        sessionStore = nil
        logger = nil
        super.tearDown()
    }

    func testDeleteSessionsAndAllEvents() {
        let event1 = TestDataGenerator.generateEvents(id: "event1", sessionId: "session1", needsReporting: false)
        let event2 = TestDataGenerator.generateEvents(id: "event2", sessionId: "session1", needsReporting: false)
        let event3 = TestDataGenerator.generateEvents(id: "event3", sessionId: "session1", needsReporting: false)
        let event4 = TestDataGenerator.generateEvents(id: "event4", sessionId: "session1", needsReporting: false)
        let session = SessionEntity(sessionId: "session1", pid: 123, createdAt: 123, needsReporting: false, crashed: false)

        eventStore.insertEvent(event: event1)
        eventStore.insertEvent(event: event2)
        eventStore.insertEvent(event: event3)
        eventStore.insertEvent(event: event4)
        sessionStore.insertSession(session)

        dataCleanupService.clearStaleData()

        XCTAssertNil(eventStore.getAllEvents())
        XCTAssertNil(sessionStore.getAllSessions())
    }

    func testDeleteSessionsAndEvents_onlyWhereNeedsReportingIsFalse() {
        let event1 = TestDataGenerator.generateEvents(id: "event1", sessionId: "session1", needsReporting: false)
        let event2 = TestDataGenerator.generateEvents(id: "event2", sessionId: "session1", needsReporting: false)
        let event3 = TestDataGenerator.generateEvents(id: "event3", sessionId: "session1", needsReporting: false)
        let event4 = TestDataGenerator.generateEvents(id: "event4", sessionId: "session1", needsReporting: true)
        let session = SessionEntity(sessionId: "session1", pid: 123, createdAt: 123, needsReporting: false, crashed: false)

        eventStore.insertEvent(event: event1)
        eventStore.insertEvent(event: event2)
        eventStore.insertEvent(event: event3)
        eventStore.insertEvent(event: event4)
        sessionStore.insertSession(session)

        dataCleanupService.clearStaleData()

        XCTAssertTrue(eventStore.getAllEvents()?.count == 1)
        XCTAssertNil(sessionStore.getAllSessions())
    }

    func testDontDeleteSessionsAndEvents() {
        let event1 = TestDataGenerator.generateEvents(id: "event1", sessionId: "session1", needsReporting: true)
        let event2 = TestDataGenerator.generateEvents(id: "event2", sessionId: "session1", needsReporting: true)
        let event3 = TestDataGenerator.generateEvents(id: "event3", sessionId: "session1", needsReporting: true)
        let event4 = TestDataGenerator.generateEvents(id: "event4", sessionId: "session1", needsReporting: true)
        let session = SessionEntity(sessionId: "session1", pid: 123, createdAt: 123, needsReporting: true, crashed: false)

        eventStore.insertEvent(event: event1)
        eventStore.insertEvent(event: event2)
        eventStore.insertEvent(event: event3)
        eventStore.insertEvent(event: event4)
        sessionStore.insertSession(session)

        dataCleanupService.clearStaleData()

        XCTAssertTrue(eventStore.getAllEvents()?.count == 4)
        XCTAssertTrue(sessionStore.getAllSessions()?.count == 1)
    }

    func testDontDeleteCurrentSessionAndEvents() {
        let event1 = TestDataGenerator.generateEvents(id: "event1", sessionId: "currentSession", needsReporting: false)
        let event2 = TestDataGenerator.generateEvents(id: "event2", sessionId: "currentSession", needsReporting: false)
        let event3 = TestDataGenerator.generateEvents(id: "event3", sessionId: "session1", needsReporting: false)
        let event4 = TestDataGenerator.generateEvents(id: "event4", sessionId: "session1", needsReporting: false)
        let currentSession = SessionEntity(sessionId: "currentSession", pid: 123, createdAt: 123, needsReporting: false, crashed: false)
        let session = SessionEntity(sessionId: "session1", pid: 1234, createdAt: 1234, needsReporting: false, crashed: false)

        eventStore.insertEvent(event: event1)
        eventStore.insertEvent(event: event2)
        eventStore.insertEvent(event: event3)
        eventStore.insertEvent(event: event4)
        sessionStore.insertSession(currentSession)
        sessionStore.insertSession(session)

        dataCleanupService.clearStaleData()

        XCTAssertTrue(eventStore.getAllEvents()?.count == 2)
        XCTAssertTrue(sessionStore.getAllSessions()?.count == 1)
    }
}
