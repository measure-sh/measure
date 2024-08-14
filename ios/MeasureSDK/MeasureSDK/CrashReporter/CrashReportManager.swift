//
//  CrashReportManager.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 12/08/24.
//

import Foundation

class CrashReportManager {
    static let shared = CrashReportManager()
    let crashReporter = MeasureCrashReporter()
    
    private init() {}
    
    func start() {
        crashReporter.initializeCrashReporter(with: UUID().uuidString)
        crashReporter.handleCrashReport()
    }
}
