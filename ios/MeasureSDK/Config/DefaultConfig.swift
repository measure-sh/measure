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
    static let trackScreenshotOnCrash = true
    static let sessionSamplingRate: Float = 1.0
}
