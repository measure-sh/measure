//
//  UserDefaultStorage.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 03/09/24.
//

import Foundation

protocol UserDefaultStorage {
    func getInstallationId() -> String?
    func setInstallationId(_ installationId: String)
    func getUserId() -> String?
    func setUserId(_ userId: String?)
    func getRecentSession() -> RecentSession?
    func setRecentSessionEventTime(_ timestamp: Number)
    func setRecentSession(_ recentSession: RecentSession)
    func setRecentLaunchData(_ launchData: LaunchData)
    func getRecentLaunchData() -> LaunchData?
}

final class BaseUserDefaultStorage: UserDefaultStorage {
    private lazy var userDefaults: UserDefaults = {
        return UserDefaults(suiteName: suiteName) ?? UserDefaults.standard
    }()

    func getInstallationId() -> String? {
        return userDefaults.string(forKey: installationIdKey)
    }

    func setInstallationId(_ installationId: String) {
        userDefaults.set(installationId, forKey: installationIdKey)
    }

    func getUserId() -> String? {
        return userDefaults.string(forKey: userIdKey)
    }

    func setUserId(_ userId: String?) {
        if let userId = userId {
            userDefaults.set(userId, forKey: userIdKey)
        } else {
            userDefaults.removeObject(forKey: userIdKey)
        }
    }

    func setRecentSession(_ recentSession: RecentSession) {
        userDefaults.set(recentSession.id, forKey: recentSessionIdKey)
        userDefaults.set(recentSession.lastEventTime, forKey: recentSessionEventTimeKey)
        userDefaults.set(recentSession.createdAt, forKey: recentSessionCreatedAtKey)
        userDefaults.set(recentSession.crashed, forKey: recentSessionCrashedKey)
        userDefaults.set(recentSession.versionCode, forKey: recentSessionVersionCodeKey)
    }

    func setRecentSessionEventTime(_ timestamp: Number) {
        userDefaults.set(timestamp, forKey: recentSessionEventTimeKey)
    }

    func getRecentSession() -> RecentSession? {
        guard let sessionId = userDefaults.string(forKey: recentSessionIdKey),
              let versionCode = userDefaults.string(forKey: recentSessionVersionCodeKey) else {
            return nil
        }
        let eventTime = Number(userDefaults.integer(forKey: recentSessionEventTimeKey))
        let crashed = userDefaults.bool(forKey: recentSessionCrashedKey)
        let createdAt = Number(userDefaults.integer(forKey: recentSessionCreatedAtKey))

        return RecentSession(
            id: sessionId,
            createdAt: createdAt,
            lastEventTime: eventTime,
            crashed: crashed,
            versionCode: versionCode
        )
    }

    func setRecentLaunchData(_ launchData: LaunchData) {
        userDefaults.set(launchData.appVersion, forKey: recentLaunchAppVersion)
        userDefaults.set(launchData.timeSinceLastBoot, forKey: recentLaunchTimeSinceLastBoot)
    }

    func getRecentLaunchData() -> LaunchData? {
        guard let appVersion = userDefaults.string(forKey: recentLaunchAppVersion) else {
            return nil
        }
        let timeSinceLastBoot = userDefaults.integer(forKey: recentLaunchTimeSinceLastBoot)
        return LaunchData(appVersion: appVersion, timeSinceLastBoot: UnsignedNumber(timeSinceLastBoot))
    }
}
