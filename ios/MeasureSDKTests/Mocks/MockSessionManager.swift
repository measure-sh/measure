//
//  MockSessionManager.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/09/24.
//

import Foundation
@testable import MeasureSDK

final class MockSessionManager: SessionManager {
    var sessionId: String

    init(sessionId: String) {
        self.sessionId = sessionId
    }

    func start() {}
    func applicationDidEnterBackground() {}
    func applicationWillEnterForeground() {}
    func applicationWillTerminate() {}
}
