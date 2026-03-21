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
    var signalProcessor: MockSignalProcessor!

    override func setUp() {
        super.setUp()
        idProvider = MockIdProvider()
        idProvider.uuId = "test-session-id-1"
        logger = MockLogger()
        timeProvider = MockTimeProvider()
        userDefaultStorage = MockUserDefaultStorage()
        configProvider = MockConfigProvider(enableLogging: false,
                                            eventsBatchingIntervalMs: 1000,
                                            longPressTimeout: 0.5,
                                            scaledTouchSlop: 20,
                                            maxAttachmentSizeInEventsBatchInBytes: 30000,
                                            maxEventsInBatch: 500)
        randomizer = MockRandomizer()
        signalProcessor = MockSignalProcessor()
        randomizer.randomFloat = 0.5
        sessionStore = BaseSessionStore(coreDataManager: MockCoreDataManager(),
                                        logger: logger)
        sessionManager = BaseSessionManager(idProvider: idProvider,
                                            logger: logger,
                                            timeProvider: timeProvider,
                                            configProvider: configProvider,
                                            sessionStore: sessionStore,
                                            eventStore: MockEventStore(),
                                            userDefaultStorage: userDefaultStorage,
                                            versionCode: "1.0.0",
                                            signalSampler: BaseSignalSampler(configProvider: configProvider,
                                                                             randomizer: randomizer))
        sessionManager.setOnSessionStarted { sessionId in
            self.signalProcessor.track(data: SessionStartData(),
                                       timestamp: self.sessionManager.getSessionStartTime()!,
                                       type: .sessionStart,
                                       attributes: nil,
                                       sessionId: sessionId,
                                       attachments: nil,
                                       userDefinedAttributes: nil,
                                       threadName: nil,
                                       needsReporting: true,
                                       synchronous: true)
        }
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
        userDefaultStorage = nil
        sessionStore = nil
        signalProcessor = nil
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

    func testCreatesNewSession_WhenFrameworkVersionUpdated() {
        let expectedSessionId = "previous-session-id"
        idProvider.uuId = "new-session-id"
        let lastEventTime: Int64 = 1000
        let recentSession = RecentSession(id: expectedSessionId, createdAt: 9876544331, lastEventTime: lastEventTime, versionCode: "2.0.0")
        userDefaultStorage.recentSession = recentSession
        timeProvider.current = lastEventTime + 1000
        configProvider.sessionBackgroundTimeoutThresholdMs = 10000

        sessionManager.start()
        XCTAssertEqual(sessionManager.sessionId, "new-session-id", "Expected a new session to be created when the framework version is updated.")
    }

    func testSessionContinues_WhenEnteringForegroundBeforeThreshold() {
        timeProvider.millisTime = 1000
        sessionManager.start()
        sessionManager.applicationDidEnterBackground()

        // simulate time passage
        timeProvider.millisTime += configProvider.sessionBackgroundTimeoutThresholdMs - 1
        idProvider.uuId = "test-session-id-2"

        sessionManager.applicationWillEnterForeground()

        XCTAssertEqual(sessionManager.sessionId, "test-session-id-1", "Expected session ID to stay the same if threshold is not crossed.")
    }

    func testNewSessionCreated_WhenEnteringForegroundAfterThreshold() {
        timeProvider.millisTime = 1000
        sessionManager.start()
        sessionManager.applicationDidEnterBackground()

        // simulate time passage
        timeProvider.millisTime += configProvider.sessionBackgroundTimeoutThresholdMs + 1
        idProvider.uuId = "test-session-id-2"

        sessionManager.applicationWillEnterForeground()

        XCTAssertEqual(sessionManager.sessionId, "test-session-id-2", "Expected new session ID as threshold was crossed.")
    }

    func testSessionStore() {
        sessionManager.start()

        let sessions = sessionStore.getAllSessions()
        XCTAssertEqual(sessions.count, 1, "Expected 1 session in session store.")
    }

    func testCreatesNewSession_WhenRecentSessionIsUnavailable() {
        let expectedSessionId = "new-session-id"
        idProvider.uuId = expectedSessionId
        userDefaultStorage.recentSession = nil

        sessionManager.start()
        let sessionId = sessionManager.sessionId

        XCTAssertEqual(sessionId, expectedSessionId, "Expected a new session to be created.")
    }

    func testCreatesNewSession_WhenLastEventHappenedAfterThresholdTime() {
        let expectedSessionId = "new-session-id"
        idProvider.uuId = expectedSessionId
        let lastEventTime: Int64 = 1000
        let recentSession = RecentSession(id: "previous-session-id", createdAt: 9876544331, lastEventTime: lastEventTime, versionCode: "1.0.0")
        userDefaultStorage.recentSession = recentSession
        timeProvider.current = lastEventTime + 5000
        configProvider.sessionBackgroundTimeoutThresholdMs = 1000

        sessionManager.start()
        let sessionId = sessionManager.sessionId

        XCTAssertEqual(sessionId, expectedSessionId, "Expected a new session to be created after the threshold time.")
    }

    func testCreatesNewSession_WhenAppVersionIsUpdated() {
        userDefaultStorage.setRecentAppVersion("1.0.1")
        let newSessionId = "new-session-id"
        idProvider.uuId = newSessionId
        sessionManager.start()

        XCTAssertEqual(sessionManager.sessionId, newSessionId, "Expected a new session to be created after the previous session crashed, even within the threshold time.")
    }

    func testCreatesNewSession_WhenAppBuildNumberIsUpdated() {
        userDefaultStorage.setRecentBuildNumber("2")
        let newSessionId = "new-session-id"
        idProvider.uuId = newSessionId
        sessionManager.start()

        XCTAssertEqual(sessionManager.sessionId, newSessionId, "Expected a new session to be created after the previous session crashed, even within the threshold time.")
    }

    func testCreatesNewSession_IfLastSessionCrashedWithinThresholdTime() {
        configProvider.sessionBackgroundTimeoutThresholdMs = 100000
        let sessionCreatedAt: Int64 = 1000
        timeProvider.current = sessionCreatedAt
        sessionManager.start()
        let newSessionId = "new-session-id"
        idProvider.uuId = newSessionId
        let lastEventTime: Int64 = sessionCreatedAt + 1000
        timeProvider.current = lastEventTime + 1000

        sessionManager.setPreviousSessionCrashed(true)
        sessionManager.start()

        XCTAssertEqual(sessionManager.sessionId, newSessionId, "Expected a new session to be created after the previous session crashed, even within the threshold time.")
    }

    func testSessionStart_TracksSessionStartEvent() {
        sessionManager.start()

        XCTAssertEqual(signalProcessor.type, .sessionStart, "Expected a sessionStart event to be tracked on start.")
        XCTAssertEqual(signalProcessor.sessionId, "test-session-id-1", "Expected tracked event to have the correct session ID.")
    }

    func testSessionForeground_TracksSessionStartEvent_AfterThreshold() {
        timeProvider.millisTime = 1000
        sessionManager.start()
        sessionManager.applicationDidEnterBackground()

        timeProvider.millisTime += configProvider.sessionBackgroundTimeoutThresholdMs + 1
        idProvider.uuId = "new-session-id-after-bg"
        sessionManager.applicationWillEnterForeground()

        XCTAssertEqual(sessionManager.sessionId, "new-session-id-after-bg")
        XCTAssertEqual(signalProcessor.type, .sessionStart, "Expected sessionStart event for the new session after backgrounding.")
        XCTAssertEqual(signalProcessor.sessionId, "new-session-id-after-bg")
    }

    func testSessionStart_DoesNotTrackEvent_IfProcessorNotSet() {
        let managerWithoutProcessor = BaseSessionManager(idProvider: idProvider,
                                                         logger: logger,
                                                         timeProvider: timeProvider,
                                                         configProvider: configProvider,
                                                         sessionStore: sessionStore,
                                                         eventStore: MockEventStore(),
                                                         userDefaultStorage: userDefaultStorage,
                                                         versionCode: "1.0.0",
                                                         signalSampler: BaseSignalSampler(configProvider: configProvider,
                                                                                          randomizer: randomizer))

        managerWithoutProcessor.start()
        XCTAssertNil(signalProcessor.type, "No event should be tracked if processor is nil.")
    }
}
