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
    var spanStore: SpanStore!
    var sessionStore: SessionStore!
    var dataCleanupService: DataCleanupService!
    var sessionManager: SessionManager!

    override func setUp() {
        super.setUp()
        coreDataManager = MockCoreDataManager()
        logger = MockLogger()
        eventStore = BaseEventStore(coreDataManager: coreDataManager, logger: logger)
        spanStore = BaseSpanStore(coreDataManager: coreDataManager, logger: logger)
        sessionStore = BaseSessionStore(coreDataManager: coreDataManager, logger: logger)
        sessionManager = MockSessionManager(sessionId: "currentSession")
        dataCleanupService = BaseDataCleanupService(eventStore: eventStore,
                                                    spanStore: spanStore,
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
        let expectation = expectation(description: "Delete all sessions, events, and spans")

        // Insert test data
        let event1 = TestDataGenerator.generateEvents(id: "event1", sessionId: "session1", needsReporting: false)
        let event2 = TestDataGenerator.generateEvents(id: "event2", sessionId: "session1", needsReporting: false)
        let event3 = TestDataGenerator.generateEvents(id: "event3", sessionId: "session1", needsReporting: false)
        let event4 = TestDataGenerator.generateEvents(id: "event4", sessionId: "session1", needsReporting: false)
        let span1 = TestDataGenerator.generateSpans(name: "span1", sessionId: "session1")
        let span2 = TestDataGenerator.generateSpans(name: "span2", sessionId: "session1")
        let session = SessionEntity(sessionId: "session1", pid: 123, createdAt: 123, needsReporting: false, crashed: false)

        eventStore.insertEvent(event: event1)
        eventStore.insertEvent(event: event2)
        eventStore.insertEvent(event: event3)
        eventStore.insertEvent(event: event4)
        spanStore.insertSpan(span: span1)
        spanStore.insertSpan(span: span2)
        sessionStore.insertSession(session)

        // Trigger cleanup
        dataCleanupService.clearStaleData()

        // Verify deletions after delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            self.eventStore.getAllEvents { events in
                XCTAssertTrue(((events?.isEmpty) != nil))
                self.spanStore.getAllSpans { spans in
                    XCTAssertNil(spans)
                    self.sessionStore.getAllSessions { sessions in
                        XCTAssertNil(sessions)
                        expectation.fulfill()
                    }
                }
            }
        }

        wait(for: [expectation], timeout: 2.0)
    }

    func testDeleteSessionsAndEvents_onlyWhereNeedsReportingIsFalse() {
        let expectation = expectation(description: "Delete only needsReporting == false")

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

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            self.eventStore.getAllEvents { events in
                XCTAssertEqual(events?.count, 1)
                self.sessionStore.getAllSessions { sessions in
                    XCTAssertNil(sessions)
                    expectation.fulfill()
                }
            }
        }

        wait(for: [expectation], timeout: 2.0)
    }

    func testDontDeleteSessionsAndEvents() {
        let expectation = expectation(description: "Don't delete anything when all need reporting")

        let event1 = TestDataGenerator.generateEvents(id: "event1", sessionId: "session1", needsReporting: true)
        let event2 = TestDataGenerator.generateEvents(id: "event2", sessionId: "session1", needsReporting: true)
        let event3 = TestDataGenerator.generateEvents(id: "event3", sessionId: "session1", needsReporting: true)
        let event4 = TestDataGenerator.generateEvents(id: "event4", sessionId: "session1", needsReporting: true)
        let span1 = TestDataGenerator.generateSpans(name: "span1", sessionId: "session1")
        let span2 = TestDataGenerator.generateSpans(name: "span2", sessionId: "session1")
        let session = SessionEntity(sessionId: "session1", pid: 123, createdAt: 123, needsReporting: true, crashed: false)

        eventStore.insertEvent(event: event1)
        eventStore.insertEvent(event: event2)
        eventStore.insertEvent(event: event3)
        eventStore.insertEvent(event: event4)
        spanStore.insertSpan(span: span1)
        spanStore.insertSpan(span: span2)
        sessionStore.insertSession(session)

        dataCleanupService.clearStaleData()

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            self.eventStore.getAllEvents { events in
                XCTAssertEqual(events?.count, 4)
                self.spanStore.getAllSpans { spans in
                    XCTAssertEqual(spans?.count, 2)
                    self.sessionStore.getAllSessions { sessions in
                        XCTAssertEqual(sessions?.count, 1)
                        expectation.fulfill()
                    }
                }
            }
        }

        wait(for: [expectation], timeout: 2.0)
    }

    func testDontDeleteCurrentSessionAndEvents() {
        let expectation = expectation(description: "Don't delete current session")

        let event1 = TestDataGenerator.generateEvents(id: "event1", sessionId: "currentSession", needsReporting: false)
        let event2 = TestDataGenerator.generateEvents(id: "event2", sessionId: "currentSession", needsReporting: false)
        let event3 = TestDataGenerator.generateEvents(id: "event3", sessionId: "session1", needsReporting: false)
        let event4 = TestDataGenerator.generateEvents(id: "event4", sessionId: "session1", needsReporting: false)
        let span1 = TestDataGenerator.generateSpans(name: "span1", sessionId: "session1")
        let span2 = TestDataGenerator.generateSpans(name: "span2", sessionId: "currentSession")
        let span3 = TestDataGenerator.generateSpans(name: "span2", sessionId: "currentSession")
        let currentSession = SessionEntity(sessionId: "currentSession", pid: 123, createdAt: 123, needsReporting: false, crashed: false)
        let session = SessionEntity(sessionId: "session1", pid: 1234, createdAt: 1234, needsReporting: false, crashed: false)

        eventStore.insertEvent(event: event1)
        eventStore.insertEvent(event: event2)
        eventStore.insertEvent(event: event3)
        eventStore.insertEvent(event: event4)
        spanStore.insertSpan(span: span1)
        spanStore.insertSpan(span: span2)
        spanStore.insertSpan(span: span3)
        sessionStore.insertSession(currentSession)
        sessionStore.insertSession(session)

        dataCleanupService.clearStaleData()

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            self.eventStore.getAllEvents { events in
                XCTAssertEqual(events?.count, 2)
                self.spanStore.getAllSpans { spans in
                    XCTAssertEqual(spans?.count, 2)
                    self.sessionStore.getAllSessions { sessions in
                        XCTAssertEqual(sessions?.count, 1)
                        expectation.fulfill()
                    }
                }
            }
        }

        wait(for: [expectation], timeout: 2.0)
    }
}
