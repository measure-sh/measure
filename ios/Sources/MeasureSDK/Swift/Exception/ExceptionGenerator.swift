//
//  ExceptionGenerator.swift
//  Measure
//
//  Created by Adwin Ross on 10/06/25.
//

import KSCrash
import Foundation

protocol ExceptionGenerator {
    func generate(_ error: NSError, collectStackTraces: Bool) -> Exception?
}

final class BaseExceptionGenerator: ExceptionGenerator {
    private let logger: Logger
    private let crashDataPersistence: CrashDataPersistence

    init(logger: Logger, crashDataPersistence: CrashDataPersistence) {
        self.logger = logger
        self.crashDataPersistence = crashDataPersistence
    }

    func generate(_ error: NSError, collectStackTraces: Bool) -> Exception? {
        return generateException(error, collectStackTraces: collectStackTraces)
    }

    private func generateException(_ nsError: NSError, collectStackTraces: Bool) -> Exception? {
        let nsException = NSException(name: NSExceptionName(rawValue: nsError.domain),
                                    reason: nsError.localizedDescription,
                                    userInfo: nsError.userInfo)
        KSCrash.shared.report(nsException, logAllThreads: collectStackTraces)

        guard let store = KSCrash.shared.reportStore,
              let reportID = store.reportIDs.last,
              let report = store.report(for: Int64(truncating: reportID)) else {
            logger.internalLog(level: .error, message: "ExceptionGenerator: Failed to load live KSCrash report.", error: nil, data: nil)
            return nil
        }

        let dict = report.value
        let msrError = MsrError(numcode: Int64(nsError.code),
                                code: nsError.domain,
                                meta: convertToCodableValue(nsError.userInfo))

        let crashReport = BaseCrashReport(dict)
        let formatter = CrashDataFormatter(crashReport)
        let exception = formatter.getException(true, error: msrError)

        store.deleteReport(with: Int64(truncating: reportID))
        crashDataPersistence.clearCrashData()

        return exception
    }

    private func convertToCodableValue(_ dictionary: [String: Any]) -> [String: CodableValue] { // swiftlint:disable:this cyclomatic_complexity
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
