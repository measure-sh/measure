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
    func generateLiveReport() -> Data
}

final class BaseSystemCrashReporter: SystemCrashReporter {
    private let crashReporter: PLCrashReporter
    private let logger: Logger
    var hasPendingCrashReport: Bool {
        return crashReporter.hasPendingCrashReport()
    }

    init(logger: Logger) {
        self.logger = logger
        let config = PLCrashReporterConfig(signalHandlerType: .BSD, symbolicationStrategy: [], shouldRegisterUncaughtExceptionHandler: false)
        guard let crashReporter = PLCrashReporter(configuration: config) else {
            logger.log(level: .error, message: "Could not create an instance of PLCrashReporter with config.", error: nil, data: nil)
            logger.log(level: .info, message: "Initialising PLCrashReporter with default config.", error: nil, data: nil)
            self.crashReporter = PLCrashReporter()
            return
        }
        self.crashReporter = crashReporter
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

    func generateLiveReport() -> Data {
        return crashReporter.generateLiveReport()
    }
}
