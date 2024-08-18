//
//  CrashReporter.swift
//  Measure
//
//  Created by Adwin Ross on 12/08/24.
//

import Foundation
import CrashReporter

class MeasureCrashReporter {
    private let crashReporter = PLCrashReporter()
    
    func initializeCrashReporter(with sessionId: String) {
        do {
            let customData = ["session_id": sessionId]
            do {
                let jsonData = try JSONSerialization.data(withJSONObject: customData, options: [])
                crashReporter.customData = jsonData
            } catch {
                print("Error converting dictionary to JSON data: \(error)")
            }
            try crashReporter.enableAndReturnError()
        } catch {
            print("Could not enable crash reporter: \(error)")
        }
    }
    
    func handleCrashReport() {
        if crashReporter.hasPendingCrashReport() {
            do {
                let crashPath = crashReporter.crashReportPath()
//                print("crashPath: ", crashPath)
                let crashData = try crashReporter.loadPendingCrashReportDataAndReturnError()
                let crashReport = try PLCrashReport(data: crashData)
                let crashReportSanitizer = CrashReportSanitizer(crashReport: crashReport)
                
//                print("===================================")
//                print("crashReportSanitizer.getOSName() \(crashReportSanitizer.getOSName())")
//                print("crashReportSanitizer.getProcesserArchitecture() \(crashReportSanitizer.getProcessorArchitecture())")
//                print("crashReportSanitizer.parentProcessName \(crashReportSanitizer.parentProcessName)")
//                print("crashReportSanitizer.processPath \(crashReportSanitizer.processPath)")
//                print("crashReportSanitizer.hardwareModel \(crashReportSanitizer.hardwareModel)")
//                print("crashReportSanitizer.incidentIdentifier \(crashReportSanitizer.incidentIdentifier)")
//                print("crashReportSanitizer.marketingVersion \(crashReportSanitizer.marketingVersion)")
//                print("crashReportSanitizer.osVersion \(crashReportSanitizer.osVersion)")
//                print("crashReportSanitizer.parentProcessId \(crashReportSanitizer.parentProcessId)")
//                print("crashReportSanitizer.processId \(crashReportSanitizer.processId)")
//                print("crashReportSanitizer.processName \(crashReportSanitizer.processName)")
//                print("crashReportSanitizer.versionString \(crashReportSanitizer.versionString)")
//                print("crashReportSanitizer.getCrashedThread() \(crashReportSanitizer.getCrashedThread())")
//                print("crashReportSanitizer.exceptionType \(crashReportSanitizer.exceptionType)")
//                print("crashReportSanitizer.exceptionCode \(crashReportSanitizer.exceptionCode)")
//                print("crashReportSanitizer.timestamp \(crashReportSanitizer.timestamp)")
//                print("asdasd asdasdasdasd asdasdasdasd")
//                for threadas in crashReportSanitizer.getExceptionStackTrace()! {
//                    print(threadas)
//                }
//                if crashReportSanitizer.hasExceptionInfo {
//                    print("crashReportSanitizer.timestamp \(crashReportSanitizer.exceptionInfo)")
//                }
//                if let registers = crashReportSanitizer.getRegisterData() {
//                    for register in registers {
//                        print(register)
//                    }
//                }
//                crashReportSanitizer.getBinaryImage()
                print("===================================")
                
                // Convert the crash report to a human-readable string
                let crashReportString = PLCrashReportTextFormatter.stringValue(for: crashReport, with: PLCrashReportTextFormatiOS)
                
                // Save the crash report to a file or send it to your server
                print(crashReportString ?? "No crash report string")
                
                // Purge the report
                crashReporter.purgePendingCrashReport()
            } catch {
                print("Could not load crash report: \(error)")
            }
        }
    }
}
