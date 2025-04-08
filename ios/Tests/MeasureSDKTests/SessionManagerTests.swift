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
    var userDefaultStorage: MockUserDefaultStorage!
    var appVersionInfo: MockAppVersionInfo!

    override func setUp() {
        super.setUp()
        idProvider = MockIdProvider("test-session-id-1")
        logger = MockLogger()
        timeProvider = MockTimeProvider()
        userDefaultStorage = MockUserDefaultStorage()
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
        appVersionInfo = MockAppVersionInfo()
        sessionManager = BaseSessionManager(idProvider: idProvider,
                                            logger: logger,
                                            timeProvider: timeProvider,
                                            configProvider: configProvider,
                                            randomizer: randomizer,
                                            sessionStore: sessionStore,
                                            eventStore: MockEventStore(),
                                            userDefaultStorage: userDefaultStorage,
                                            versionCode: "1.0.0",
                                            appVersionInfo: appVersionInfo)
        appVersionInfo.appVersion = "1.0.0"
        appVersionInfo.buildNumber = "1"
        userDefaultStorage.setRecentAppVersion("1.0.0")
        userDefaultStorage.setRecentBuildNumber("1")
    }

    override func tearDown() {
        sessionManager = nil
        idProvider = nil
        logger = nil
        configProvider = nil
        randomizer = nil
        timeProvider = nil
        appVersionInfo = nil
        userDefaultStorage = nil
        sessionStore = nil
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
        timeProvider.millisTime = 1000
        sessionManager.start()
        sessionManager.applicationDidEnterBackground()

        // simulate time passage
        timeProvider.millisTime += configProvider.sessionEndLastEventThresholdMs - 1
        idProvider.idString = "test-session-id-2"

        sessionManager.applicationWillEnterForeground()

        XCTAssertEqual(sessionManager.sessionId, "test-session-id-1", "Expected session ID to stay the same if threshold is not crossed.")
    }

    func testNewSessionCreated_WhenEnteringForegroundAfterThreshold() {
        timeProvider.millisTime = 1000
        sessionManager.start()
        sessionManager.applicationDidEnterBackground()

        // simulate time passage
        timeProvider.millisTime += configProvider.sessionEndLastEventThresholdMs + 1
        idProvider.idString = "test-session-id-2"

        sessionManager.applicationWillEnterForeground()

        XCTAssertEqual(sessionManager.sessionId, "test-session-id-2", "Expected new session ID as threshold was crossed.")
    }

    func testSessionStore() {
        sessionManager.start()

        let sessions = self.sessionStore.getAllSessions()
        XCTAssertEqual(sessions?.count, 1, "Expected 1 session in session store.")
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

    func testCreatesNewSession_WhenAppVersionIsUpdated() {
        userDefaultStorage.setRecentAppVersion("1.0.1")
        let newSessionId = "new-session-id"
        idProvider.idString = newSessionId
        sessionManager.start()

        XCTAssertEqual(sessionManager.sessionId, newSessionId, "Expected a new session to be created after the previous session crashed, even within the threshold time.")
    }

    func testCreatesNewSession_WhenAppBuildNumberIsUpdated() {
        userDefaultStorage.setRecentBuildNumber("2")
        let newSessionId = "new-session-id"
        idProvider.idString = newSessionId
        sessionManager.start()

        XCTAssertEqual(sessionManager.sessionId, newSessionId, "Expected a new session to be created after the previous session crashed, even within the threshold time.")
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
