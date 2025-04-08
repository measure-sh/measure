//
//  SessionStoreTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 22/09/24.
//

import XCTest
@testable import Measure

final class SessionStoreTests: XCTestCase {
    var sessionStore: SessionStore!
    var mockCoreDataManager: MockCoreDataManager!
    var mockLogger: MockLogger!

    override func setUp() {
        super.setUp()
        mockCoreDataManager = MockCoreDataManager()
        mockLogger = MockLogger()
        sessionStore = BaseSessionStore(coreDataManager: mockCoreDataManager, logger: mockLogger)
    }

    override func tearDown() {
        sessionStore = nil
        mockCoreDataManager = nil
        mockLogger = nil
        super.tearDown()
    }

    func testInsertSession() {
        let session1 = SessionEntity(sessionId: "1", pid: 123, createdAt: 1000, needsReporting: false, crashed: false)
        let session2 = SessionEntity(sessionId: "2", pid: 123, createdAt: 1000, needsReporting: false, crashed: false)

        // Simulate concurrent inserts (but for test reliability, we insert directly)
        sessionStore.insertSession(session1)
        sessionStore.insertSession(session2)

        let sessions = sessionStore.getAllSessions()
        XCTAssertEqual(sessions?.count, 2)
    }

    func testGetSession() {
        let session = SessionEntity(sessionId: "1", pid: 123, createdAt: 1000, needsReporting: false, crashed: false)
        sessionStore.insertSession(session)

        let result1 = sessionStore.getSession(byId: "1")
        let result2 = sessionStore.getSession(byId: "1")

        XCTAssertEqual(result1?.sessionId, "1")
        XCTAssertEqual(result2?.sessionId, "1")
    }

    func testDeleteSession() {
        let session1 = SessionEntity(sessionId: "1", pid: 123, createdAt: 1000, needsReporting: false, crashed: false)
        let session2 = SessionEntity(sessionId: "2", pid: 123, createdAt: 1000, needsReporting: false, crashed: false)

        sessionStore.insertSession(session1)
        sessionStore.insertSession(session2)

        sessionStore.deleteSession("1")
        sessionStore.deleteSession("2")

        let sessions = sessionStore.getAllSessions()
        XCTAssertNil(sessions)
    }

    func testMarkCrashedSessions() {
        let session = SessionEntity(sessionId: "1", pid: 123, createdAt: 1000, needsReporting: false, crashed: false)
        sessionStore.insertSession(session)

        sessionStore.markCrashedSession(sessionId: "1")

        let fetchedSession = sessionStore.getSession(byId: "1")
        XCTAssertTrue(fetchedSession?.crashed == true)
    }

    func testGetOldestSession() {
        let session1 = SessionEntity(sessionId: "1", pid: 123, createdAt: 1000, needsReporting: false, crashed: false)
        let session2 = SessionEntity(sessionId: "2", pid: 123, createdAt: 2000, needsReporting: false, crashed: false)

        sessionStore.insertSession(session1)
        sessionStore.insertSession(session2)

        let oldestSessionId = sessionStore.getOldestSession()
        XCTAssertEqual(oldestSessionId, "1")
    }
}
