//
//  CrashDataWriter.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 19/09/24.
//

#if canImport(KSCrashRecording)
import KSCrashRecording
#elseif canImport(KSCrash)
import KSCrash
#endif
import Foundation

/// A singleton class responsible for writing crash data to a persistent store.
final class CrashDataWriter {
    static let shared = CrashDataWriter()
    private var crashDataPersistence: CrashDataPersistence?

    private init() {}

    func setCrashDataPersistence(_ crashDataPersistence: CrashDataPersistence) {
        self.crashDataPersistence = crashDataPersistence
    }

    func writeCrashData(plan: UnsafePointer<ExceptionHandlingPlan>, writer: UnsafePointer<ReportWriter>) {
        crashDataPersistence?.writeCrashData(plan: plan, writer: writer)
    }
}
