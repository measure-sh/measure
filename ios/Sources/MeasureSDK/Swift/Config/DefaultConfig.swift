//
//  DefaultConfig.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 25/08/24.
//

import Foundation

/// Default values of configuration options for the Measure SDK.
struct DefaultConfig {
    static let enableLogging = false
    static let sessionSamplingRate: Float = 0.0
    static let traceSamplingRate: Float = 0.1
    static let trackHttpHeaders = false
    static let trackHttpBody = false
    static let httpHeadersBlocklist: [String] = []
    static let httpUrlBlocklist: [String] = []
    static let httpUrlAllowlist: [String] = []
    static let autoStart = true
    static let trackViewControllerLoadTime = true
}
