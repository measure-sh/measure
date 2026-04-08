//
//  CrashReportingManager.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 16/09/24.
//

#if canImport(KSCrashRecording)
import KSCrashRecording
#elseif canImport(KSCrash)
import KSCrash
#endif
import Foundation

protocol CrashReportManager {
    func trackException(completion: (() -> Void)?)
    var hasPendingCrashReport: Bool { get }
}

final class BaseCrashReportingManager: CrashReportManager {
    private static let kotlinCrashMarker = "msr_kmp_kotlin_crash"
    
    private var crashReporter: SystemCrashReporter
    private let logger: Logger
    private let signalProcessor: SignalProcessor
    private let crashDataPersistence: CrashDataPersistence
    private let systemFileManager: SystemFileManager
    private let idProvider: IdProvider
    private let sysCtl: SysCtl
    private let configProvider: ConfigProvider
    private var isEnabled = AtomicBool(false)
    let hasPendingCrashReport: Bool

    init(logger: Logger,
         signalProcessor: SignalProcessor,
         crashDataPersistence: CrashDataPersistence,
         crashReporter: SystemCrashReporter,
         systemFileManager: SystemFileManager,
         idProvider: IdProvider,
         sysCtl: SysCtl,
         configProvider: ConfigProvider) {
        self.logger = logger
        self.signalProcessor = signalProcessor
        self.crashDataPersistence = crashDataPersistence
        self.crashReporter = crashReporter
        self.hasPendingCrashReport = crashReporter.hasPendingCrashReport
        self.systemFileManager = systemFileManager
        self.idProvider = idProvider
        self.sysCtl = sysCtl
        self.configProvider = configProvider
    }

    func trackException(completion: (() -> Void)?) {
        guard hasPendingCrashReport else {
            completion?()
            return
        }

        // Kotlin crashes embed "msr_kmp_kotlin_crash" in the NSException's userInfo.
        // KSCrash stores this as a string in the crash report. If found, use the
        // Kotlin-specific processing which picks the NSException report and skips
        // the duplicate SIGABRT report. Otherwise, process as a native iOS crash.
        let exceptionData = processKotlinCrashReport() ?? processCrashReport()
        guard var exception = exceptionData.exception, let date = exceptionData.date else {
            crashReporter.clearCrashData()
            crashDataPersistence.clearCrashData()
            completion?()
            return
        }

        let crashDataAttributes = crashDataPersistence.readCrashData()
        if let attributes = crashDataAttributes.attribute, let sessionId = crashDataAttributes.sessionId {
            exception.foreground = crashDataAttributes.isForeground
            signalProcessor.track(data: exception,
                                  timestamp: Number(date.timeIntervalSince1970 * 1000),
                                  type: .exception,
                                  attributes: attributes,
                                  sessionId: sessionId,
                                  attachments: nil,
                                  userDefinedAttributes: nil,
                                  threadName: nil,
                                  needsReporting: true,
                                  synchronous: true)
        }

        crashReporter.clearCrashData()
        crashDataPersistence.clearCrashData()
        completion?()
    }

    /// Searches crash reports for a Kotlin-originated crash. Kotlin crashes embed
    /// "msr_kmp_kotlin_crash" in the NSException's userInfo. KSCrash stores this as
    /// a string in the report, so a substring check is sufficient.
    /// Returns nil if no Kotlin crash report is found.
    private func processKotlinCrashReport() -> (exception: Exception?, date: Date?)? {
        for reportDict in crashReporter.loadAllCrashReports() {
            let crashDict = reportDict["crash"] as? [String: Any] ?? [:]
            let errorDict = crashDict["error"] as? [String: Any] ?? [:]

            guard let nsExceptionDict = errorDict["nsexception"] as? [String: Any],
                  let userInfo = nsExceptionDict["userInfo"] as? String,
                  userInfo.contains(Self.kotlinCrashMarker) else {
                continue
            }

            let formatter = CrashDataFormatter(reportDict)
            let exception = formatter.getException()
            let timestamp = (reportDict["report"] as? [String: Any])?["timestamp"] as? TimeInterval
            let date = timestamp.map { Date(timeIntervalSince1970: $0) } ?? Date()
            return (exception, date)
        }

        return nil
    }

    private func processCrashReport() -> (exception: Exception?, date: Date?) {
        do {
            let reportDict = try crashReporter.loadCrashReport()
            let formatter  = CrashDataFormatter(reportDict, sysCtl: sysCtl)
            let exception  = formatter.getException()

            let timestamp = (reportDict["report"] as? [String: Any])?["timestamp"] as? TimeInterval
            let date = timestamp.map { Date(timeIntervalSince1970: $0) } ?? Date()

            return (exception, date)
        } catch {
            logger.internalLog(level: .error, message: "Error parsing crash report.", error: error, data: nil)
            return (nil, nil)
        }
    }
}
