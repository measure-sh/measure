//
//  SessionManagerTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 02/09/24.
//

import XCTest
@testable import Measure

final class SessionManagerTests: XCTestCase {
    var sessionManager: SessionManager!
    var idProvider: MockIdProvider!
    var logger: MockLogger!
    var configProvider: MockConfigProvider!
    var randomizer: MockRandomizer!
    var timeProvider: MockTimeProvider!
    var sessionStore: SessionStore!
    var userDefaultStorage = MockUserDefaultStorage()

    override func setUp() {
        super.setUp()
        idProvider = MockIdProvider("test-session-id-1")
        logger = MockLogger()
        timeProvider = MockTimeProvider()
        configProvider = MockConfigProvider(enableLogging: false,
                                            trackScreenshotOnCrash: false,
                                            eventsBatchingIntervalMs: 1000,
                                            sessionEndLastEventThresholdMs: 1000,
                                            longPressTimeout: 0.5,
                                            scaledTouchSlop: 20,
                                            maxAttachmentSizeInEventsBatchInBytes: 30000,
                                            maxEventsInBatch: 500)
        randomizer = MockRandomizer(0.5)
        sessionStore = BaseSessionStore(coreDataManager: MockCoreDataManager(),
                                        logger: logger)
        sessionManager = BaseSessionManager(idProvider: idProvider,
                                            logger: logger,
                                            timeProvider: timeProvider,
                                            configProvider: configProvider,
                                            randomizer: randomizer,
                                            sessionStore: sessionStore,
                                            eventStore: MockEventStore(),
                                            userDefaultStorage: userDefaultStorage,
                                            versionCode: "1.0.0")
    }

    override func tearDown() {
        sessionManager = nil
        idProvider = nil
        logger = nil
        configProvider = nil
        randomizer = nil
        timeProvider = nil
        super.tearDown()
    }

    func testSessionCrash_IfSessionIdDoesNotExist() {
        let _ = self.sessionManager.sessionId // swiftlint:disable:this redundant_discardable_let
        XCTAssertEqual(logger.logs.first, "Session ID is null. Ensure that start() is called before accessing sessionId.", "Expected sessionManager to throw an exception.")
    }

    func testSessionStart() {
        sessionManager.start()
        XCTAssertEqual(sessionManager.sessionId, "test-session-id-1", "Expected session ID to be 'test-session-id-1' after initialisation.")
    }

    func testSessionContinues_WhenFrameworkVersionNotUpdated() {
        let expectedSessionId = "previous-session-id"
        idProvider.idString = "new-session-id"
        let lastEventTime: Int64 = 1000
        let recentSession = RecentSession(id: expectedSessionId, createdAt: 9876544331, lastEventTime: lastEventTime, versionCode: "1.0.0")
        userDefaultStorage.recentSession = recentSession
        timeProvider.current = lastEventTime + 1000
        configProvider.sessionEndLastEventThresholdMs = 10000

        sessionManager.start()
        XCTAssertEqual(sessionManager.sessionId, "previous-session-id", "Expected a new session to be created when the framework version is updated.")
    }

    func testCreatesNewSession_WhenFrameworkVersionUpdated() {
        let expectedSessionId = "previous-session-id"
        idProvider.idString = "new-session-id"
        let lastEventTime: Int64 = 1000
        let recentSession = RecentSession(id: expectedSessionId, createdAt: 9876544331, lastEventTime: lastEventTime, versionCode: "2.0.0")
        userDefaultStorage.recentSession = recentSession
        timeProvider.current = lastEventTime + 1000
        configProvider.sessionEndLastEventThresholdMs = 10000

        sessionManager.start()
        XCTAssertEqual(sessionManager.sessionId, "new-session-id", "Expected a new session to be created when the framework version is updated.")
    }

    func testSessionContinues_WhenEnteringForegroundBeforeThreshold() {
        sessionManager.start()

        let expectation = self.expectation(description: "Session continues when entering foreground before threshold")

        sessionManager.applicationDidEnterBackground()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            self.sessionManager.applicationWillEnterForeground()
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
            XCTAssertEqual(self.sessionManager.sessionId, "test-session-id-1", "Expected session ID to stay the same.")
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 2.0)
    }

    func testNewSessionCreated_WhenEnteringForegroundAfterThreshold() {
        sessionManager = BaseSessionManager(idProvider: idProvider,
                                            logger: logger,
                                            timeProvider: BaseTimeProvider(),
                                            configProvider: configProvider,
                                            randomizer: randomizer,
                                            sessionStore: sessionStore,
                                            eventStore: MockEventStore(),
                                            userDefaultStorage: userDefaultStorage,
                                            versionCode: "1.0.0")
        sessionManager.start()

        let expectation = self.expectation(description: "New session created after entering foreground after threshold")

        sessionManager.applicationDidEnterBackground()
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.1) {
            self.sessionManager.applicationWillEnterForeground()
        }

        idProvider.idString = "test-session-id-2"

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.3) {
            XCTAssertEqual(self.sessionManager.sessionId, "test-session-id-2", "Expected session ID to change to 'test-session-id-2' after app enters foreground.")
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 3.0)
    }

    func testSessionStore() {
        let expectation = self.expectation(description: "Session store contains expected number of sessions")
        sessionManager.start()

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            let sessions = self.sessionStore.getAllSessions()
            XCTAssertEqual(sessions?.count, 1, "Expected 1 session in session store.")
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 2.0)
    }

    func testCreatesNewSession_WhenRecentSessionIsUnavailable() {
        let expectedSessionId = "new-session-id"
        idProvider.idString = expectedSessionId
        userDefaultStorage.recentSession = nil

        sessionManager.start()
        let sessionId = sessionManager.sessionId

        XCTAssertEqual(sessionId, expectedSessionId, "Expected a new session to be created.")
    }

    func testCreatesNewSession_WhenLastEventHappenedAfterThresholdTime() {
        let expectedSessionId = "new-session-id"
        idProvider.idString = expectedSessionId
        let lastEventTime: Int64 = 1000
        let recentSession = RecentSession(id: "previous-session-id", createdAt: 9876544331, lastEventTime: lastEventTime, versionCode: "1.0.0")
        userDefaultStorage.recentSession = recentSession
        timeProvider.current = lastEventTime + 5000
        configProvider.sessionEndLastEventThresholdMs = 1000

        sessionManager.start()
        let sessionId = sessionManager.sessionId

        XCTAssertEqual(sessionId, expectedSessionId, "Expected a new session to be created after the threshold time.")
    }

    func testContinuesRecentSession_WhenLastEventHappenedWithinThresholdTime() {
        let expectedSessionId = "previous-session-id"
        idProvider.idString = "new-session-id"
        let lastEventTime: Int64 = 1000
        let recentSession = RecentSession(id: expectedSessionId, createdAt: 9876544331, lastEventTime: lastEventTime, versionCode: "1.0.0")
        userDefaultStorage.recentSession = recentSession
        timeProvider.current = lastEventTime + 1000
        configProvider.sessionEndLastEventThresholdMs = 10000

        sessionManager.start()
        let sessionId = sessionManager.sessionId

        XCTAssertEqual(sessionId, expectedSessionId, "Expected to continue the recent session within the threshold time.")
    }

    func testStartsNewSession_IfMaxSessionDurationReached() {
        let expectedSessionId = "new-session-id"
        idProvider.idString = expectedSessionId
        configProvider.maxSessionDurationMs = 500
        let recentSessionCreatedAtTime: Int64 = 1000
        let recentSession = RecentSession(id: "previous-session-id", createdAt: recentSessionCreatedAtTime, versionCode: "1.0.0")
        userDefaultStorage.recentSession = recentSession
        timeProvider.current = recentSessionCreatedAtTime + configProvider.maxSessionDurationMs

        sessionManager.start()
        let sessionId = sessionManager.sessionId

        XCTAssertEqual(sessionId, expectedSessionId, "Expected a new session to be created after the max session duration was reached.")
    }

    func testCreatesNewSession_IfLastSessionCrashedWithinThresholdTime() {
        configProvider.sessionEndLastEventThresholdMs = 100000
        let sessionCreatedAt: Int64 = 1000
        timeProvider.current = sessionCreatedAt
        sessionManager.start()
        let newSessionId = "new-session-id"
        idProvider.idString = newSessionId
        let lastEventTime: Int64 = sessionCreatedAt + 1000
        timeProvider.current = lastEventTime + 1000

        sessionManager.setPreviousSessionCrashed(true)
        sessionManager.start()

        XCTAssertEqual(sessionManager.sessionId, newSessionId, "Expected a new session to be created after the previous session crashed, even within the threshold time.")
    }
}
