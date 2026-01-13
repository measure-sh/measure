//
//  MockSessionManager.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/09/24.
//

import Foundation
@testable import Measure

final class MockSessionManager: SessionManager {
    var shouldReportSession: Bool = true
    var sessionId: String = ""
    var isPreviousSessionCrashed = false
    var trackedEvent: EventEntity?
    var isCrashed: Bool = false
    var onConfigLoadedHandler: (() -> Void)?

    init(sessionId: String = "session-id", onConfigLoaded: (() -> Void)? = nil) {
        self.sessionId = sessionId
        self.onConfigLoadedHandler = onConfigLoaded
    }

    func start(onNewSession: (String?) -> Void) {}
    func applicationDidEnterBackground() {}
    func applicationWillEnterForeground() {}
    func applicationWillTerminate() {}
    func onEventTracked(_ event: EventEntity) {
        trackedEvent = event
    }

    func setPreviousSessionCrashed(_ crashed: Bool) {
        isPreviousSessionCrashed = crashed
    }

    func markCurrentSessionAsCrashed() {
        isCrashed = true
    }

    func onConfigLoaded() {
        onConfigLoadedHandler?()
    }
}
