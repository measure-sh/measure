//
//  AppAttributeProcessor.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 03/09/24.
//

import Foundation

/// Generates the attributes for the app. The attributes include the app version, build version, and the unique ID of the app.
final class AppAttributeProcessor: BaseComputeOnceAttributeProcessor {
    private lazy var appVersion: String = AttributeConstants.unknown
    private lazy var appBuild: String = AttributeConstants.unknown
    private lazy var appUniqueId: String = AttributeConstants.unknown
    private lazy var measureSdkVersion: String = AttributeConstants.unknown

    override func updateAttribute(_ attribute: Attributes) {
        attribute.appVersion = appVersion
        attribute.appBuild = appBuild
        attribute.appUniqueId = appUniqueId
        attribute.measureSdkVersion = measureSdkVersion
    }

    override func computeAttributes() {
        self.appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? AttributeConstants.unknown
        self.appBuild = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? AttributeConstants.unknown
        self.appUniqueId = Bundle.main.bundleIdentifier ?? AttributeConstants.unknown
        self.measureSdkVersion = FrameworkInfo.version
    }
}
