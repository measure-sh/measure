//
//  SessionManagerTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 02/09/24.
//

import XCTest
@testable import MeasureSDK

final class SessionManagerTests: XCTestCase {
    var sessionManager: SessionManager!
    var idProvider: MockIdProvider!
    var logger: MockLogger!
    var configProvider: MockConfigProvider!
    var randomizer: MockRandomizer!
    var timeProvider: TimeProvider!
    var sessionStore: SessionStore!

    override func setUp() {
        super.setUp()
        idProvider = MockIdProvider("test-session-id-1")
        logger = MockLogger()
        timeProvider = SystemTimeProvider(systemTime: BaseSystemTime())
        configProvider = MockConfigProvider(enableLogging: false,
                                            trackScreenshotOnCrash: false,
                                            sessionSamplingRate: 1.0,
                                            eventsBatchingIntervalMs: 1000,
                                            sessionEndThresholdMs: 1000)
        randomizer = MockRandomizer(0.5)
        sessionStore = BaseSessionStore(coreDataManager: MockCoreDataManager(),
                                        logger: logger)
        sessionManager = BaseSessionManager(idProvider: idProvider,
                                            logger: logger,
                                            timeProvider: timeProvider,
                                            configProvider: configProvider,
                                            randomizer: randomizer,
                                            sessionStore: sessionStore)
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
        expectFatalError(expectedMessage: "Session ID is null. Ensure that start() is called before acessing sessionId.") {
            let _ = self.sessionManager.sessionId // swiftlint:disable:this redundant_discardable_let
        }
    }

    func testSessionStart() {
        sessionManager.start()
        XCTAssertEqual(sessionManager.sessionId, "test-session-id-1", "Expected session ID to be 'test-session-id-1' after initialisation.")
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
        sessionManager.start()

        let expectation = self.expectation(description: "New session created after entering foreground after threshold")

        sessionManager.applicationDidEnterBackground()
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.1) {
            self.sessionManager.applicationWillEnterForeground()
        }

        idProvider.idString = "test-session-id-2"

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
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
}
