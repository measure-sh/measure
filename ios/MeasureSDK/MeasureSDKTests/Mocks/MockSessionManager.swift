//
//  MockSessionManager.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 06/09/24.
//

import Foundation
@testable import MeasureSDK

class MockSessionManager: SessionManager {
    var sessionId: String

    func start() {}

    func applicationDidEnterBackground() {}

    func applicationWillEnterForeground() {}

    func applicationWillTerminate() {}

    init(sessionId: String) {
        self.sessionId = sessionId
    }
}
