//
//  CrashDataFormatter.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 17/09/24.
//

import Foundation
import CrashReporter

/// A class responsible for formatting crash report data for further processing or reporting.
///
/// `CrashDataFormatter` takes a `CrashReport` and provides utilities to format the crash data
/// into a desired `Exception` format.
final class CrashDataFormatter {
    private let crashReport: CrashReport
    // Mark whether architecture is LP64 (64-bit)
    private var isLp64 = true
    private var executableName: String?

    init(_ crashReport: CrashReport) { // swiftlint:disable:this cyclomatic_complexity
        self.crashReport = crashReport
        var didSet = false
        if let executableName = Bundle.main.object(forInfoDictionaryKey: "CFBundleExecutable") as? String {
            self.executableName = executableName
        }

        if let images = crashReport.images {
            // Attempt to derive the code type from the binary images
            for image in images {
                // Skip images with no specified type
                guard let imageCodeType = image.codeType else { continue }

                // Skip unknown encodings
                guard imageCodeType.typeEncoding.rawValue == CrashReportProcessorTypeEncoding.mach.rawValue else { continue }

                switch Int32(imageCodeType.type) {
                case CPU_TYPE_ARM:
                    isLp64 = false
                    didSet = true
                case CPU_TYPE_ARM64:
                    isLp64 = true
                    didSet = true
                case CPU_TYPE_X86:
                    isLp64 = false
                    didSet = true
                case CPU_TYPE_X86_64:
                    isLp64 = true
                    didSet = true
                case CPU_TYPE_POWERPC:
                    isLp64 = false
                    didSet = true
                default:
                    break
                }

                // Stop immediately if code type was discovered
                if didSet { break }
            }
        }

        // If we were unable to determine the code type, fall back on the processor info's value.
        if !didSet && crashReport.typeEncoding == .mach {
            switch Int32(crashReport.processorInfo) {
            case CPU_TYPE_ARM:
                isLp64 = false
            case CPU_TYPE_ARM64:
                isLp64 = true
            case CPU_TYPE_X86:
                isLp64 = false
            case CPU_TYPE_X86_64:
                isLp64 = true
            case CPU_TYPE_POWERPC:
                isLp64 = false
            default:
                isLp64 = true
            }
        }
    }

    func getException() -> Exception {
        let crashedThread = getCrashedThread()
        let exceptionDetails = ExceptionDetail(type: crashReport.exceptionName,
                                               message: crashReport.exceptionReason,
                                               frames: crashedThread?.frames,
                                               signal: crashReport.signalName,
                                               threadName: crashedThread?.name ?? "",
                                               threadSequence: crashedThread?.sequence ?? 0,
                                               osBuildNumber: crashReport.osBuildNumber)
        return Exception(handled: false,
                         exceptions: [exceptionDetails],
                         foreground: true,
                         threads: getExceptionStackTrace())
    }

    private func getCrashedThread() -> ThreadDetail? {
        if let threads = crashReport.threads, let crashedThread = threads.first(where: { $0.crashed }) {
            return getThreadData(crashedThread)
        }
        return nil
    }

    private func getExceptionStackTrace() -> [ThreadDetail]? {
        guard let threads = crashReport.threads else { return nil }
        var threadInfoList = [ThreadDetail]()
        for thread in threads where !thread.crashed {
            threadInfoList.append(getThreadData(thread))
        }
        return threadInfoList
    }

    private func getThreadData(_ thread: PLCrashReportThreadInfo) -> ThreadDetail {
        var frames = [StackFrame]()
        if let stackFrames = thread.stackFrames as? [PLCrashReportStackFrameInfo] {
            for (frameIndex, frameInfo) in stackFrames.enumerated() {
                frames.append(formatStackFrame(frameInfo: frameInfo,
                                               frameIndex: frameIndex,
                                               lp64: isLp64,
                                               operatingSystem: crashReport.operatingSystem,
                                               imageInfo: crashReport.image(frameInfo.instructionPointer)))
            }
        }
        let threadName = thread.crashed ? "Thread \(thread.threadNumber) Crashed" : "Thread \(thread.threadNumber)"
        return ThreadDetail(name: threadName, frames: frames, sequence: Number(thread.threadNumber))
    }

    private func formatStackFrame(frameInfo: PLCrashReportStackFrameInfo,
                                  frameIndex: Int,
                                  lp64: Bool,
                                  operatingSystem: CrashReportOperatingSystem,
                                  imageInfo: PLCrashReportBinaryImageInfo?) -> StackFrame {
        // Base image address containing instrumention pointer, offset of the IP from that base address, and the associated image name
        var baseAddress: UInt64 = 0x0
        var pcOffset: UInt64 = 0x0
        var imageName: String = "???"
        var binaryAddress = ""
        var offset = ""

        if let imageInfo = imageInfo {
            imageName = (imageInfo.imageName as NSString).lastPathComponent
            baseAddress = imageInfo.imageBaseAddress
            pcOffset = frameInfo.instructionPointer - imageInfo.imageBaseAddress
        } else if frameInfo.instructionPointer != 0 {
            print("Cannot find image for 0x\(String(format: "%llx", frameInfo.instructionPointer))")
        }

        if let symbolInfo = frameInfo.symbolInfo {
            var symbolName = symbolInfo.symbolName

            if let symbolNameUnwrapped = symbolName {
                // Apple strips the _ symbol prefix in their reports.
                if symbolNameUnwrapped.hasPrefix("_") && symbolNameUnwrapped.count > 1 {
                    switch operatingSystem {
                    case .macOSX, .iPhoneOS, .iPhoneSimulator, .unknown:
                        symbolName = String(symbolNameUnwrapped.dropFirst())
                    default:
                        print("Symbol \"\(symbolName ?? "???")\" prefix rules are unknown for this OS!")
                    }
                }
            }

            let symOffset = frameInfo.instructionPointer - symbolInfo.startAddress
            binaryAddress = symbolName ?? ""
            offset = "\(symOffset)"
        } else {
            binaryAddress = String(format: "%llx", baseAddress)
            offset = String(format: "%lld", pcOffset)
        }

        let formattedInstructionPointer = String(format: "%0*llx", lp64 ? 16 : 8, frameInfo.instructionPointer)
        let stackFrame = StackFrame(binaryName: imageName,
                                    binaryAddress: binaryAddress,
                                    offset: offset,
                                    frameIndex: Number(frameIndex),
                                    symbolAddress: formattedInstructionPointer,
                                    inApp: self.executableName == imageName)
        return stackFrame
    }
}
