//
//  MockUserDefaultStorage.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 04/09/24.
//

import Foundation
@testable import Measure

final class MockUserDefaultStorage: UserDefaultStorage {
    var installationId: String?
    var userId: String?
    var timestamp: Number = 0
    var recentSessionId: String?
    var recentSession: RecentSession?
    var launchData: LaunchData?

    func getInstallationId() -> String? {
        return installationId
    }

    func setInstallationId(_ installationId: String) {
        self.installationId = installationId
    }

    func getUserId() -> String? {
        return userId
    }

    func setUserId(_ userId: String?) {
        self.userId = userId
    }

    func getRecentSession() -> RecentSession? {
        return recentSession
    }

    func setRecentSessionEventTime(_ timestamp: Number) {
        self.timestamp = timestamp
        self.recentSession?.lastEventTime = timestamp
    }

    func setRecentSession(_ recentSession: RecentSession) {
        self.recentSession = recentSession
        self.recentSessionId = recentSession.id
    }

    func setRecentSessionCrashed() {
        self.recentSession?.crashed = true
    }

    func setRecentLaunchData(_ launchData: LaunchData) {
        self.launchData = launchData
    }

    func getRecentLaunchData() -> LaunchData? {
        return launchData
    }
}
