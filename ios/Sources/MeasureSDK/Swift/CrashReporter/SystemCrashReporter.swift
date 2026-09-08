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
    func disable()
    func clearCrashData()
    func loadCrashReport() throws -> [String: Any]
    func loadAllCrashReports() -> [[String: Any]]
}

final class BaseSystemCrashReporter: SystemCrashReporter {
    private static var isKSCrashInstalled = false

    private let logger: Logger

    var hasPendingCrashReport: Bool {
        return KSCrash.shared.reportStore?.reportCount ?? 0 > 0
    }

    init(logger: Logger) {
        self.logger = logger
        do {
            try enable()
        } catch {
            logger.internalLog(level: .error, message: "MeasureInternal: KSCrash enable failed.", error: error, data: nil)
        }
    }

    func enable() throws {
        if Self.isKSCrashInstalled {
            return
        }

        let config = KSCrashConfiguration()
        config.monitors = [
            .machException,
            .signal,
            .cppException,
            .nsException,
            .mainThreadDeadlock,
            .memoryTermination
        ]

        config.isWritingReportCallback = { plan, writer in
            CrashDataWriter.shared.writeCrashData(plan: plan, writer: writer)
        }

        do {
            try KSCrash.shared.install(with: config)
        } catch {
            logger.internalLog(level: .error, message: "SystemCrashReporter: Failed to enable KSCrash.", error: error, data: nil)
            throw error
        }

        Self.isKSCrashInstalled = true
        logger.log(level: .info, message: "SystemCrashReporter: Crash reporter enabled.", error: nil, data: nil)
    }

    func disable() {
        kscm_disableAllMonitors()
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

    func loadAllCrashReports() -> [[String: Any]] {
        guard let store = KSCrash.shared.reportStore else { return [] }
        return store.reportIDs.compactMap { store.report(for: Int64(truncating: $0))?.value }
    }
}

enum CrashReporterError: Error {
    case noPendingReport
    case invalidReportFormat
}
