//
//  MockCrashDataPersistence.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/09/24.
//

#if canImport(KSCrashRecording)
import KSCrashRecording
#elseif canImport(KSCrash)
import KSCrash
#endif
import Foundation
@testable import Measure

final class MockCrashDataPersistence: CrashDataPersistence {
    var attribute: Attributes?
    var sessionId: String?
    var isForeground: Bool
    var writeCrashDataCalled = false
    var readCrashDataCalled = false
    /// The last `reportDict` passed to `readCrashData(from:)`, for assertions.
    var lastReadReportDict: [String: Any]?

    init(attribute: Attributes? = nil, sessionId: String? = nil, isForeground: Bool) {
        self.attribute = attribute
        self.sessionId = sessionId
        self.isForeground = isForeground
    }

    func writeCrashData(plan: UnsafePointer<ExceptionHandlingPlan>, writer: UnsafePointer<ReportWriter>) {
        writeCrashDataCalled = true
    }

    /// Ignores `reportDict` and simply returns whatever the test configured on this mock -
    /// real read-from-report parsing is covered by `CrashDataPersistenceTests`.
    func readCrashData(from reportDict: [String: Any]) -> CrashDataAttributes {
        readCrashDataCalled = true
        lastReadReportDict = reportDict
        return (attribute: attribute, sessionId: sessionId, isForeground: isForeground)
    }
}
