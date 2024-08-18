//
//  MockPLCrashReport.swift
//  MeasureSDKTests
//
//  Created by EdPu on 16/08/24.
//

import CrashReporter
@testable import MeasureSDK

class MockPLCrashReport: PLCrashReport {
    var mockSystemInfo: PLCrashReportSystemInfo?
    var mockMachineInfo: PLCrashReportMachineInfo?
    var mockProcessInfo: PLCrashReportProcessInfo?
    var mockSignalInfo: PLCrashReportSignalInfo?
    var mockExceptionInfo: PLCrashReportExceptionInfo?
    var mockUUIDRef: CFUUID?
    
    override var systemInfo: PLCrashReportSystemInfo {
        return mockSystemInfo ?? PLCrashReportSystemInfo()
    }
    
    override var machineInfo: PLCrashReportMachineInfo? {
        return mockMachineInfo
    }
    
    override var processInfo: PLCrashReportProcessInfo {
        return mockProcessInfo ?? PLCrashReportProcessInfo()
    }
    
    override var signalInfo: PLCrashReportSignalInfo {
        return mockSignalInfo ?? PLCrashReportSignalInfo()
    }
    
    override var exceptionInfo: PLCrashReportExceptionInfo {
        return mockExceptionInfo ?? PLCrashReportExceptionInfo()
    }
    
    override var uuidRef: CFUUID? {
        return mockUUIDRef
    }
    
    static func getMockReportForOSName(os: CrashReportOperatingSystem, processorInfo: PLCrashReportProcessorInfo? = nil) -> MockPLCrashReport {
        var processInfoInternal = processorInfo
        if processInfoInternal == nil {
            processInfoInternal = PLCrashReportProcessorInfo(typeEncoding: PLCrashReportProcessorTypeEncoding(1),
                                                             type: UInt64(CPU_TYPE_ARM),
                                                             subtype: UInt64(CPU_SUBTYPE_ARM_V6))!
        }
        let mockSystemInfo = PLCrashReportSystemInfo(operatingSystem: PLCrashReportOperatingSystem(UInt32(os.rawValue)),
                                                     operatingSystemVersion: "",
                                                     operatingSystemBuild: "",
                                                     architecture: PLCrashReportArchitecture(0),
                                                     processorInfo: processInfoInternal,
                                                     timestamp: Date())
        
        let mockReport = MockPLCrashReport()
        mockReport.mockSystemInfo = mockSystemInfo
        
        return mockReport
    }
}
