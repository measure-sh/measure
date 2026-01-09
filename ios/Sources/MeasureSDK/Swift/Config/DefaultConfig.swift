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
    static let autoStart = true
    static let maxDiskUsageInMb: Number = 50
    static let enableFullCollectionMode = false
    static let disallowedCustomHeaders: [String] = ["Content-Type",
                                                    "msr-req-id",
                                                    "Authorization",
                                                    "Content-Length"]
    static let journeyEvents: [EventType] = [.lifecycleSwiftUI,
                                             .lifecycleViewController,
                                             .screenView]
}
