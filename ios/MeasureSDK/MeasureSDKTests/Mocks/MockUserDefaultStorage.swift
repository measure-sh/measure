//
//  MockUserDefaultStorage.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 04/09/24.
//

import Foundation
@testable import MeasureSDK

final class MockUserDefaultStorage: UserDefaultStorage {
    var installationId: String?
    var userId: String?

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
}
