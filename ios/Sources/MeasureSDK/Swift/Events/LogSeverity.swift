//
//  LogSeverity.swift
//  Measure
//
//  Created by Abhay Sood on 11/06/26.
//

import Foundation

/// Severity of a log tracked using `Measure.log`.
@objc public enum LogSeverity: Int {
    case debug
    case info
    case warning
    case error
    case fatal

    var severityText: String {
        switch self {
        case .debug:
            return "debug"
        case .info:
            return "info"
        case .warning:
            return "warning"
        case .error:
            return "error"
        case .fatal:
            return "fatal"
        }
    }

    /// Numeric severity used to order and filter logs. Each level maps to the
    /// highest number in its severity band.
    var severityNumber: Int {
        switch self {
        case .debug:
            return 8
        case .info:
            return 12
        case .warning:
            return 16
        case .error:
            return 20
        case .fatal:
            return 24
        }
    }
}
