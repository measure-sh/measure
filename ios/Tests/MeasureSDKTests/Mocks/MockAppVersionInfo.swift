//
//  MockAppVersionInfo.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/03/25.
//

import Foundation
@testable import Measure

final class MockAppVersionInfo: AppVersionInfo {
    var appVersion: String?
    var buildNumber: String?

    func getAppVersion() -> String? {
        return appVersion
    }
    
    func getBuildNumber() -> String? {
        return buildNumber
    }
}
