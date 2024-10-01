//
//  CrashDataFormatterTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 21/09/24.
//

import CrashReporter
@testable import MeasureSDK
import XCTest

final class CrashDataFormatterTests: XCTestCase {
    private var crashDataFormatter: CrashDataFormatter!
    var fileManagerHelper = FileManagerHelper()

    func testBackgroundThreadException() {
        guard let crashReport = fileManagerHelper.getCrashReport(fileName: "backgroundThreadException", fileExtension: "plcrash") else {
            XCTFail("Failed to load PLCrash report from test bundle.")
            return
        }

        crashDataFormatter = CrashDataFormatter(crashReport)
        let exception = crashDataFormatter.getException()

        guard let exceptionJson = fileManagerHelper.getException(fileName: "backgroundThreadException", fileExtension: "json") else {
            XCTFail("Failed to read JSON file from test bundle.")
            return
        }

        XCTAssertEqual(exceptionJson, exception)
    }

    func testAbort() {
        guard let crashReport = fileManagerHelper.getCrashReport(fileName: "abort", fileExtension: "plcrash") else {
            XCTFail("Failed to load PLCrash report from test bundle.")
            return
        }

        crashDataFormatter = CrashDataFormatter(crashReport)
        let exception = crashDataFormatter.getException()

        guard let exceptionJson = fileManagerHelper.getException(fileName: "abort", fileExtension: "json") else {
            XCTFail("Failed to read JSON file from test bundle.")
            return
        }

        XCTAssertEqual(exceptionJson, exception)
    }
}
