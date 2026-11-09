//
//  MockSessionManager.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/09/24.
//

import Foundation
@testable import Measure

final class MockSessionManager: SessionManager {
    var sessionId: String
    private(set) var startCalled = false
    private(set) var signalProcessor: SignalProcessor?
    private(set) var applicationDidEnterBackgroundCalled = false
    private(set) var applicationWillEnterForegroundCalled = false
    private(set) var applicationWillTerminateCalled = false
    private(set) var onEventTrackedCalled = false
    private(set) var onEventTrackedCallCount = 0
    private(set) var isPreviousSessionCrashed: Bool?
    private(set) var isCrashed = false
    private(set) var trackedEvent: Any?
    var sessionStartTime: Number?
    var onSessionStartedCallback: ((String) -> Void)?

    init(sessionId: String = "mock-session-id") {
        self.sessionId = sessionId
    }

    func start() {
        startCalled = true
    }

    func getSessionStartTime() -> Number? {
        return sessionStartTime
    }

    func applicationDidEnterBackground() {
        applicationDidEnterBackgroundCalled = true
    }

    func applicationWillEnterForeground() {
        applicationWillEnterForegroundCalled = true
    }

    func applicationWillTerminate() {
        applicationWillTerminateCalled = true
    }

    func onEventTracked<T>(_ event: Event<T>) where T: Decodable & Encodable {
        onEventTrackedCalled = true
        onEventTrackedCallCount += 1
        trackedEvent = event
    }

    func setPreviousSessionCrashed(_ crashed: Bool) {
        isPreviousSessionCrashed = crashed
    }

    func markCurrentSessionAsCrashed() {
        isCrashed = true
    }

    func setOnSessionStarted(_ callback: ((String) -> Void)?) {
        onSessionStartedCallback = callback
    }
}
