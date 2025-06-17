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
        let expectation = self.expectation(description: "Insert sessions and fetch all")
        let session1 = SessionEntity(sessionId: "1", pid: 123, createdAt: 1000, needsReporting: false, crashed: false)
        let session2 = SessionEntity(sessionId: "2", pid: 123, createdAt: 1000, needsReporting: false, crashed: false)

        sessionStore.insertSession(session1)
        sessionStore.insertSession(session2)

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            self.sessionStore.getAllSessions { sessions in
                XCTAssertEqual(sessions?.count, 2, "Expected 2 sessions to be inserted.")
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 2.0)
    }

    func testGetSession() {
        let expectation = self.expectation(description: "Get session twice")
        let session = SessionEntity(sessionId: "1", pid: 123, createdAt: 1000, needsReporting: false, crashed: false)
        sessionStore.insertSession(session)

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            self.sessionStore.getSession(byId: "1") { result1 in
                XCTAssertEqual(result1?.sessionId, "1")

                self.sessionStore.getSession(byId: "1") { result2 in
                    XCTAssertEqual(result2?.sessionId, "1")
                    expectation.fulfill()
                }
            }
        }

        wait(for: [expectation], timeout: 2.0)
    }

    func testDeleteSession() {
        let expectation = self.expectation(description: "Delete sessions and verify empty state")

        let session1 = SessionEntity(sessionId: "1", pid: 123, createdAt: 1000, needsReporting: false, crashed: false)
        let session2 = SessionEntity(sessionId: "2", pid: 123, createdAt: 1000, needsReporting: false, crashed: false)

        sessionStore.insertSession(session1)
        sessionStore.insertSession(session2)

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            self.sessionStore.deleteSession("1")
            self.sessionStore.deleteSession("2")

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                self.sessionStore.getAllSessions { sessions in
                    XCTAssertNil(sessions, "Expected all sessions to be deleted.")
                    expectation.fulfill()
                }
            }
        }

        wait(for: [expectation], timeout: 3.0)
    }

    func testMarkCrashedSessions() {
        let expectation = self.expectation(description: "Mark session as crashed")

        let session = SessionEntity(sessionId: "1", pid: 123, createdAt: 1000, needsReporting: false, crashed: false)
        sessionStore.insertSession(session)

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            self.sessionStore.markCrashedSession(sessionId: "1")

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                self.sessionStore.getSession(byId: "1") { fetchedSession in
                    XCTAssertTrue(fetchedSession?.crashed == true, "Expected session to be marked as crashed.")
                    expectation.fulfill()
                }
            }
        }

        wait(for: [expectation], timeout: 3.0)
    }

    func testGetOldestSession() {
        let expectation = self.expectation(description: "Get the oldest session")

        let session1 = SessionEntity(sessionId: "1", pid: 123, createdAt: 1000, needsReporting: false, crashed: false)
        let session2 = SessionEntity(sessionId: "2", pid: 123, createdAt: 2000, needsReporting: false, crashed: false)

        sessionStore.insertSession(session1)
        sessionStore.insertSession(session2)

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            self.sessionStore.getOldestSession { oldestSessionId in
                XCTAssertEqual(oldestSessionId, "1", "Expected session with ID '1' to be the oldest.")
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 2.0)
    }
}
