//
//  Attributes+Extension.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/09/24.
//

import Foundation
@testable import Measure

extension Attributes: Equatable {
    public static func == (lhs: Attributes, rhs: Attributes) -> Bool {
        return lhs.threadName == rhs.threadName &&
            lhs.deviceName == rhs.deviceName &&
            lhs.deviceModel == rhs.deviceModel &&
            lhs.deviceManufacturer == rhs.deviceManufacturer &&
            lhs.deviceType == rhs.deviceType &&
            lhs.deviceIsFoldable == rhs.deviceIsFoldable &&
            lhs.deviceIsPhysical == rhs.deviceIsPhysical &&
            lhs.deviceDensityDpi == rhs.deviceDensityDpi &&
            lhs.deviceWidthPx == rhs.deviceWidthPx &&
            lhs.deviceHeightPx == rhs.deviceHeightPx &&
            lhs.deviceDensity == rhs.deviceDensity &&
            lhs.deviceLocale == rhs.deviceLocale &&
            lhs.osName == rhs.osName &&
            lhs.osVersion == rhs.osVersion &&
            lhs.platform == rhs.platform &&
            lhs.networkType == rhs.networkType &&
            lhs.networkGeneration == rhs.networkGeneration &&
            lhs.networkProvider == rhs.networkProvider &&
            lhs.installationId == rhs.installationId &&
            lhs.userId == rhs.userId &&
            lhs.deviceCpuArch == rhs.deviceCpuArch &&
            lhs.appVersion == rhs.appVersion &&
            lhs.appBuild == rhs.appBuild &&
            lhs.measureSdkVersion == rhs.measureSdkVersion &&
            lhs.appUniqueId == rhs.appUniqueId
    }
}
