//
//  ValidationLimits.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 08/10/26.
//

import Foundation

enum ValidationLimits {
    static let deviceName = 32
    static let deviceModel = 32
    static let deviceLocale = 64
    static let threadName = 128
    static let userId = 128
    static let appVersion = 128
    static let appBuild = 32
    static let networkProvider = 64
    static let patchVersion = 256

    static let launchedActivity = 127
    static let networkChangeProvider = 63
    static let gestureTarget = 128
    static let gestureTargetId = 128
    static let viewControllerClassName = 256
    static let swiftUIClassName = 128
    static let screenViewName = 1024
    static let httpClient = 32
    static let exceptionMetaBytes = 4096
}
