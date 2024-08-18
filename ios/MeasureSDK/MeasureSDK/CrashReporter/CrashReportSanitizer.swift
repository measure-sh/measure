//
//  CrashReportSanitizer.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 13/08/24.
//

import Foundation
import CrashReporter

enum CrashReportOperatingSystem: UInt32 {
    case macOSX = 0
    case iPhoneOS = 1
    case iPhoneSimulator = 2
    case unknown = 3
    case appleTVOS = 4
}

enum CrashReportProcessorTypeEncoding: UInt32 {
    /** Unknown CPU type encoding. */
    case unknown = 0
    
    /** Apple Mach-defined processor types. */
    case mach = 1
}


class CrashReportSanitizer {
    private let crashReport: PLCrashReport
    /// The specific device model the app was running on.
    var hardwareModel: String {
        return crashReport.hasMachineInfo && crashReport.machineInfo.modelName != nil ? crashReport.machineInfo.modelName! : "???"
    }
    /// A unique identifier for the report. Two reports never share the same Incident Identifier.
    var incidentIdentifier: String {
        return crashReport.uuidRef != nil ? CFUUIDCreateString(nil, crashReport.uuidRef) as String : "???"
    }
    /// The executable name for the process that crashed. This matches the CFBundleExecutable value in the app’s information property list.
    var processName: String {
        return crashReport.hasProcessInfo && crashReport.processInfo.processName != nil ? crashReport.processInfo.processName! : "???"
    }
    /// The id for the process that crashed. This matches the CFBundleExecutable value in the app’s information property list.
    var processId: String? {
        return crashReport.hasProcessInfo ? "\(crashReport.processInfo.processID)" : nil
    }
    /// The location of the executable on disk. macOS replaces user-identifable path components with placeholder values to protect privacy.
    var processPath: String {
        return crashReport.hasProcessInfo && crashReport.processInfo.processPath != nil ? crashReport.processInfo.processPath! : "???"
    }
    /// The name of the process that launched the crashed process
    var parentProcessName: String? {
        return crashReport.hasProcessInfo && crashReport.processInfo.parentProcessName != nil ? crashReport.processInfo.parentProcessName ?? "" : nil
    }
    /// The id of the process that launched the crashed process
    var parentProcessId: String? {
        return crashReport.hasProcessInfo ? "\(crashReport.processInfo.parentProcessID)" : nil
    }
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
    /// The operating system's release version.
    var osVersion: String {
        return crashReport.systemInfo.operatingSystemVersion
    }
    /// The name of the Mach exception that terminated the process, along with the name of the corresponding BSD termination signal in parentheses. Check out https://developer.apple.com/documentation/xcode/understanding-the-exception-types-in-a-crash-report
    var exceptionType: String {
        return crashReport.signalInfo.name
    }
    /// Processor specific information about the exception encoded into one or more 64-bit hexadecimal numbers. Typically, this field isn’t present because the operating system presents the information as human-readable information in the other fields of this section.
    var exceptionCode: String {
        return "\(crashReport.signalInfo.code ?? "") at 0x\(String(format: "%016lx", crashReport.signalInfo.address))"
    }
    var hasExceptionInfo: Bool {
        return crashReport.hasExceptionInfo
    }
    
    var exceptionInfo: String {
        return "*** Terminating app due to uncaught exception '\(crashReport.exceptionInfo?.exceptionName ?? "")', reason: '\(crashReport.exceptionInfo?.exceptionReason ?? "")'"
    }
    
    var osName: String = ""
    var processorCodeType: String = ""
    var lp64 = true
    
    init(crashReport: PLCrashReport) {
        self.crashReport = crashReport
        
        /// Map to Apple-style code type, and mark whether architecture is LP64 (64-bit)
        var codeType = ""
        var isLp64 = true
        
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
        lp64 = isLp64
        processorCodeType = codeType
    }
    
    /// Returns the operating system name of the crash
    /// - Returns: Operating system name
    func getOSName() -> String {
        switch crashReport.systemInfo.operatingSystem.rawValue {
        case CrashReportOperatingSystem.macOSX.rawValue:
            return "Mac OS X"
        case CrashReportOperatingSystem.iPhoneOS.rawValue:
            return "iPhone OS"
        case CrashReportOperatingSystem.iPhoneSimulator.rawValue:
            return "Mac OS X"
        case CrashReportOperatingSystem.appleTVOS.rawValue:
            return "Apple tvOS"
        default:
            return "Unknown \(crashReport.systemInfo.operatingSystem.rawValue)"
        }
    }
    
    /// Returns the crashed thread number
    /// - Returns: Crashed thread number
    func getCrashedThread() -> Int {
        if let threads = (crashReport.threads as? [PLCrashReportThreadInfo]), let crashedThread = threads.first(where: { $0.crashed }) {
            return crashedThread.threadNumber
        }
        return 0
    }
    
    func getExceptionStackTrace() -> [ThreadInfo]? {
        guard let threads = crashReport.threads as? [PLCrashReportThreadInfo] else { return nil }
        var threadInfoList = [ThreadInfo]()
        for thread in threads {
            var threadInfo = ThreadInfo(crashed: thread.crashed,
                                        stackFrames: [StackFrameInfo](),
                                        threadNumber: thread.threadNumber)
            if let stackFrames = thread.stackFrames as? [PLCrashReportStackFrameInfo] {
                for (frameIndex, frameInfo) in stackFrames.enumerated() {
                    threadInfo.stackFrames.append(formatStackFrame(frameInfo: frameInfo,
                                                                   frameIndex: frameIndex,
                                                                   crashReport: crashReport,
                                                                   lp64: lp64))
                }
            }
            threadInfoList.append(threadInfo)
        }
        return threadInfoList
    }
    
    func getRegisterData() -> [RegisterInfo]? {
        guard let threads = crashReport.threads as? [PLCrashReportThreadInfo] else { return nil }
        var registerInfoList = [RegisterInfo]()
        if let crashedThread = threads.first(where: { $0.crashed }) {
            guard let registers = crashedThread.registers as? [PLCrashReportRegisterInfo] else { return nil }
            for reg in registers {
                let reg_fmt: String
                
                /// Use 32-bit or 64-bit fixed width format for the register values
                if lp64 {
                    reg_fmt = "0x%016lx "
                } else {
                    reg_fmt = "0x%08lx "
                }
                
                /// Remap register names to match Apple's crash reports
                var regName = NSString(string: reg.registerName)
                if let machineInfo = crashReport.machineInfo, machineInfo.processorInfo.typeEncoding.rawValue == CrashReportProcessorTypeEncoding.mach.rawValue {
                    let archType = machineInfo.processorInfo.type & ~UInt64(CPU_ARCH_MASK)
                    
                    /// Apple uses 'ip' rather than 'r12' on ARM
                    if archType == CPU_TYPE_ARM && regName == "r12" {
                        regName = "ip"
                    }
                }
                print()
                print()
                registerInfoList.append(RegisterInfo(name: String(format: "%s", regName.utf8String ?? ""),
                                              value: String(format: reg_fmt, reg.registerValue)))
            }
        }
        return registerInfoList
    }
    
    func getBinaryImage() -> [BinaryImageInfo]? {
        guard let images = crashReport.images as? [PLCrashReportBinaryImageInfo] else { return nil }
        var lastImageBaseAddress: UInt64 = 0
        var imageInfoList = [BinaryImageInfo]()
        for imageInfo in images {
            /// Remove duplicates
            let imageBaseAddress = imageInfo.imageBaseAddress
            if lastImageBaseAddress == imageBaseAddress {
                continue
            }
            lastImageBaseAddress = imageBaseAddress
            
            let uuid: String
            /// Fetch the UUID if it exists
            if imageInfo.hasImageUUID {
                uuid = imageInfo.imageUUID
            } else {
                uuid = "???"
            }
            
            /// Determine the architecture string
            var archName = "???"
            if let codeType = imageInfo.codeType, codeType.typeEncoding.rawValue == CrashReportProcessorTypeEncoding.mach.rawValue {
                switch codeType.type {
                case UInt64(CPU_TYPE_ARM):
                    /// Apple includes subtype for ARM binaries.
                    switch codeType.subtype & ~UInt64(CPU_SUBTYPE_MASK) {
                    case UInt64(CPU_SUBTYPE_ARM_V6):
                        archName = "armv6"
                    case UInt64(CPU_SUBTYPE_ARM_V7):
                        archName = "armv7"
                    case UInt64(CPU_SUBTYPE_ARM_V7S):
                        archName = "armv7s"
                    default:
                        archName = "arm-unknown"
                    }
                case UInt64(CPU_TYPE_ARM64):
                    /// Apple includes subtype for ARM64 binaries.
                    switch codeType.subtype & ~UInt64(CPU_SUBTYPE_MASK) {
                    case UInt64(CPU_SUBTYPE_ARM64_ALL):
                        archName = "arm64"
                    case UInt64(CPU_SUBTYPE_ARM64_V8):
                        archName = "armv8"
                    case UInt64(CPU_SUBTYPE_ARM64E):
                        archName = "arm64e"
                    default:
                        archName = "arm64-unknown"
                    }
                case UInt64(CPU_TYPE_X86):
                    archName = "i386"
                case UInt64(CPU_TYPE_X86_64):
                    archName = "x86_64"
                case UInt64(CPU_TYPE_POWERPC):
                    archName = "powerpc"
                default:
                    /// Use the default archName value (initialized above).
                    break
                }
            }
            
            /// Determine if this is the main executable
            var binaryDesignator = " "
            if imageInfo.imageName == crashReport.processInfo.processPath {
                binaryDesignator = "+"
            }
            
            imageInfoList.append(BinaryImageInfo(baseAddress: String(format: "0x%llx", imageInfo.imageBaseAddress),
                                                 endAddress: String(format: "0x%llx", (imageInfo.imageBaseAddress + (max(1, imageInfo.imageSize) - 1))),
                                                 designator: binaryDesignator,
                                                 name: (imageInfo.imageName as NSString).lastPathComponent,
                                                 archName: archName,
                                                 uuid: uuid,
                                                 path: imageInfo.imageName))
        }
        return imageInfoList
    }
    
    private func formatStackFrame(frameInfo: PLCrashReportStackFrameInfo, frameIndex: Int, crashReport: PLCrashReport, lp64: Bool) -> StackFrameInfo {
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
            binaryAddress = String(format: "0x%llx", baseAddress)
            offset = String(format: "%lld", pcOffset)
        }
        
        let formattedInstructionPointer = String(format: "0x%0*llx", lp64 ? 16 : 8, frameInfo.instructionPointer)
        let stackFrame = StackFrameInfo(binaryName: imageName,
                                        binaryAddress: binaryAddress,
                                        offset: offset,
                                        frameIndex: frameIndex,
                                        symbolAddress: formattedInstructionPointer)
        return stackFrame
    }
}
