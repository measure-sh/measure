//
//  AppVersionInfo.swift
//  Measure
//
//  Created by Adwin Ross on 26/03/25.
//

import Foundation

protocol AppVersionInfo {
    func getAppVersion() -> String?
    func getBuildNumber() -> String?
}

final class BaseAppVersionInfo: AppVersionInfo {
    func getAppVersion() -> String? {
        return Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
    }
    
    func getBuildNumber() -> String? {
        return Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String
    }
}
