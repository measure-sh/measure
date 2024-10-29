//
//  CrashReportingManager.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 16/09/24.
//

import Foundation
import CrashReporter

/// Global signal handler for crashes
func measureCrashCallback(info: UnsafeMutablePointer<siginfo_t>?, uap: UnsafeMutablePointer<ucontext_t>?, context: UnsafeMutableRawPointer?) {
    CrashDataWriter.shared.writeCrashData()
}

/// A protocol that defines the interface for managing crash reporting and exception tracking.
protocol CrashReportManager {
    func enableCrashReporting()
    func trackException()
    var hasPendingCrashReport: Bool { get }
}

/// The `CrashReportingManager` class is a concrete implementation of the `CrashReportManager` protocol.
///
/// It provides functionality for enabling crash reporting and tracking manually caught exceptions
/// using the underlying crash reporting system, PLCrashReporter.
final class CrashReportingManager: CrashReportManager {
    private var crashReporter: SystemCrashReporter
    private let logger: Logger
    private let eventProcessor: EventProcessor
    private let crashDataPersistence: CrashDataPersistence
    let hasPendingCrashReport: Bool

    init(logger: Logger, eventProcessor: EventProcessor, crashDataPersistence: CrashDataPersistence, crashReporter: SystemCrashReporter) {
        self.logger = logger
        self.eventProcessor = eventProcessor
        self.crashDataPersistence = crashDataPersistence
        self.crashReporter = crashReporter
        self.crashReporter.setCrashCallback(measureCrashCallback)
        self.hasPendingCrashReport = crashReporter.hasPendingCrashReport
    }

    func enableCrashReporting() {
        do {
            try crashReporter.enable()
            self.logger.internalLog(level: .info, message: "Crash reporter enabled", error: nil, data: nil)
        } catch {
            self.logger.internalLog(level: .error, message: "Failed to enable crash reporter", error: error, data: nil)
        }
    }

    func trackException() {
        guard hasPendingCrashReport else {
            return
        }
        let exceptionData = processCrashReport()
        guard var exception = exceptionData.exception, let date = exceptionData.date else {
            return
        }

        let crashDataAttributes = crashDataPersistence.readCrashData()
        if let attributes = crashDataAttributes.attribute, let sessionId = crashDataPersistence.sessionId {
            exception.foreground = crashDataPersistence.isForeground
            self.eventProcessor.track(data: exception,
                                      timestamp: Number(date.timeIntervalSince1970 * 1000),
                                      type: .exception,
                                      attributes: attributes,
                                      sessionId: sessionId,
                                      attachments: nil)
        }

        crashReporter.clearCrashData()
        crashDataPersistence.clearCrashData()
    }

    private func processCrashReport() -> (exception: Exception?, date: Date?) {
        do {
            let crashData = try crashReporter.loadCrashReport()
            let plCrashReport = try PLCrashReport(data: crashData)
            let crashDate = plCrashReport.systemInfo.timestamp
            let crashReport = BaseCrashReport(plCrashReport)
            let crashDataFormatter = CrashDataFormatter(crashReport)
            let exception = crashDataFormatter.getException()
            return (exception, crashDate)
        } catch {
            logger.internalLog(level: .error, message: "Error parsing crash report.", error: error, data: nil)
            return (nil, nil)
        }
    }
}
