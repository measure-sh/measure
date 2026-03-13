//
//  SystemCrashReporter.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 20/09/24.
//

#if canImport(KSCrashRecording)
import KSCrashRecording
#elseif canImport(KSCrash)
import KSCrash
#endif
import Foundation

/// A protocol defining the behaviour of a crash reporter.
protocol SystemCrashReporter {
    var hasPendingCrashReport: Bool { get }
    func enable() throws
    func clearCrashData()
    func loadCrashReport() throws -> [String: Any]
}

final class BaseSystemCrashReporter: SystemCrashReporter {
    private let logger: Logger
    private let crashDataPersistence: CrashDataPersistence

    var hasPendingCrashReport: Bool {
        return KSCrash.shared.reportStore?.reportCount ?? 0 > 0
    }

    init(logger: Logger, crashDataPersistence: CrashDataPersistence) {
        self.logger = logger
        self.crashDataPersistence = crashDataPersistence
        do {
            try enable()
        } catch {
            logger.internalLog(level: .error, message: "SystemCrashReporter: KSCrash init failed.", error: error, data: nil)
        }
    }

    func enable() throws {
        let config = KSCrashConfiguration()
        config.monitors = [
            .machException,
            .signal,
            .cppException,
            .nsException,
            .mainThreadDeadlock,
            .memoryTermination
        ]
        config.crashNotifyCallback = { _ in
            CrashDataWriter.shared.writeCrashData()
        }

        crashDataPersistence.prepareCrashFile()

        do {
            try KSCrash.shared.install(with: config)
        } catch {
            logger.internalLog(level: .error, message: "SystemCrashReporter: Failed to enable KSCrash.", error: error, data: nil)
            throw error
        }

        logger.log(level: .info, message: "SystemCrashReporter: Crash reporter enabled.", error: nil, data: nil)
    }

    func clearCrashData() {
        KSCrash.shared.reportStore?.deleteAllReports()
    }

    func loadCrashReport() throws -> [String: Any] {
        guard let store = KSCrash.shared.reportStore,
              let reportID = store.reportIDs.first,
              let report = store.report(for: Int64(truncating: reportID)) else {
            throw CrashReporterError.noPendingReport
        }
        return report.value
    }
}

enum CrashReporterError: Error {
    case noPendingReport
    case invalidReportFormat
}
