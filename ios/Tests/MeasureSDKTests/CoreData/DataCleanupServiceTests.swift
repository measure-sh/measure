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
    var dataCleanupService: BaseDataCleanupService!
    var sessionManager: SessionManager!
    var configProvider: MockConfigProvider!

    override func setUp() {
        super.setUp()
        coreDataManager = MockCoreDataManager()
        logger = MockLogger()
        eventStore = BaseEventStore(coreDataManager: coreDataManager, logger: logger)
        spanStore = BaseSpanStore(coreDataManager: coreDataManager, logger: logger)
        sessionStore = BaseSessionStore(coreDataManager: coreDataManager, logger: logger)
        sessionManager = MockSessionManager(sessionId: "currentSession")
        configProvider = MockConfigProvider()
        dataCleanupService = BaseDataCleanupService(eventStore: eventStore,
                                                    spanStore: spanStore,
                                                    sessionStore: sessionStore,
                                                    logger: logger,
                                                    sessionManager: sessionManager,
                                                    configProvider: configProvider)
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

        let event1 = TestDataGenerator.generateEvents(id: "event1", sessionId: "session1", needsReporting: false)
        let event2 = TestDataGenerator.generateEvents(id: "event2", sessionId: "session1", needsReporting: false)
        let span1 = TestDataGenerator.generateSpans(name: "span1", sessionId: "session1")
        let session = SessionEntity(sessionId: "session1", pid: 123, createdAt: 123, needsReporting: false, crashed: false)

        eventStore.insertEvent(event: event1) {
            self.eventStore.insertEvent(event: event2) {
                self.spanStore.insertSpan(span: span1)
                self.sessionStore.insertSession(session) {
                    self.dataCleanupService.clearStaleData {
                        self.eventStore.getAllEvents { events in
                            XCTAssertTrue(events?.isEmpty ?? false)
                            self.spanStore.getAllSpans { spans in
                                XCTAssertNil(spans)
                                self.sessionStore.getAllSessions { sessions in
                                    XCTAssertNil(sessions)
                                    expectation.fulfill()
                                }
                            }
                        }
                    }
                }
            }
        }

        wait(for: [expectation], timeout: 2.0)
    }

    func testDeleteSessionsAndEvents_onlyWhereNeedsReportingIsFalse() {
        let expectation = expectation(description: "Delete only needsReporting == false")

        let event1 = TestDataGenerator.generateEvents(id: "event1", sessionId: "session1", needsReporting: false)
        let event2 = TestDataGenerator.generateEvents(id: "event2", sessionId: "session1", needsReporting: true)
        let session = SessionEntity(sessionId: "session1", pid: 123, createdAt: 123, needsReporting: false, crashed: false)

        eventStore.insertEvent(event: event1) {
            self.eventStore.insertEvent(event: event2) {
                self.sessionStore.insertSession(session) {
                    self.dataCleanupService.clearStaleData {
                        self.eventStore.getAllEvents { events in
                            XCTAssertEqual(events?.count, 1)
                            XCTAssertEqual(events?.first?.id, "event2")
                            self.sessionStore.getAllSessions { sessions in
                                XCTAssertNil(sessions)
                                expectation.fulfill()
                            }
                        }
                    }
                }
            }
        }

        wait(for: [expectation], timeout: 2.0)
    }

    func testDontDeleteSessionsAndEvents() {
        let expectation = expectation(description: "Don't delete anything when all need reporting")

        let event1 = TestDataGenerator.generateEvents(id: "event1", sessionId: "session1", needsReporting: true)
        let span1 = TestDataGenerator.generateSpans(name: "span1", sessionId: "session1")
        let session = SessionEntity(sessionId: "session1", pid: 123, createdAt: 123, needsReporting: true, crashed: false)

        eventStore.insertEvent(event: event1) {
            self.spanStore.insertSpan(span: span1)
            self.sessionStore.insertSession(session) {
                self.dataCleanupService.clearStaleData {
                    self.eventStore.getAllEvents { events in
                        XCTAssertEqual(events?.count, 1)
                        self.spanStore.getAllSpans { spans in
                            XCTAssertEqual(spans?.count, 1)
                            self.sessionStore.getAllSessions { sessions in
                                XCTAssertEqual(sessions?.count, 1)
                                expectation.fulfill()
                            }
                        }
                    }
                }
            }
        }

        wait(for: [expectation], timeout: 2.0)
    }

    func testDontDeleteCurrentSessionAndEvents() {
        let expectation = expectation(description: "Don't delete current session")

        let event1 = TestDataGenerator.generateEvents(id: "event1", sessionId: "currentSession", needsReporting: false)
        let event2 = TestDataGenerator.generateEvents(id: "event2", sessionId: "session1", needsReporting: false)
        let span1 = TestDataGenerator.generateSpans(name: "span1", sessionId: "session1")
        let session1 = SessionEntity(sessionId: "currentSession", pid: 123, createdAt: 123, needsReporting: false, crashed: false)
        let session2 = SessionEntity(sessionId: "session1", pid: 456, createdAt: 456, needsReporting: false, crashed: false)

        eventStore.insertEvent(event: event1) {
            self.eventStore.insertEvent(event: event2) {
                self.spanStore.insertSpan(span: span1)
                self.sessionStore.insertSession(session1) {
                    self.sessionStore.insertSession(session2) {
                        self.dataCleanupService.clearStaleData {
                            self.eventStore.getAllEvents { events in
                                XCTAssertEqual(events?.count, 1)
                                XCTAssertEqual(events?.first?.sessionId, "currentSession")
                                self.spanStore.getAllSpans { spans in
                                    XCTAssertNil(spans)
                                    self.sessionStore.getAllSessions { sessions in
                                        XCTAssertEqual(sessions?.count, 1)
                                        XCTAssertEqual(sessions?.first?.sessionId, "currentSession")
                                        expectation.fulfill()
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        wait(for: [expectation], timeout: 2.0)
    }

    func testDeletesOldestSessionIfDiskLimitBreached() {
        let expectation = expectation(description: "Oldest session deleted when disk limit breached")

        configProvider.maxDiskUsageInMb = 25
        configProvider.estimatedEventSizeInKb = 25000

        let session1 = SessionEntity(sessionId: "session1", pid: 123, createdAt: 1, needsReporting: true, crashed: false)
        let session2 = SessionEntity(sessionId: "session2", pid: 124, createdAt: 2, needsReporting: true, crashed: false)
        let session3 = SessionEntity(sessionId: "currentSession", pid: 125, createdAt: 3, needsReporting: true, crashed: false)

        sessionStore.insertSession(session1) {
            self.sessionStore.insertSession(session2) {
                self.sessionStore.insertSession(session3) {
                    let event1 = TestDataGenerator.generateEvents(id: "event1", sessionId: "session1", needsReporting: false)
                    let span1 = TestDataGenerator.generateSpans(name: "span1", sessionId: "session2")
                    
                    self.eventStore.insertEvent(event: event1) {
                        self.spanStore.insertSpan(span: span1)
                        self.dataCleanupService.clearStaleData {
                            self.sessionStore.getAllSessions { sessions in
                                let remaining = sessions?.map { $0.sessionId }
                                XCTAssertEqual(remaining?.sorted(), ["currentSession", "session2"])
                                expectation.fulfill()
                            }
                        }
                    }
                }
            }
        }

        wait(for: [expectation], timeout: 5.0)
    }
}
