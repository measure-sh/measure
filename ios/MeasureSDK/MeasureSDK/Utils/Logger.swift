//
//  Logger.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 29/08/24.
//

import Foundation
import os.log

/// Log levels for internal logging.
enum LogLevel: String {
    case debug = "Debug"
    case info = "Info"
    case warning = "Warning"
    case error = "Error"
    case fatal = "Fatal"
}

/// Interface for internal logging in Measure SDK.
protocol Logger {
    var enabled: Bool { get }

    func log(level: LogLevel, message: String, error: Error?)
}

/// A logger that logs to the Apple unified logging system (os_log).
final class MeasureLogger: Logger {
    private let logTag: String = "Measure"
    let enabled: Bool

    init(enabled: Bool) {
        self.enabled = enabled
    }

    /// Add logs to the Apple unified logging system (os_log)
    /// - Parameters:
    ///   - level: Any of `debug`, `info`, `warning`, `error` or `fatal`
    ///   - message: Message to log
    ///   - error: Error object to log
    func log(level: LogLevel, message: String, error: Error? = nil) {
        guard enabled else { return }

        let logType: OSLogType
        switch level {
        case .debug:
            logType = .debug
        case .info:
            logType = .info
        case .warning:
            logType = .default
        case .error:
            logType = .error
        case .fatal:
            logType = .fault
        }

        if let error = error {
            os_log("%{public}@: %{public}@", log: OSLog(subsystem: logTag, category: level.rawValue), type: logType, message, error.localizedDescription)
        } else {
            os_log("%{public}@", log: OSLog(subsystem: logTag, category: level.rawValue), type: logType, message)
        }
    }
}
