//
//  CrashReporter.swift
//  Measure
//
//  Created by Adwin Ross on 12/08/24.
//

import Foundation
import CrashReporter

struct MeasureCrashReporter {
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
                let crashData = try crashReporter.loadPendingCrashReportDataAndReturnError()
                let crashReport = try PLCrashReport(data: crashData)
                let crashReportSanitizer = CrashReportSanitizer(crashReport: crashReport)
                let event = crashReportSanitizer.getExcentionEvent()
                // TODO: clear out what is timestamp? is it a current time, or epoch
                // TODO: carrier name not coming properly
                // TODO: what are installationId & userId
                // TODO: remove hardcoded foreground value in crashlog
                do {
                    let encoder = JSONEncoder()
                    encoder.outputFormatting = .prettyPrinted // For readable JSON format
                    let jsonData = try encoder.encode(event)
                    
                    if let jsonString = String(data: jsonData, encoding: .utf8) {
                        print(jsonString) // Prints the JSON string
                    }
                } catch {
                    print("Failed to encode Event to JSON: \(error)")
                }
                // Convert the crash report to a human-readable string
                let crashReportString = PLCrashReportTextFormatter.stringValue(for: crashReport, with: PLCrashReportTextFormatiOS)
                
                // Save the crash report to a file or send it to your server
//                print(crashReportString ?? "No crash report string")
                
                // Purge the report
//                crashReporter.purgePendingCrashReport()
            } catch {
                print("Could not load crash report: \(error)")
            }
        }
    }
}
