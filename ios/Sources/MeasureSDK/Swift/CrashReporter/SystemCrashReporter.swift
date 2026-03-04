//
//  SystemCrashReporter.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 20/09/24.
//

import KSCrash
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
        // TODO: use isWritingReportCallback async safety
        config.crashNotifyCallback = { [weak self] _ in
            // This is async-safe — BaseCrashDataPersistence.writeCrashData()
            // uses only pre-opened file descriptors and C write().
            CrashDataWriter.shared.writeCrashData()
        }

        // Prepare the crash file before installing so the fd is ready
        // when crashNotifyCallback fires.
        crashDataPersistence.prepareCrashFile()

        do {
            try KSCrash.shared.install(with: config)
        } catch {
            logger.internalLog(level: .error, message: "Failed to enable KSCrash.", error: error, data: nil)
            throw error
        }

        logger.log(level: .info, message: "Crash reporter enabled.", error: nil, data: nil)
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
