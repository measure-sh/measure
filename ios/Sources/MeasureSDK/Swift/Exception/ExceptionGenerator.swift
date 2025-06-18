//
//  ExceptionGenerator.swift
//  Measure
//
//  Created by Adwin Ross on 10/06/25.
//

import Foundation
import CrashReporter

protocol ExceptionGenerator {
    func generate(_ error: NSError, collectStackTraces: Bool) -> Exception?
}

final class BaseExceptionGenerator: ExceptionGenerator {
    private let crashReporter: SystemCrashReporter
    private let logger: Logger

    init(crashReporter: SystemCrashReporter, logger: Logger) {
        self.crashReporter = crashReporter
        self.logger = logger
    }

    func generate(_ error: NSError, collectStackTraces: Bool) -> Exception? {
        return generateCurrentStacktrace(error)
    }

    private func generateCurrentStacktrace(_ nsError: NSError) -> Exception? {
        do {
            let crashData = crashReporter.generateLiveReport()
            let plCrashReport = try PLCrashReport(data: crashData)
            let crashReport = BaseCrashReport(plCrashReport)
            let crashDataFormatter = CrashDataFormatter(crashReport)
            let error = MsrError(numcode: Int64(nsError.code),
                                 code: nsError.domain,
                                 meta: convertToCodableValue(nsError.userInfo))
            return crashDataFormatter.getException(true, error: error)
        } catch {
            logger.internalLog(level: .error, message: "Error parsing crash report.", error: nil, data: nil)
            return nil
        }
    }

    private func convertToCodableValue(_ dictionary: [String: Any]) -> [String: CodableValue] {
        var result: [String: CodableValue] = [:]

        for (key, value) in dictionary {
            switch value {
            case let value as String:
                result[key] = .string(value)
            case let value as Int64:
                result[key] = .int(value)
            case let value as Double:
                result[key] = .double(value)
            case let value as Bool:
                result[key] = .bool(value)
            case let value as [Any]:
                result[key] = .array(value.compactMap { any in
                    // Recursively convert array items
                    if let str = any as? String { return .string(str) }
                    if let int = any as? Int { return .int(Int64(int)) }
                    if let dbl = any as? Double { return .double(dbl) }
                    if let bool = any as? Bool { return .bool(bool) }
                    return nil
                })
            case let value as [String: Any]:
                result[key] = .dictionary(convertToCodableValue(value))
            default:
                result[key] = .null
            }
        }

        return result
    }
}
