//
//  CrashSanitizerTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 15/08/24.
//

import XCTest
import CrashReporter
@testable import MeasureSDK

final class CrashSanitizerTests: XCTestCase {
    func testGetOSName() {
        let sanitizerMacOS = CrashReportSanitizer(crashReport: MockPLCrashReport.getMockReportForOSName(os: .macOSX))
        XCTAssertEqual(sanitizerMacOS.getOSName(), "Mac OS X")
        
        let sanitizeriPhone = CrashReportSanitizer(crashReport: MockPLCrashReport.getMockReportForOSName(os: .iPhoneOS))
        XCTAssertEqual(sanitizeriPhone.getOSName(), "iPhone OS")
        
        let sanitizeriPhoneSimulator = CrashReportSanitizer(crashReport: MockPLCrashReport.getMockReportForOSName(os: .iPhoneSimulator))
        XCTAssertEqual(sanitizeriPhoneSimulator.getOSName(), "Mac OS X")
        
        let sanitizerUnknown = CrashReportSanitizer(crashReport: MockPLCrashReport.getMockReportForOSName(os: .unknown))
        XCTAssertEqual(sanitizerUnknown.getOSName(), "Unknown 3")
        
        let sanitizerAppleTVOS = CrashReportSanitizer(crashReport: MockPLCrashReport.getMockReportForOSName(os: .appleTVOS))
        XCTAssertEqual(sanitizerAppleTVOS.getOSName(), "Apple tvOS")
    }
    
    func testProcessorCodeType() {
        guard let fileURL = Bundle(for: type(of: self)).url(forResource: "crashReport", withExtension: "plcrash") else {
            XCTFail("Failed to locate the file.")
            return
        }
        
        do {
            let fileData = try Data(contentsOf: fileURL)
            XCTAssertFalse(fileData.isEmpty, "File data should not be empty")
            let crashReport = try PLCrashReport(data: fileData)
            let crashSanitizer = CrashReportSanitizer(crashReport: crashReport)
            XCTAssertEqual(crashSanitizer.processorCodeType, "X86-64")
            XCTAssertEqual(crashSanitizer.lp64, true)
        } catch {
            XCTFail("Failed to read the file as Data: \(error)")
        }
        
        let crashReportSanitizerARM = CrashReportSanitizer(crashReport: MockPLCrashReport.getMockReportForOSName(os: .macOSX, processorInfo: PLCrashReportProcessorInfo(typeEncoding: PLCrashReportProcessorTypeEncoding(1), type: UInt64(CPU_TYPE_ARM), subtype: UInt64(CPU_TYPE_ARM64))!))
        XCTAssertEqual(crashReportSanitizerARM.processorCodeType, "ARM")
        XCTAssertEqual(crashReportSanitizerARM.lp64, false)
        
        let crashReportSanitizerARM64 = CrashReportSanitizer(crashReport: MockPLCrashReport.getMockReportForOSName(os: .macOSX, processorInfo: PLCrashReportProcessorInfo(typeEncoding: PLCrashReportProcessorTypeEncoding(1), type: UInt64(CPU_TYPE_ARM64), subtype: UInt64(CPU_TYPE_ARM64))!))
        XCTAssertEqual(crashReportSanitizerARM64.processorCodeType, "ARM-64")
        XCTAssertEqual(crashReportSanitizerARM64.lp64, true)
        
        let crashReportSanitizerX86 = CrashReportSanitizer(crashReport: MockPLCrashReport.getMockReportForOSName(os: .macOSX, processorInfo: PLCrashReportProcessorInfo(typeEncoding: PLCrashReportProcessorTypeEncoding(1), type: UInt64(CPU_TYPE_X86), subtype: UInt64(CPU_TYPE_ARM64))!))
        XCTAssertEqual(crashReportSanitizerX86.processorCodeType, "X86")
        XCTAssertEqual(crashReportSanitizerX86.lp64, false)
        
        let crashReportSanitizerX86_64 = CrashReportSanitizer(crashReport: MockPLCrashReport.getMockReportForOSName(os: .macOSX, processorInfo: PLCrashReportProcessorInfo(typeEncoding: PLCrashReportProcessorTypeEncoding(1), type: UInt64(CPU_TYPE_X86_64), subtype: UInt64(CPU_TYPE_ARM64))!))
        XCTAssertEqual(crashReportSanitizerX86_64.processorCodeType, "X86-64")
        XCTAssertEqual(crashReportSanitizerX86_64.lp64, true)
        
        let crashReportSanitizerPPC = CrashReportSanitizer(crashReport: MockPLCrashReport.getMockReportForOSName(os: .macOSX, processorInfo: PLCrashReportProcessorInfo(typeEncoding: PLCrashReportProcessorTypeEncoding(1), type: UInt64(CPU_TYPE_POWERPC), subtype: UInt64(CPU_TYPE_ARM64))!))
        XCTAssertEqual(crashReportSanitizerPPC.processorCodeType, "PPC")
        XCTAssertEqual(crashReportSanitizerPPC.lp64, false)
    }
    
    func testHeaderInfo() {
        guard let fileURL = Bundle(for: type(of: self)).url(forResource: "crashReport", withExtension: "plcrash") else {
            XCTFail("Failed to locate the file.")
            return
        }
        
        do {
            let fileData = try Data(contentsOf: fileURL)
            XCTAssertFalse(fileData.isEmpty, "File data should not be empty")
            let crashReport = try PLCrashReport(data: fileData)
            let crashSanitizer = CrashReportSanitizer(crashReport: crashReport)
            XCTAssertEqual(crashSanitizer.hardwareModel, "x86_64")
            XCTAssertEqual(crashSanitizer.incidentIdentifier, "9A81F0B0-49EB-41AE-AB91-92D18748317C")
            XCTAssertEqual(crashSanitizer.processId, "15112")
            XCTAssertEqual(crashSanitizer.processPath, "/Users/edpu/Library/Developer/CoreSimulator/Devices/B2E2BC7F-41AA-45C4-B5BC-68BC02E0AD8B/data/Containers/Bundle/Application/A738472D-7B48-4AAA-B1D4-9A19D12A32C7/MeasureDemo.app/MeasureDemo")
            XCTAssertEqual(crashSanitizer.parentProcessName, "launchd_sim")
            XCTAssertEqual(crashSanitizer.parentProcessId, "11658")
            XCTAssertEqual(crashSanitizer.versionString, "1")
            XCTAssertEqual(crashSanitizer.marketingVersion, "1.0")
            XCTAssertNotNil(crashSanitizer.timestamp)
            XCTAssertEqual(crashSanitizer.osVersion, "17.4")
            XCTAssertEqual(crashSanitizer.exceptionType, "SIGABRT")
            XCTAssertEqual(crashSanitizer.exceptionCode, "#0 at 0x000000010bd4a14a")
            XCTAssertEqual(crashSanitizer.hasExceptionInfo, false)
            XCTAssertEqual(crashSanitizer.lp64, true)
        } catch {
            XCTFail("Failed to read the file as Data: \(error)")
        }
    }
    
    func testPerformanceExample() throws {
        guard let fileURL = Bundle(for: type(of: self)).url(forResource: "crashReport", withExtension: "plcrash") else {
            XCTFail("Failed to locate the file.")
            return
        }
        
        self.measure {
            do {
                let fileData = try Data(contentsOf: fileURL)
                XCTAssertFalse(fileData.isEmpty, "File data should not be empty")
                let crashReport = try PLCrashReport(data: fileData)
                let crashSanitizer = CrashReportSanitizer(crashReport: crashReport)
                let _ = crashSanitizer.getOSName()
                let _ = crashSanitizer.getBinaryImage()
                let _ = crashSanitizer.getCrashedThread()
                let _ = crashSanitizer.getExceptionStackTrace()
            } catch {
                XCTFail("Failed to read the file as Data: \(error)")
            }
        }
    }
}
