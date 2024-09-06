//
//  InstallationIdAttributeProcessor.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 03/09/24.
//

import Foundation

/// Generates the installation ID. The installation ID is stored in shared preferences and is generated once during the first launch of the app with Measure SDK and is persisted across app launches.
final class InstallationIdAttributeProcessor: BaseComputeOnceAttributeProcessor {
    private let userDefaultStorage: UserDefaultStorage
    private let idProvider: IdProvider
    private var installationId = ""

    init(userDefaultStorage: UserDefaultStorage, idProvider: IdProvider) {
        self.userDefaultStorage = userDefaultStorage
        self.idProvider = idProvider
    }

    override func updateAttribute(_ attribute: inout Attributes) {
        attribute.installationId = installationId
    }

    override func computeAttributes() {
        if let installationId = userDefaultStorage.getInstallationId() {
            self.installationId = installationId
        } else {
            let newInstallationId = idProvider.createId()
            userDefaultStorage.setInstallationId(newInstallationId)
            self.installationId = newInstallationId
        }
    }
}
