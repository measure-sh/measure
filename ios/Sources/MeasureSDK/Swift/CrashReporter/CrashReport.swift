//
//  CrashReport.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 20/09/24.
//

import Foundation

enum CrashReportProcessorTypeEncoding: UInt32 {
    case unknown = 0
    case mach = 1
}

enum CrashReportOperatingSystem: UInt32 {
    case macOSX = 0
    case iPhoneOS = 1
    case iPhoneSimulator = 2
    case unknown = 3
    case appleTVOS = 4
}

// MARK: - Neutral types (replacing PLCrash-specific types)

struct CrashReportImage {
    let imageBaseAddress: UInt64
    let imageSize: UInt64
    let imageName: String?
    let imageUUID: String?
    let hasImageUUID: Bool
    let codeType: CrashReportCodeType?
}

struct CrashReportCodeType {
    let type: UInt64
    let subtype: UInt64
    let typeEncoding: CrashReportProcessorTypeEncoding
}

struct CrashReportStackFrame {
    let instructionPointer: UInt64
    let symbolInfo: CrashReportSymbolInfo?
}

struct CrashReportSymbolInfo {
    let symbolName: String?
    let startAddress: UInt64
}

struct CrashReportThreadInfo {
    let threadNumber: Int
    let crashed: Bool
    let stackFrames: [CrashReportStackFrame]
}

protocol CrashReport {
    var images: [CrashReportImage]? { get }
    var typeEncoding: CrashReportProcessorTypeEncoding { get }
    var processorInfo: UInt64 { get }
    var exceptionName: String { get }
    var exceptionReason: String { get }
    var signalName: String { get }
    var osBuildNumber: String { get }
    var threads: [CrashReportThreadInfo]? { get }
    var operatingSystem: CrashReportOperatingSystem { get }
    func image(forAddress address: UInt64) -> CrashReportImage?
}

// MARK: - KSCrash implementation

/// Wraps a raw KSCrash report dictionary `[String: Any]` and exposes it
/// through the `CrashReport` protocol so `CrashDataFormatter` needs no changes.
final class BaseCrashReport: CrashReport {
    private let report: [String: Any]

    // KSCrash report top-level keys
    private var binaryImages: [[String: Any]] { report["binary_images"] as? [[String: Any]] ?? [] }
    private var systemDict: [String: Any] { report["system"] as? [String: Any] ?? [:] }
    private var crashDict: [String: Any] { report["crash"] as? [String: Any] ?? [:] }
    private var errorDict: [String: Any] { crashDict["error"] as? [String: Any] ?? [:] }
    private var threadDicts: [[String: Any]] { report["threads"] as? [[String: Any]] ?? [] }

    init(_ report: [String: Any]) {
        self.report = report
    }

    var images: [CrashReportImage]? {
        let imgs = binaryImages.map { img -> CrashReportImage in
            let baseAddr = img["image_addr"] as? UInt64 ?? 0
            let size     = img["image_size"] as? UInt64 ?? 0
            let name     = img["name"]       as? String
            let uuid     = img["uuid"]       as? String
            let codeType = parseCodeType(img)
            return CrashReportImage(
                imageBaseAddress: baseAddr,
                imageSize: size,
                imageName: name,
                imageUUID: uuid,
                hasImageUUID: uuid != nil,
                codeType: codeType
            )
        }
        return imgs.isEmpty ? nil : imgs
    }

    var typeEncoding: CrashReportProcessorTypeEncoding {
        // KSCrash always uses Mach on Apple platforms
        return .mach
    }

    var processorInfo: UInt64 {
        // Derive from first binary image cpu_type if available
        guard let first = binaryImages.first,
              let cpuType = first["cpu_type"] as? UInt64 else { return 0 }
        return cpuType
    }

    var exceptionName: String {
        // Try NSException first, then mach exception name, then signal name
        if let ns = errorDict["nsexception"] as? [String: Any],
           let name = ns["name"] as? String { return name }
        if let mach = errorDict["mach"] as? [String: Any],
           let name = mach["exception_name"] as? String { return name }
        if let sig = errorDict["signal"] as? [String: Any],
           let name = sig["name"] as? String { return name }
        return ""
    }

    var exceptionReason: String {
        if let ns = errorDict["nsexception"] as? [String: Any],
           let reason = ns["reason"] as? String { return reason }
        if let cpp = errorDict["cpp_exception"] as? [String: Any],
           let reason = cpp["reason"] as? String { return reason }
        return errorDict["reason"] as? String ?? ""
    }

    var signalName: String {
        return (errorDict["signal"] as? [String: Any])?["name"] as? String ?? ""
    }

    var osBuildNumber: String {
        return systemDict["os_version"] as? String ?? ""
    }

    var operatingSystem: CrashReportOperatingSystem {
        // KSCrash always runs on Apple platforms; distinguish simulator via system info
        let platform = systemDict["system_name"] as? String ?? ""
        if platform.contains("Mac") { return .macOSX }
        if platform.contains("Simulator") { return .iPhoneSimulator }
        if platform.contains("tvOS") { return .appleTVOS }
        return .iPhoneOS
    }

    var threads: [CrashReportThreadInfo]? {
        let result = threadDicts.map { parseThread($0) }
        return result.isEmpty ? nil : result
    }

    func image(forAddress address: UInt64) -> CrashReportImage? {
        return images?.first { img in
            address >= img.imageBaseAddress &&
            address < img.imageBaseAddress + max(1, img.imageSize)
        }
    }

    private func parseThread(_ dict: [String: Any]) -> CrashReportThreadInfo {
        let index   = dict["index"]   as? Int ?? 0
        let crashed = dict["crashed"] as? Bool ?? false

        let contents = (dict["backtrace"] as? [String: Any])?["contents"] as? [[String: Any]] ?? []
        let frames: [CrashReportStackFrame] = contents.map { frame in
            let instrAddr = frame["instruction_addr"] as? UInt64 ?? 0
            let symAddr   = frame["symbol_addr"]      as? UInt64
            let symName   = frame["symbol_name"]      as? String
            let symbolInfo: CrashReportSymbolInfo? = symAddr.map {
                CrashReportSymbolInfo(symbolName: symName, startAddress: $0)
            }
            return CrashReportStackFrame(instructionPointer: instrAddr, symbolInfo: symbolInfo)
        }

        return CrashReportThreadInfo(threadNumber: index, crashed: crashed, stackFrames: frames)
    }

    private func parseCodeType(_ img: [String: Any]) -> CrashReportCodeType? {
        guard let cpuType = img["cpu_type"] as? UInt64 else { return nil }
        let cpuSubtype = img["cpu_subtype"] as? UInt64 ?? 0
        return CrashReportCodeType(type: cpuType, subtype: cpuSubtype, typeEncoding: .mach)
    }
}
