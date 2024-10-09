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
}

final class BaseUserDefaultStorage: UserDefaultStorage {
    private let suiteName = "com.measure.sh"
    private let userIdKey = "user_id"
    private let installationIdKey = "installation_id"

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
}
