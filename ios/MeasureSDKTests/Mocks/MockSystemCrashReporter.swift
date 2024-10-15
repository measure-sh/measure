//
//  MockSystemCrashReporter.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/09/24.
//

import Foundation
@testable import MeasureSDK

final class MockSystemCrashReporter: SystemCrashReporter {
    var hasPendingCrashReport: Bool
    var crashData: Data

    init(hasPendingCrashReport: Bool, crashData: Data) {
        self.hasPendingCrashReport = hasPendingCrashReport
        self.crashData = crashData
    }

    func setCrashCallback(_ handleSignal: @convention(c) (UnsafeMutablePointer<siginfo_t>?, UnsafeMutablePointer<ucontext_t>?, UnsafeMutableRawPointer?) -> Void) {}

    func enable() throws {}

    func clearCrashData() {
        hasPendingCrashReport = false
    }

    func loadCrashReport() throws -> Data {
        return crashData
    }
}
