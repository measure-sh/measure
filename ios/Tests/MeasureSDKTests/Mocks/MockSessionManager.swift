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
    var shouldReportJourneyEvents: Bool
    private(set) var startCalled = false
    private(set) var applicationDidEnterBackgroundCalled = false
    private(set) var applicationWillEnterForegroundCalled = false
    private(set) var applicationWillTerminateCalled = false
    private(set) var onEventTrackedCalled = false
    private(set) var onEventTrackedCallCount = 0
    private(set) var isPreviousSessionCrashed: Bool?
    private(set) var isCrashed = false
    private(set) var onConfigLoadedCalled = false
    private(set) var trackedEvent: Any?

    init(sessionId: String = "mock-session-id", shouldReportJourneyEvents: Bool = true) {
        self.sessionId = sessionId
        self.shouldReportJourneyEvents = shouldReportJourneyEvents
    }

    func start(onNewSession: (String?) -> Void) {
        startCalled = true

        onNewSession(sessionId)
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

    func onConfigLoaded() {
        onConfigLoadedCalled = true
    }
}
