//
//  CrashReportSanitizer.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 13/08/24.
//

import Foundation
import CrashReporter

enum CrashReportProcessorTypeEncoding: UInt32 {
    /** Unknown CPU type encoding. */
    case unknown = 0
    
    /** Apple Mach-defined processor types. */
    case mach = 1
}

struct CrashReportSanitizer {
    private let crashReport: PLCrashReport
    
    /// The application version. This is usually the application's CFBundleVersion value.
    var versionString: String {
        return crashReport.applicationInfo.applicationVersion
    }
    /// The application marketing version. This is usually the application's CFBundleShortVersionString value if available. May be nil.
    var marketingVersion: String? {
        return crashReport.applicationInfo.applicationMarketingVersion
    }
    /// Date and time that the crash report was generated. This may be unavailable, and this property will be nil
    var timestamp: Date? {
        return crashReport.systemInfo.timestamp
    }
    /// The operating system version, including the build number, on which the crash occurred.
    var operatingSystemBuild: String? {
        return crashReport.systemInfo.operatingSystemBuild
    }
    /// The name of the Mach exception that terminated the process, along with the name of the corresponding BSD termination signal in parentheses. Check out https://developer.apple.com/documentation/xcode/understanding-the-exception-types-in-a-crash-report
    var exceptionType: String {
        return crashReport.signalInfo.name
    }
    
    /// Mark whether architecture is LP64 (64-bit)
    var isLp64 = true
    
    init(crashReport: PLCrashReport) {
        self.crashReport = crashReport
        
        var codeType = ""
        
        if let images = crashReport.images as? [PLCrashReportBinaryImageInfo] {
            /// Attempt to derive the code type from the binary images
            for image in images {
                /// Skip images with no specified type
                guard let imageCodeType = image.codeType else { continue }
                
                /// Skip unknown encodings
                guard imageCodeType.typeEncoding.rawValue == CrashReportProcessorTypeEncoding.mach.rawValue else { continue }
                
                switch Int32(imageCodeType.type) {
                case CPU_TYPE_ARM:
                    codeType = "ARM"
                    isLp64 = false
                case CPU_TYPE_ARM64:
                    codeType = "ARM-64"
                    isLp64 = true
                case CPU_TYPE_X86:
                    codeType = "X86"
                    isLp64 = false
                case CPU_TYPE_X86_64:
                    codeType = "X86-64"
                    isLp64 = true
                case CPU_TYPE_POWERPC:
                    codeType = "PPC"
                    isLp64 = false
                default:
                    break
                }
                
                /// Stop immediately if code type was discovered
                if !codeType.isEmpty { break }
            }
        }
        
        /// If we were unable to determine the code type, fall back on the processor info's value.
        if codeType.isEmpty && crashReport.systemInfo.processorInfo.typeEncoding.rawValue == CrashReportProcessorTypeEncoding.mach.rawValue {
            switch Int32(crashReport.systemInfo.processorInfo.type) {
            case CPU_TYPE_ARM:
                codeType = "ARM"
                isLp64 = false
            case CPU_TYPE_ARM64:
                codeType = "ARM-64"
                isLp64 = true
            case CPU_TYPE_X86:
                codeType = "X86"
                isLp64 = false
            case CPU_TYPE_X86_64:
                codeType = "X86-64"
                isLp64 = true
            case CPU_TYPE_POWERPC:
                codeType = "PPC"
                isLp64 = false
            default:
                codeType = "Unknown (\(crashReport.systemInfo.processorInfo.type))"
                isLp64 = true
            }
        }
        
        /// If we still haven't determined the code type, we're totally clueless.
        if codeType.isEmpty {
            codeType = "Unknown"
            isLp64 = true
        }
    }
    
    func getExcentionEvent() -> Event {
        let crashedThread = getCrashedThread()
        var sessionId = ""
        if let sessionData = crashReport.customData {
            do {
                let dict = try JSONSerialization.jsonObject(with: sessionData, options: []) as? [String: Any]
                if let session_id = dict?["session_id"] as? String {
                    sessionId = session_id
                }
            } catch {
                print(error.localizedDescription)
            }
        }
        
        let exceptionDetail = ExceptionDetail(type: crashReport.exceptionInfo?.exceptionName ?? "",
                                              message: crashReport.exceptionInfo?.exceptionReason ?? "",
                                              frames: crashedThread?.frames,
                                              signal: exceptionType,
                                              threadName: crashedThread?.name ?? "Thread 0",
                                              threadSequence: crashedThread?.sequence ?? 0, 
                                              cpuArch: getCPUArch(),
                                              operatingSystemBuild: operatingSystemBuild ?? "")
        let exception = Exception(handled: false,
                                  exceptions: [exceptionDetail],
                                  foreground: true,
                                  threads: getExceptionStackTrace())
        // TODO: clear out what is timestamp? is it a current time, or epoch - Current time in UTC ios 8601 format
        // TODO: carrier name not coming properly - Discussed
        // TODO: what are installationId & userId
        // installationId: A unique id per device generated once per lifetime of application.
        // userId: client id set by sdk user
        // TODO: remove hardcoded foreground value in crashlog
        // TODO: what is the sessionId here, current or crashed
        // sessionid - the id when the crash happened
        /* TODO: managing crash related os info in attributes
            - OS Version
            - Crash Time
            - Crash App Version
            - TimeStamp
         */
        
        return Event(id: UUID().uuidString,
                     type: "exception",
                     sessionId: sessionId,
                     timestamp: Date().description,
                     userTriggered: false,
                     attributes: AttributeGenerator.generateAttribute(installationId: "installationId", userId: "userId"),
                     exception: exception)
    }
    
    func getCPUArch() -> String {
        switch Int32(crashReport.systemInfo.processorInfo.type) {
        case CPU_TYPE_ARM:
            switch Int32(crashReport.systemInfo.processorInfo.subtype) {
            case CPU_SUBTYPE_ARM_V6:
                return "armv6"
            case CPU_SUBTYPE_ARM_V7:
                return "armv7"
            case CPU_SUBTYPE_ARM_V7F:
                return "armv7f"
            case CPU_SUBTYPE_ARM_V7K:
                return "armv7k"
            case CPU_SUBTYPE_ARM_V7S:
                return "armv7s"
            default:
                return "arm"
            }
        case CPU_TYPE_ARM64:
            switch Int32(crashReport.systemInfo.processorInfo.subtype) {
            case CPU_SUBTYPE_ARM64E:
                return "arm64e"
            default:
                return "arm64"
            }
        case CPU_TYPE_X86:
            return "i386"
        case CPU_TYPE_X86_64:
            return "x86_64"
        default:
            return "unknown(\(crashReport.systemInfo.processorInfo.type),\(crashReport.systemInfo.processorInfo.subtype))"
        }
    }
    
    func getCrashedThread() -> Thread? {
        if let threads = (crashReport.threads as? [PLCrashReportThreadInfo]), let crashedThread = threads.first(where: { $0.crashed }) {
            return getThreadData(crashedThread)
        }
        return nil
    }
    
    func getExceptionStackTrace() -> [Thread]? {
        guard let threads = crashReport.threads as? [PLCrashReportThreadInfo] else { return nil }
        var threadInfoList = [Thread]()
        for thread in threads {
            if !thread.crashed {
                threadInfoList.append(getThreadData(thread))
            }
        }
        return threadInfoList
    }
    
    private func getThreadData(_ thread: PLCrashReportThreadInfo) -> Thread {
        var frames = [StackFrame]()
        if let stackFrames = thread.stackFrames as? [PLCrashReportStackFrameInfo] {
            for (frameIndex, frameInfo) in stackFrames.enumerated() {
                frames.append(formatStackFrame(frameInfo: frameInfo,
                                               frameIndex: frameIndex,
                                               crashReport: crashReport,
                                               lp64: isLp64))
            }
        }
        let threadName = thread.crashed ? "Thread \(thread.threadNumber) Crashed" : "Thread \(thread.threadNumber)"
        return Thread(name: threadName, frames: frames, sequence: thread.threadNumber)
    }
    
    private func formatStackFrame(frameInfo: PLCrashReportStackFrameInfo, frameIndex: Int, crashReport: PLCrashReport, lp64: Bool) -> StackFrame {
        /// Base image address containing instrumention pointer, offset of the IP from that base address, and the associated image name
        var baseAddress: UInt64 = 0x0
        var pcOffset: UInt64 = 0x0
        var imageName: String = "???"
        var binaryAddress = ""
        var offset = ""
        
        if let imageInfo = crashReport.image(forAddress: frameInfo.instructionPointer) {
            imageName = (imageInfo.imageName as NSString).lastPathComponent
            baseAddress = imageInfo.imageBaseAddress
            pcOffset = frameInfo.instructionPointer - imageInfo.imageBaseAddress
        } else if frameInfo.instructionPointer != 0 {
            print("Cannot find image for 0x\(String(format: "%llx", frameInfo.instructionPointer))")
        }
        
        /// If symbol info is available, the format used in Apple's reports is Sym + OffsetFromSym. Otherwise, the format used is imageBaseAddress + offsetToIP
        if let symbolInfo = frameInfo.symbolInfo {
            var symbolName = symbolInfo.symbolName
            
            if let symbolNameUnwrapped = symbolName {
                /// Apple strips the _ symbol prefix in their reports.
                if symbolNameUnwrapped.hasPrefix("_") && symbolNameUnwrapped.count > 1 {
                    switch crashReport.systemInfo.operatingSystem.rawValue {
                    case 0, 1, 2, 3:
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
                                    frameIndex: frameIndex,
                                    symbolAddress: formattedInstructionPointer)
        return stackFrame
    }
}
