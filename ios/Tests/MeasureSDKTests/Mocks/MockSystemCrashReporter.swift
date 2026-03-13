//
//  MockSystemCrashReporter.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/09/24.
//

import Foundation
@testable import Measure

final class MockSystemCrashReporter: SystemCrashReporter {
    var hasPendingCrashReport: Bool = false
    var enableCalled = false
    var enableShouldThrow = false
    var clearCrashDataCalled = false
    var reportToReturn: [String: Any]? = nil
    var loadCrashReportCalled = false

    func enable() throws {
        enableCalled = true
        if enableShouldThrow {
            throw NSError(domain: "MockSystemCrashReporter", code: -1, userInfo: [NSLocalizedDescriptionKey: "Mock enable failed"])
        }
    }

    func clearCrashData() {
        clearCrashDataCalled = true
        hasPendingCrashReport = false
    }

    func loadCrashReport() throws -> [String: Any] {
        loadCrashReportCalled = true
        guard let report = reportToReturn else {
            throw NSError(domain: "MockSystemCrashReporter", code: -2, userInfo: [NSLocalizedDescriptionKey: "No report available"])
        }
        return report
    }
}
