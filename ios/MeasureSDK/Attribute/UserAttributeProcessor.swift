//
//  UserAttributeProcessor.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 03/09/24.
//

import Foundation

/// Maintains the state for the user ID attribute. The user ID is set by the SDK user and can change during the session.
/// This class returns the latest user ID set by the user.
final class UserAttributeProcessor: AttributeProcessor {
    private let userDefaultStorage: UserDefaultStorage
    private var loadedFromDisk = false
    private var userId: String?

    init(userDefaultStorage: UserDefaultStorage) {
        self.userDefaultStorage = userDefaultStorage
    }

    func appendAttributes(_ attributes: inout Attributes) {
        if !loadedFromDisk {
            userId = userDefaultStorage.getUserId()
            loadedFromDisk = true
        }
        attributes.userId = userId
    }

    func setUserId(_ userId: String) {
        self.userId = userId
        self.userDefaultStorage.setUserId(userId)
    }

    func getUserId() -> String? {
        return userId
    }

    func clearUserId() {
        userId = nil
        self.userDefaultStorage.setUserId(nil)
    }
}
