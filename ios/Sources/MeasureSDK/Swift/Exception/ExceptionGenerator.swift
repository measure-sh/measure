//
//  ExceptionGenerator.swift
//  Measure
//
//  Created by Adwin Ross on 10/06/25.
//

#if canImport(KSCrashRecording)
import KSCrashRecording
#elseif canImport(KSCrash)
import KSCrash
#endif
import Foundation

/// Generates an `Exception` from a handled error or exception by triggering a KSCrash live report
/// and parsing the resulting stack trace.
///
/// `framesToStrip` controls how many frames are removed from the top of the crashed thread's stack
/// before the exception is reported. This is necessary because the SDK's own call stack (e.g.
/// `generateException`, `generate`, `trackError`) always appears at the top of the trace and is
/// not useful to the caller.
///
/// The correct value depends on the call path:
/// - Swift `trackError(_:Error)`      → 3
/// - ObjC  `trackError(_:NSError)`    → 4  (one extra frame for the `@objc` bridge)
/// - Swift `trackException`           → 3
/// - ObjC  `trackException`           → 4  (one extra frame for the `@objc` bridge)
///
/// If the Measure SDK is present as a dynamic framework (i.e. "Measure" or "Measure.dylib" appears
/// in the crash report's binary images), stripping is skipped entirely.
protocol ExceptionGenerator {
    func generate(_ error: NSError, framesToStrip: Int) -> Exception?
    func generate(_ exception: NSException, framesToStrip: Int) -> Exception?
}

final class BaseExceptionGenerator: ExceptionGenerator {
    private let logger: Logger
    private let crashDataPersistence: CrashDataPersistence
    private let sysCtl: SysCtl

    init(logger: Logger, crashDataPersistence: CrashDataPersistence, sysCtl: SysCtl) {
        self.logger = logger
        self.crashDataPersistence = crashDataPersistence
        self.sysCtl = sysCtl
    }

    func generate(_ error: NSError, framesToStrip: Int) -> Exception? {
        let nsException = NSException(name: NSExceptionName(rawValue: error.domain),
                                      reason: error.localizedDescription,
                                      userInfo: error.userInfo)
        return generateException(nsException,
                                 numCode: Int64(error.code),
                                 code: error.domain,
                                 meta: convertToCodableValue(error.userInfo),
                                 framesToStrip: framesToStrip)
    }

    func generate(_ exception: NSException, framesToStrip: Int) -> Exception? {
        let userInfo = exception.userInfo?.reduce(into: [String: Any]()) { result, pair in
            if let key = pair.key as? String {
                result[key] = pair.value
            }
        }
        return generateException(exception,
                                 numCode: nil,
                                 code: "\(exception.name.rawValue), \(exception.reason ?? "")",
                                 meta: userInfo.map { convertToCodableValue($0) },
                                 framesToStrip: framesToStrip)
    }

    private func generateException(_ exception: NSException,
                                   numCode: Int64?,
                                   code: String?,
                                   meta: [String: CodableValue]?,
                                   framesToStrip: Int) -> Exception? {
        KSCrash.shared.report(exception, logAllThreads: true)

        guard let store = KSCrash.shared.reportStore,
              let reportID = store.reportIDs.last,
              let report = store.report(for: Int64(truncating: reportID)) else {
            logger.internalLog(level: .error, message: "ExceptionGenerator: Failed to load live KSCrash report.", error: nil, data: nil)
            return nil
        }

        let formatter = CrashDataFormatter(report.value, sysCtl: sysCtl)
        var result = formatter.getException(severity: .handled, numCode: numCode, code: code, meta: meta, framesToStrip: framesToStrip)
        result.foreground = crashDataPersistence.isForeground
        store.deleteReport(with: Int64(truncating: reportID))
        crashDataPersistence.clearCrashData()

        return result
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
