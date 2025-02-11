//
//  SystemCrashReporter.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 20/09/24.
//

import CrashReporter
import Foundation

/// A protocol defining the behaviour of a crash reporter. It is responsible for generating and managing crash reports.
protocol SystemCrashReporter {
    var hasPendingCrashReport: Bool { get }
    func setCrashCallback(_ handleSignal: PLCrashReporterPostCrashSignalCallback)
    func enable() throws
    func clearCrashData()
    func loadCrashReport() throws -> Data
}

final class BaseSystemCrashReporter: SystemCrashReporter {
    private let crashReporter: PLCrashReporter
    var hasPendingCrashReport: Bool {
        return crashReporter.hasPendingCrashReport()
    }

    init() {
        crashReporter = PLCrashReporter()
    }

    func setCrashCallback(_ handleSignal: PLCrashReporterPostCrashSignalCallback) {
        var crashReporterCallbacks = PLCrashReporterCallbacks(
            version: 0,
            context: nil,
            handleSignal: handleSignal
        )
        crashReporter.setCrash(&crashReporterCallbacks)
    }

    func enable() throws {
        return try crashReporter.enableAndReturnError()
    }

    func clearCrashData() {
        crashReporter.purgePendingCrashReport()
    }

    func loadCrashReport() throws -> Data {
        return try crashReporter.loadPendingCrashReportDataAndReturnError()
    }
}
