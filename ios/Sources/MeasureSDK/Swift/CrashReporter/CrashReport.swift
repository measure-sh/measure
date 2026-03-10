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
    let objectName: String?
    let objectAddr: UInt64?
    let symbolName: String?
    let symbolAddr: UInt64?
}

struct CrashReportThreadInfo {
    let threadNumber: Int
    let threadName: String?
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

final class BaseCrashReport: CrashReport {
    private let report: [String: Any]

    private var crashDict: [String: Any]    { report["crash"]         as? [String: Any]   ?? [:] }
    private var errorDict: [String: Any]    { crashDict["error"]      as? [String: Any]   ?? [:] }
    private var threadDicts: [[String: Any]]{ crashDict["threads"]    as? [[String: Any]] ?? [] }
    private var binaryImages: [[String: Any]]{ report["binary_images"] as? [[String: Any]] ?? [] }
    private var systemDict: [String: Any]   { report["system"]        as? [String: Any]   ?? [:] }

    init(_ report: [String: Any]) {
        self.report = report
    }

    var images: [CrashReportImage]? {
        let imgs = binaryImages.map { img -> CrashReportImage in
            CrashReportImage(
                imageBaseAddress: img["image_addr"] as? UInt64 ?? 0,
                imageSize:        img["image_size"] as? UInt64 ?? 0,
                imageName:        img["name"]       as? String,
                imageUUID:        img["uuid"]       as? String,
                hasImageUUID:     img["uuid"]       != nil,
                codeType:         parseCodeType(img)
            )
        }
        return imgs.isEmpty ? nil : imgs
    }

    var typeEncoding: CrashReportProcessorTypeEncoding { .mach }

    var processorInfo: UInt64 {
        (binaryImages.first?["cpu_type"] as? UInt64) ?? 0
    }

    var exceptionName: String {
        if let ns   = errorDict["nsexception"]   as? [String: Any], let n = ns["name"]            as? String { return n }
        if let mach = errorDict["mach"]          as? [String: Any], let n = mach["exception_name"] as? String { return n }
        if let sig  = errorDict["signal"]        as? [String: Any], let n = sig["name"]            as? String { return n }
        return ""
    }

    var exceptionReason: String {
        if let ns  = errorDict["nsexception"]  as? [String: Any], let r = ns["reason"]  as? String { return r }
        if let cpp = errorDict["cpp_exception"] as? [String: Any], let r = cpp["reason"] as? String { return r }
        if let mach = errorDict["mach"] as? [String: Any],
           let codeName = mach["code_name"] as? String {
            let subcode = (mach["subcode"] as? Int).map { ", subcode: \($0)" } ?? ""
            return codeName + subcode
        }
        return errorDict["reason"] as? String ?? ""
    }

    var signalName: String {
        (errorDict["signal"] as? [String: Any])?["name"] as? String ?? ""
    }

    var osBuildNumber: String {
        systemDict["os_version"] as? String ?? ""
    }

    var operatingSystem: CrashReportOperatingSystem {
        let platform = systemDict["system_name"] as? String ?? ""
        if platform.contains("Mac")       { return .macOSX }
        if platform.contains("Simulator") { return .iPhoneSimulator }
        if platform.contains("tvOS")      { return .appleTVOS }
        return .iPhoneOS
    }

    var threads: [CrashReportThreadInfo]? {
        let result = threadDicts.map { parseThread($0) }
        return result.isEmpty ? nil : result
    }

    func image(forAddress address: UInt64) -> CrashReportImage? {
        images?.first {
            address >= $0.imageBaseAddress &&
            address <  $0.imageBaseAddress + max(1, $0.imageSize)
        }
    }

    private func parseThread(_ dict: [String: Any]) -> CrashReportThreadInfo {
        let index   = dict["index"]   as? Int  ?? 0
        let crashed = dict["crashed"] as? Bool ?? (dict["crashed"] as? Int == 1)
        let name    = dict["name"]    as? String

        let contents = (dict["backtrace"] as? [String: Any])?["contents"] as? [[String: Any]] ?? []
        let frames: [CrashReportStackFrame] = contents.map { frame in
            CrashReportStackFrame(
                instructionPointer: frame["instruction_addr"] as? UInt64 ?? 0,
                objectName:         frame["object_name"]      as? String,
                objectAddr:         frame["object_addr"]      as? UInt64,
                symbolName:         frame["symbol_name"]      as? String,
                symbolAddr:         frame["symbol_addr"]      as? UInt64
            )
        }
        return CrashReportThreadInfo(threadNumber: index, threadName: name, crashed: crashed, stackFrames: frames)
    }

    private func parseCodeType(_ img: [String: Any]) -> CrashReportCodeType? {
        guard let cpuType = img["cpu_type"] as? UInt64 else { return nil }
        return CrashReportCodeType(
            type:         cpuType,
            subtype:      img["cpu_subtype"] as? UInt64 ?? 0,
            typeEncoding: .mach
        )
    }
}
