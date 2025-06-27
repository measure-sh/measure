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
    private let measureDispatchQueue: MeasureDispatchQueue
    private let userDefaultStorage: UserDefaultStorage
    private var userId: String?
    private var loadedFromDisk = AtomicBool()

    init(userDefaultStorage: UserDefaultStorage, measureDispatchQueue: MeasureDispatchQueue) {
        self.userDefaultStorage = userDefaultStorage
        self.measureDispatchQueue = measureDispatchQueue
    }

    func appendAttributes(_ attributes: inout Attributes) {
        loadedFromDisk.setTrueIfFalse {
            userId = userDefaultStorage.getUserId()
        }
        attributes.userId = userId
    }

    func setUserId(_ userId: String) {
        self.userId = userId
        measureDispatchQueue.submit {
            self.userDefaultStorage.setUserId(userId)
        }
    }

    func getUserId() -> String? {
        return userId
    }

    func clearUserId() {
        self.userId = nil
        measureDispatchQueue.submit {
            self.userDefaultStorage.setUserId(nil)
        }
    }
}
