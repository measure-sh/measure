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

        // Derive LP64 from binary images, fall back to processorInfo
        var didSet = false
        if let images = crashReport.images {
            for image in images {
                guard let ct = image.codeType, ct.typeEncoding == .mach else { continue }
                switch Int32(ct.type) {
                case CPU_TYPE_ARM:     isLp64 = false; didSet = true
                case CPU_TYPE_ARM64:   isLp64 = true;  didSet = true
                case CPU_TYPE_X86:     isLp64 = false; didSet = true
                case CPU_TYPE_X86_64:  isLp64 = true;  didSet = true
                case CPU_TYPE_POWERPC: isLp64 = false; didSet = true
                default: break
                }
                if didSet { break }
            }
        }
        if !didSet && crashReport.typeEncoding == .mach {
            switch Int32(crashReport.processorInfo) {
            case CPU_TYPE_ARM:     isLp64 = false
            case CPU_TYPE_ARM64:   isLp64 = true
            case CPU_TYPE_X86:     isLp64 = false
            case CPU_TYPE_X86_64:  isLp64 = true
            case CPU_TYPE_POWERPC: isLp64 = false
            default:               isLp64 = true
            }
        }
    }

    func getException(_ handled: Bool = false, error: MsrError? = nil) -> Exception {
        let crashedThread = getCrashedThread()
        let exceptionDetail = ExceptionDetail(
            type: crashReport.exceptionName,
            message: crashReport.exceptionReason,
            frames: crashedThread?.frames,
            signal: crashReport.signalName,
            threadName: crashedThread?.name,
            threadSequence: crashedThread?.sequence ?? 0,
            osBuildNumber: crashReport.osBuildNumber
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

    private func getCrashedThread() -> ThreadDetail? {
        crashReport.threads?.first(where: { $0.crashed }).map { getThreadData($0) }
    }

    private func getExceptionStackTrace() -> [ThreadDetail]? {
        guard let threads = crashReport.threads else { return nil }
        return threads.filter { !$0.crashed }.map { getThreadData($0) }
    }

    private func getThreadData(_ thread: CrashReportThreadInfo) -> ThreadDetail {
        let frames = thread.stackFrames.enumerated().map { idx, frame in
            formatStackFrame(frame: frame, frameIndex: idx)
        }
        // Use thread name from report if available, otherwise generate one
        let name = thread.threadName
            ?? (thread.crashed ? "Thread \(thread.threadNumber) Crashed" : "Thread \(thread.threadNumber)")
        return ThreadDetail(name: name, frames: frames, sequence: Number(thread.threadNumber))
    }

    private func formatStackFrame(frame: CrashReportStackFrame, frameIndex: Int) -> StackFrame {
        let instrAddr = frame.instructionPointer
        let symAddr   = frame.symbolAddr
        let objAddr   = frame.objectAddr

        // offset = instruction_addr - symbol_addr (same as POC)
        let offset: Int? = (instrAddr > 0 && symAddr != nil)
            ? Int(instrAddr - symAddr!)
            : nil

        let isInApp = isAppBinary(name: frame.objectName)

        return StackFrame(
            binaryName:         frame.objectName,
            binaryAddress:      objAddr.map    { hexString($0) },
            offset:             offset,
            frameIndex:         Number(frameIndex),
            symbolAddress:      symAddr.map    { hexString($0) },
            inApp:              isInApp,
            className:          nil,
            methodName:         frame.symbolName,
            fileName:           nil,
            lineNumber:         nil,
            columnNumber:       nil,
            moduleName:         frame.objectName,
            instructionAddress: instrAddr > 0 ? hexString(instrAddr) : nil
        )
    }

    private func getBinaryImageInfo(_ threads: [ThreadDetail]) -> [BinaryImage]? {
        guard let images = crashReport.images else { return nil }

        // Collect object addresses from frames to filter relevant images
        let relevantAddresses: Set<String> = Set(
            threads.flatMap { $0.frames.compactMap { $0.binaryAddress } }
        )

        var seen = Set<UInt64>()
        var binaryImages: [BinaryImage] = []

        for img in images {
            let base = img.imageBaseAddress
            guard !seen.contains(base) else { continue }
            seen.insert(base)

            let startHex = hexString(base)
            guard relevantAddresses.contains(startHex) else { continue }

            let endAddr  = base + max(1, img.imageSize)
            let uuid     = img.hasImageUUID ? img.imageUUID ?? "uuid" : "uuid"
            let fullPath = img.imageName ?? ""
            let shortName = URL(fileURLWithPath: fullPath).lastPathComponent

            binaryImages.append(BinaryImage(
                startAddress: startHex,
                endAddress:   hexString(endAddr),
                baseAddress:  startHex,
                system:       !isAppBinary(name: shortName),
                name:         shortName,
                arch:         resolveArch(codeType: img.codeType),
                uuid:         uuid,
                path:         fullPath
            ))
        }

        return binaryImages.isEmpty ? nil : binaryImages
    }

    // MARK: - Helpers

    private func isAppBinary(name: String?) -> Bool {
        guard let n = name else { return false }
        let short = URL(fileURLWithPath: n).lastPathComponent
        let exec  = executableName ?? ""
        return short == exec
            || short.hasSuffix(".debug.dylib")
            || (!exec.isEmpty && short.contains(exec))
    }

    private func hexString(_ value: UInt64) -> String {
        String(format: "0x%016llx", value)
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
        case CPU_TYPE_X86:     return "i386"
        case CPU_TYPE_X86_64:  return "x86_64"
        case CPU_TYPE_POWERPC: return "powerpc"
        default:               return "???"
        }
    }
}
