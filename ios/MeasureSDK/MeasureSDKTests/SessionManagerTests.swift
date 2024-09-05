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
    var timeProvider: MockTimeProvider!

    override func setUp() {
        super.setUp()
        idProvider = MockIdProvider("test-session-id-1")
        logger = MockLogger(enabled: false)
        timeProvider = MockTimeProvider(currentTimeSinceEpochInMillis: 1_000_000_000,
                                            currentTimeSinceEpochInNanos: 1_000_000_000_000,
                                            uptimeInMillis: 1_000_000,
                                            iso8601Timestamp: "2001-09-09T01:46:40.000Z")
        configProvider = MockConfigProvider(enableLogging: false,
                                                trackScreenshotOnCrash: false,
                                                sessionSamplingRate: 1.0,
                                                eventsBatchingIntervalMs: 1000,
                                                sessionEndThresholdMs: 1000)
        randomizer = MockRandomizer(0.5)
        sessionManager = BaseSessionManager(idProvider: idProvider,
                                            logger: logger,
                                            timeProvider: timeProvider,
                                            configProvider: configProvider,
                                            randomizer: randomizer)
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
        NotificationCenter.default.post(name: UIApplication.didEnterBackgroundNotification, object: nil)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            NotificationCenter.default.post(name: UIApplication.willEnterForegroundNotification, object: nil)
        }
        XCTAssertEqual(sessionManager.sessionId, "test-session-id-1", "Expected session ID to be 'test-session-id-1' before app enters foreground.")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
            XCTAssertEqual(self.sessionManager.sessionId, "test-session-id-1", "Expected session ID to stay same.")
        }
    }

    func testNewSessionCreated_WhenEnteringForegroundAfterThreshold() {
        sessionManager.start()
        NotificationCenter.default.post(name: UIApplication.didEnterBackgroundNotification, object: nil)
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.1) {
            NotificationCenter.default.post(name: UIApplication.willEnterForegroundNotification, object: nil)
        }
        idProvider.idString = "test-session-id-2"
        XCTAssertEqual(sessionManager.sessionId, "test-session-id-1", "Expected session ID to be 'test-session-id-1' before app enters foreground.")
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            XCTAssertEqual(self.sessionManager.sessionId, "test-session-id-2", "Expected session ID to change to 'test-session-id-2' after app enters foreground.")
        }
    }
}
