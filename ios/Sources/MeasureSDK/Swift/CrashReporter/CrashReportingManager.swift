//
//  CrashReportingManager.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 16/09/24.
//

import Foundation

protocol CrashReportManager {
    func enable()
    func disable()
    func trackException()
    var hasPendingCrashReport: Bool { get }
}

final class CrashReportingManager: CrashReportManager {
    private var crashReporter: SystemCrashReporter
    private let logger: Logger
    private let signalProcessor: SignalProcessor
    private let crashDataPersistence: CrashDataPersistence
    private let systemFileManager: SystemFileManager
    private let idProvider: IdProvider
    private let configProvider: ConfigProvider
    private var isEnabled = AtomicBool(false)
    let hasPendingCrashReport: Bool

    init(logger: Logger,
         signalProcessor: SignalProcessor,
         crashDataPersistence: CrashDataPersistence,
         crashReporter: SystemCrashReporter,
         systemFileManager: SystemFileManager,
         idProvider: IdProvider,
         configProvider: ConfigProvider) {
        self.logger = logger
        self.signalProcessor = signalProcessor
        self.crashDataPersistence = crashDataPersistence
        self.crashReporter = crashReporter
        self.hasPendingCrashReport = crashReporter.hasPendingCrashReport
        self.systemFileManager = systemFileManager
        self.idProvider = idProvider
        self.configProvider = configProvider
    }

    func enable() {
        isEnabled.setTrueIfFalse {
            do {
                try crashReporter.enable()
                self.logger.log(level: .info, message: "Crash reporter enabled.", error: nil, data: nil)
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to enable crash reporter.", error: error, data: nil)
            }
        }
    }

    func disable() {
        isEnabled.setFalseIfTrue {
            self.logger.log(level: .info, message: "Crash reporter disabled.", error: nil, data: nil)
        }
    }

    func trackException() {
        guard hasPendingCrashReport else { return }

        let exceptionData = processCrashReport()
        guard var exception = exceptionData.exception, let date = exceptionData.date else { return }

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
                                  needsReporting: true)
        }

        crashReporter.clearCrashData()
        crashDataPersistence.clearCrashData()
    }

    private func processCrashReport() -> (exception: Exception?, date: Date?) {
        do {
            let reportDict = try crashReporter.loadCrashReport()
            let crashReport = BaseCrashReport(reportDict)
            let formatter = CrashDataFormatter(crashReport)
            let exception = formatter.getException()

            // KSCrash stores the crash timestamp under "report" > "timestamp"
            let timestamp = (reportDict["report"] as? [String: Any])?["timestamp"] as? TimeInterval
            let date = timestamp.map { Date(timeIntervalSince1970: $0) } ?? Date()

            return (exception, date)
        } catch {
            logger.internalLog(level: .error, message: "Error parsing crash report.", error: error, data: nil)
            return (nil, nil)
        }
    }
}
