//
//  CrashDataFormatter.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 17/09/24.
//

import Foundation

/// Formats a `CrashReport` into `Exception` model.
final class CrashDataFormatter {
    private let report: [String: Any]
    private var isLp64 = true
    private var executableName: String?

    private var crashDict: [String: Any]     { report["crash"]          as? [String: Any]    ?? [:] }
    private var errorDict: [String: Any]     { crashDict["error"]       as? [String: Any]    ?? [:] }
    private var threadDicts: [[String: Any]] { crashDict["threads"]     as? [[String: Any]]  ?? [] }
    private var binaryImageDicts: [[String: Any]] { report["binary_images"] as? [[String: Any]] ?? [] }
    private var systemDict: [String: Any]    { report["system"]         as? [String: Any]    ?? [:] }

    init(_ report: [String: Any]) {
        self.report = report
        self.executableName = Bundle.main.object(forInfoDictionaryKey: "CFBundleExecutable") as? String
        self.isLp64 = resolveIsLp64(binaryImageDicts: binaryImageDicts)
    }

    func getException(_ handled: Bool = false, error: MsrError? = nil) -> Exception {
        let crashedThreadDict = threadDicts.first { $0["crashed"] as? Bool == true || $0["crashed"] as? Int == 1 }
        let otherThreadDicts  = threadDicts.filter { $0["crashed"] as? Bool != true && $0["crashed"] as? Int != 1 }

        let crashedThread   = crashedThreadDict.map { parseThread($0) }
        let exceptionDetail = parseExceptionDetail(crashedThread: crashedThread)
        let otherThreads    = otherThreadDicts.map { parseThread($0) }

        guard let crashedThread else {
            return Exception(handled: handled,
                             exceptions: [exceptionDetail],
                             foreground: parseForeground(),
                             threads: nil,
                             binaryImages: nil,
                             framework: Framework.apple,
                             error: error)
        }

        let allThreads   = [crashedThread] + otherThreads
        let binaryImages = parseBinaryImages(threads: allThreads)

        return Exception(handled: handled,
                         exceptions: [exceptionDetail],
                         foreground: parseForeground(),
                         threads: otherThreads,
                         binaryImages: binaryImages,
                         framework: Framework.apple,
                         error: error)
    }

    func parseExceptionDetail(crashedThread: ThreadDetail?) -> ExceptionDetail {
        return ExceptionDetail(
            type:           parseExceptionName(),
            message:        parseExceptionReason(),
            frames:         crashedThread?.frames,
            signal:         parseSignalName(),
            threadName:     crashedThread?.name,
            threadSequence: crashedThread?.sequence ?? 0,
            osBuildNumber:  parseOsBuildNumber()
        )
    }

    func parseExceptionName() -> String {
        if let ns   = errorDict["nsexception"]   as? [String: Any], let n = ns["name"]             as? String { return n }
        if let mach = errorDict["mach"]          as? [String: Any], let n = mach["exception_name"] as? String { return n }
        if let sig  = errorDict["signal"]        as? [String: Any], let n = sig["name"]            as? String { return n }
        return ""
    }

    func parseExceptionReason() -> String {
        if let ns  = errorDict["nsexception"]   as? [String: Any], let r = ns["reason"]   as? String { return r }
        if let cpp = errorDict["cpp_exception"] as? [String: Any], let r = cpp["reason"]  as? String { return r }
        if let mach = errorDict["mach"] as? [String: Any], let codeName = mach["code_name"] as? String {
            let subcode = (mach["subcode"] as? Int).map { ", subcode: \($0)" } ?? ""
            return codeName + subcode
        }
        return errorDict["reason"] as? String ?? ""
    }

    func parseSignalName() -> String {
        return (errorDict["signal"] as? [String: Any])?["name"] as? String ?? ""
    }

    func parseOsBuildNumber() -> String {
        return systemDict["os_version"] as? String ?? ""
    }

    func parseForeground() -> Bool? {
        guard let stats = systemDict["application_stats"] as? [String: Any] else { return nil }
        return stats["application_in_foreground"] as? Bool
            ?? (stats["application_in_foreground"] as? Int).map { $0 != 0 }
    }

    func parseThread(_ dict: [String: Any]) -> ThreadDetail {
        let index   = dict["index"]   as? Int  ?? 0
        let crashed = dict["crashed"] as? Bool ?? (dict["crashed"] as? Int == 1)
        let name    = dict["name"]    as? String
                   ?? (crashed ? "Thread \(index) Crashed" : "Thread \(index)")
        let frames  = parseFrames(dict)
        return ThreadDetail(name: name, frames: frames, sequence: Number(index))
    }

    func parseFrames(_ threadDict: [String: Any]) -> [StackFrame] {
        guard
            let bt       = threadDict["backtrace"] as? [String: Any],
            let contents = bt["contents"]          as? [[String: Any]]
        else { return [] }

        return contents.enumerated().map { idx, frame in
            parseFrame(frame, index: idx)
        }
    }

    func parseFrame(_ frame: [String: Any], index: Int) -> StackFrame {
        let instrAddr = frame["instruction_addr"] as? UInt64
        let objAddr   = frame["object_addr"]      as? UInt64
        let symAddr   = frame["symbol_addr"]      as? UInt64
        let objName   = frame["object_name"]      as? String
        let offset: Int? = (instrAddr != nil && symAddr != nil)
                ? Int(instrAddr! - symAddr!)
                : nil

        return StackFrame(binaryName: objName,
                          binaryAddress: objAddr.map { hexString($0) },
                          offset: offset,
                          frameIndex: Number(index),
                          symbolAddress: instrAddr.map {hexString($0)},
                          inApp: isAppBinary(name: objName),
                          className: nil,
                          methodName: nil,
                          fileName: nil,
                          lineNumber: nil,
                          columnNumber: nil,
                          moduleName: nil,
                          instructionAddress: nil)
    }

    func parseBinaryImages(threads: [ThreadDetail]) -> [BinaryImage]? {
        let relevantAddresses: Set<String> = Set(
            threads.flatMap { $0.frames.compactMap { $0.binaryAddress } }
        )

        var seen = Set<UInt64>()
        var result: [BinaryImage] = []

        for img in binaryImageDicts {
            guard let base = img["image_addr"] as? UInt64, !seen.contains(base) else { continue }
            seen.insert(base)

            let startHex = hexString(base)
            guard relevantAddresses.contains(startHex) else { continue }

            let size      = img["image_size"] as? UInt64 ?? 0
            let uuid      = parseUUID(img)
            let fullPath  = img["name"] as? String ?? ""
            let shortName = URL(fileURLWithPath: fullPath).lastPathComponent

            result.append(BinaryImage(startAddress: startHex,
                                      endAddress: hexString(base + max(1, size)),
                                      baseAddress: nil,
                                      system: !isAppBinary(name: shortName),
                                      name: shortName,
                                      arch: resolveArch(img),
                                      uuid: uuid,
                                      path: fullPath))
        }

        return result.isEmpty ? nil : result
    }

    func parseUUID(_ img: [String: Any]) -> String {
        return (img["uuid"] as? String)?
            .replacingOccurrences(of: "-", with: "")
            .lowercased() ?? "uuid"
    }

    func resolveIsLp64(binaryImageDicts: [[String: Any]]) -> Bool {
        for img in binaryImageDicts {
            guard let cpuType = img["cpu_type"] as? UInt64 else { continue }
            switch Int32(cpuType) {
            case CPU_TYPE_ARM:     return false
            case CPU_TYPE_ARM64:   return true
            case CPU_TYPE_X86:     return false
            case CPU_TYPE_X86_64:  return true
            case CPU_TYPE_POWERPC: return false
            default: continue
            }
        }
        return true // default to 64-bit
    }

    func resolveArch(_ img: [String: Any]) -> String {
        guard let cpuType = img["cpu_type"] as? UInt64 else { return "???" }
        let cpuSubtype = Int32((img["cpu_subtype"] as? UInt64 ?? 0) & ~UInt64(CPU_SUBTYPE_MASK))
        switch Int32(cpuType) {
        case CPU_TYPE_ARM:
            switch cpuSubtype {
            case CPU_SUBTYPE_ARM_V6:  return "armv6"
            case CPU_SUBTYPE_ARM_V7:  return "armv7"
            case CPU_SUBTYPE_ARM_V7S: return "armv7s"
            default:                  return "arm-unknown"
            }
        case CPU_TYPE_ARM64:
            switch cpuSubtype {
            case CPU_SUBTYPE_ARM64_ALL: return "arm64"
            case CPU_SUBTYPE_ARM64_V8:  return "armv8"
            case CPU_SUBTYPE_ARM64E:    return "arm64e"
            default:                    return "arm64-unknown"
            }
        case CPU_TYPE_X86:     return "i386"
        case CPU_TYPE_X86_64:  return "x86_64"
        case CPU_TYPE_POWERPC: return "powerpc"
        default:               return "???"
        }
    }

    private func isAppBinary(name: String?) -> Bool {
        guard let n = name else { return false }
        let short = URL(fileURLWithPath: n).lastPathComponent
        let exec  = executableName ?? ""
        return short == exec
            || short.hasSuffix(".debug.dylib")
            || (!exec.isEmpty && short.contains(exec))
    }

    private func hexString(_ value: UInt64) -> String {
        String(format: "%016llx", value)
    }
}
