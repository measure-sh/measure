//
//  SessionStoreTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 22/09/24.
//

import XCTest
@testable import MeasureSDK

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

        // Perform concurrent inserts
        let expectation1 = expectation(description: "Insert session 1")
        let expectation2 = expectation(description: "Insert session 2")

        DispatchQueue.global().async {
            self.sessionStore.insertSession(session1)
            expectation1.fulfill()
        }

        DispatchQueue.global().async {
            self.sessionStore.insertSession(session2)
            expectation2.fulfill()
        }

        wait(for: [expectation1, expectation2], timeout: 5)

        // Assert that no race condition occurred and session is inserted properly
        let sessions = sessionStore.getAllSessions()
        XCTAssertEqual(sessions?.count, 2)
    }

    func testGetSession() {
        let session = SessionEntity(sessionId: "1", pid: 123, createdAt: 1000, needsReporting: false, crashed: false)
        sessionStore.insertSession(session)

        let expectation1 = expectation(description: "Get session 1")
        let expectation2 = expectation(description: "Get session 2")

        DispatchQueue.global().async {
            let session = self.sessionStore.getSession(byId: "1")
            XCTAssertEqual(session?.sessionId, "1")
            expectation1.fulfill()
        }

        DispatchQueue.global().async {
            let session = self.sessionStore.getSession(byId: "1")
            XCTAssertEqual(session?.sessionId, "1")
            expectation2.fulfill()
        }

        wait(for: [expectation1, expectation2], timeout: 5)
    }

    func testDeleteSession() {
        let session1 = SessionEntity(sessionId: "1", pid: 123, createdAt: 1000, needsReporting: false, crashed: false)
        let session2 = SessionEntity(sessionId: "2", pid: 123, createdAt: 1000, needsReporting: false, crashed: false)

        sessionStore.insertSession(session1)
        sessionStore.insertSession(session2)

        let expectation1 = expectation(description: "Delete session 1")
        let expectation2 = expectation(description: "Delete session 2")

        DispatchQueue.global().async {
            self.sessionStore.deleteSession("1")
            expectation1.fulfill()
        }

        DispatchQueue.global().async {
            self.sessionStore.deleteSession("2")
            expectation2.fulfill()
        }

        wait(for: [expectation1, expectation2], timeout: 5)

        let sessions = sessionStore.getAllSessions()
        XCTAssertNil(sessions)
    }

    func testMarkCrashedSessions() {
        let expectation = expectation(description: "Mark session 1 as crashed")
        let session = SessionEntity(sessionId: "1", pid: 123, createdAt: 1000, needsReporting: false, crashed: false)
        sessionStore.insertSession(session)

        DispatchQueue.global().async {
            self.sessionStore.markCrashedSession(sessionId: "1")
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 5)

        let fetchedSession = sessionStore.getSession(byId: "1")
        XCTAssertTrue(fetchedSession?.crashed == true)
    }

    func testGetOldestSession() {
        let session1 = SessionEntity(sessionId: "1", pid: 123, createdAt: 1000, needsReporting: false, crashed: false)
        let session2 = SessionEntity(sessionId: "2", pid: 123, createdAt: 2000, needsReporting: false, crashed: false)

        sessionStore.insertSession(session1)
        sessionStore.insertSession(session2)

        let expectation = expectation(description: "Get oldest session")

        DispatchQueue.global().async {
            let oldestSessionId = self.sessionStore.getOldestSession()
            XCTAssertEqual(oldestSessionId, "1")
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 5)
    }
}
