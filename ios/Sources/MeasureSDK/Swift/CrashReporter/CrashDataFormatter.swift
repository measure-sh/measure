//
//  CrashDataFormatter.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 17/09/24.
//

import Foundation

/// Formats a `CrashReport` into your `Exception` model.
final class CrashDataFormatter {
    private let crashReport: CrashReport
    private var isLp64 = true
    private var executableName: String?

    init(_ crashReport: CrashReport) {
        self.crashReport = crashReport

        if let name = Bundle.main.object(forInfoDictionaryKey: "CFBundleExecutable") as? String {
            self.executableName = name
        }

        var didSet = false
        if let images = crashReport.images {
            for image in images {
                guard let codeType = image.codeType,
                      codeType.typeEncoding == .mach else { continue }

                switch Int32(codeType.type) {
                case CPU_TYPE_ARM:      isLp64 = false; didSet = true
                case CPU_TYPE_ARM64:    isLp64 = true;  didSet = true
                case CPU_TYPE_X86:      isLp64 = false; didSet = true
                case CPU_TYPE_X86_64:   isLp64 = true;  didSet = true
                case CPU_TYPE_POWERPC:  isLp64 = false; didSet = true
                default: break
                }
                if didSet { break }
            }
        }

        if !didSet && crashReport.typeEncoding == .mach {
            switch Int32(crashReport.processorInfo) {
            case CPU_TYPE_ARM:      isLp64 = false
            case CPU_TYPE_ARM64:    isLp64 = true
            case CPU_TYPE_X86:      isLp64 = false
            case CPU_TYPE_X86_64:   isLp64 = true
            case CPU_TYPE_POWERPC:  isLp64 = false
            default:                isLp64 = true
            }
        }
    }

    func getException(_ handled: Bool = false, error: MsrError? = nil) -> Exception {
        let crashedThread  = getCrashedThread()
        let exceptionDetail = ExceptionDetail(
            type:           crashReport.exceptionName,
            message:        crashReport.exceptionReason,
            frames:         crashedThread?.frames,
            signal:         crashReport.signalName,
            threadName:     crashedThread?.name ?? "",
            threadSequence: crashedThread?.sequence ?? 0,
            osBuildNumber:  crashReport.osBuildNumber
        )

        guard let crashedThread = crashedThread, let threads = getExceptionStackTrace() else {
            return Exception(handled: handled,
                             exceptions: [exceptionDetail],
                             foreground: true,
                             threads: nil,
                             binaryImages: nil,
                             framework: Framework.apple,
                             error: error)
        }

        let binaryImages = getBinaryImageInfo([crashedThread] + threads)
        return Exception(handled: handled,
                         exceptions: [exceptionDetail],
                         foreground: true,
                         threads: threads,
                         binaryImages: binaryImages,
                         framework: Framework.apple,
                         error: error)
    }

    // MARK: - Private

    private func getCrashedThread() -> ThreadDetail? {
        crashReport.threads?.first(where: { $0.crashed }).map { getThreadData($0) }
    }

    private func getExceptionStackTrace() -> [ThreadDetail]? {
        guard let threads = crashReport.threads else { return nil }
        return threads.filter { !$0.crashed }.map { getThreadData($0) }
    }

    private func getThreadData(_ thread: CrashReportThreadInfo) -> ThreadDetail {
        let frames: [StackFrame] = thread.stackFrames.enumerated().map { idx, frame in
            formatStackFrame(
                frameInfo: frame,
                frameIndex: idx,
                lp64: isLp64,
                operatingSystem: crashReport.operatingSystem,
                imageInfo: crashReport.image(forAddress: frame.instructionPointer)
            )
        }
        let name = thread.crashed
            ? "Thread \(thread.threadNumber) Crashed"
            : "Thread \(thread.threadNumber)"
        return ThreadDetail(name: name, frames: frames, sequence: Number(thread.threadNumber))
    }

    private func formatStackFrame(frameInfo: CrashReportStackFrame,
                                  frameIndex: Int,
                                  lp64: Bool,
                                  operatingSystem: CrashReportOperatingSystem,
                                  imageInfo: CrashReportImage?) -> StackFrame {
        var baseAddress: UInt64 = 0
        var pcOffset: UInt64   = 0
        var imageName          = "???"
        var binaryAddress      = ""
        var offset             = "0"

        if let imageInfo = imageInfo {
            imageName   = (imageInfo.imageName as? NSString)?.lastPathComponent ?? "???"
            baseAddress = imageInfo.imageBaseAddress
            pcOffset    = frameInfo.instructionPointer - imageInfo.imageBaseAddress
        }

        if let symbolInfo = frameInfo.symbolInfo {
            var symbolName = symbolInfo.symbolName
            if let name = symbolName, name.hasPrefix("_"), name.count > 1 {
                switch operatingSystem {
                case .macOSX, .iPhoneOS, .iPhoneSimulator, .unknown:
                    symbolName = String(name.dropFirst())
                default:
                    break
                }
            }
            let symOffset = frameInfo.instructionPointer - symbolInfo.startAddress
            binaryAddress = symbolName ?? ""
            offset        = "\(symOffset)"
        } else {
            binaryAddress = String(format: "%llx", baseAddress)
            offset        = String(format: "%lld", pcOffset)
        }

        let formattedIP = String(format: "%0*llx", lp64 ? 16 : 8, frameInfo.instructionPointer)
        let execName    = self.executableName ?? ""

        return StackFrame(
            binaryName:         imageName,
            binaryAddress:      binaryAddress,
            offset:             Int(offset) ?? 0,
            frameIndex:         Number(frameIndex),
            symbolAddress:      formattedIP,
            inApp:              imageName == execName || imageName.contains(execName),
            className:          nil,
            methodName:         nil,
            fileName:           nil,
            lineNumber:         nil,
            columnNumber:       nil,
            moduleName:         nil,
            instructionAddress: nil
        )
    }

    private func getBinaryImageInfo(_ threads: [ThreadDetail]) -> [BinaryImage]? {
        guard let images = crashReport.images else { return nil }

        let relevantAddresses: Set<String> = Set(
            threads.flatMap { $0.frames.compactMap { $0.binaryAddress } }
        )

        var seen = Set<UInt64>()
        var binaryImages: [BinaryImage] = []

        for img in images {
            let base = img.imageBaseAddress
            guard !seen.contains(base) else { continue }
            seen.insert(base)

            let startAddress = String(format: "%llx", base)
            guard relevantAddresses.contains(startAddress) else { continue }

            let endAddress = String(format: "%llx", base + max(1, img.imageSize) - 1)
            let uuid       = img.hasImageUUID ? img.imageUUID ?? "uuid" : "uuid"
            let imageName  = (img.imageName as? NSString)?.lastPathComponent ?? "???"
            let path       = img.imageName ?? "path"
            let arch       = resolveArch(codeType: img.codeType)
            let execName   = self.executableName ?? ""

            binaryImages.append(BinaryImage(
                startAddress: startAddress,
                endAddress:   endAddress,
                baseAddress:  nil,
                system:       imageName != execName,
                name:         imageName,
                arch:         arch,
                uuid:         uuid,
                path:         path
            ))
        }

        return binaryImages.isEmpty ? nil : binaryImages
    }

    private func resolveArch(codeType: CrashReportCodeType?) -> String {
        guard let ct = codeType, ct.typeEncoding == .mach else { return "???" }
        let subtype = Int32(ct.subtype & ~UInt64(CPU_SUBTYPE_MASK))
        switch Int32(ct.type) {
        case CPU_TYPE_ARM:
            switch subtype {
            case CPU_SUBTYPE_ARM_V6:  return "armv6"
            case CPU_SUBTYPE_ARM_V7:  return "armv7"
            case CPU_SUBTYPE_ARM_V7S: return "armv7s"
            default:                  return "arm-unknown"
            }
        case CPU_TYPE_ARM64:
            switch subtype {
            case CPU_SUBTYPE_ARM64_ALL: return "arm64"
            case CPU_SUBTYPE_ARM64_V8:  return "armv8"
            case CPU_SUBTYPE_ARM64E:    return "arm64e"
            default:                    return "arm64-unknown"
            }
        case CPU_TYPE_X86:    return "i386"
        case CPU_TYPE_X86_64: return "x86_64"
        case CPU_TYPE_POWERPC: return "powerpc"
        default:              return "???"
        }
    }
}
