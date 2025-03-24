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

    init(sessionId: String) {
        self.sessionId = sessionId
    }

    func start() {}
    func applicationDidEnterBackground() {}
    func applicationWillEnterForeground() {}
    func applicationWillTerminate() {}
    func onEventTracked(_ event: EventEntity) {
        trackedEvent = event
    }

    func setPreviousSessionCrashed(_ crashed: Bool) {
        isPreviousSessionCrashed = crashed
    }
}
