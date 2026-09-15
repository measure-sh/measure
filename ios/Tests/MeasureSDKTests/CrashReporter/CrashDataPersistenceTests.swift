//
//  CrashDataPersistenceTests.swift
//  MeasureSDKTests
//

import XCTest
import KSCrashRecording
@testable import Measure

final class CrashDataPersistenceTests: XCTestCase {
    func testReadsTotalMemoryFromCrashReport() throws {
        let report: [String: Any] = [
            "user": ["device_total_memory": 6 * 1024 * 1024]
        ]
        // Crash reports arrive as JSON, so exercise NSNumber bridging as well.
        let data = try JSONSerialization.data(withJSONObject: report)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        let persistence = BaseCrashDataPersistence()

        XCTAssertEqual(persistence.readCrashData(from: json).attribute?.deviceTotalMemory, 6 * 1024 * 1024)
        XCTAssertNil(persistence.readCrashData(from: ["user": [:]]).attribute?.deviceTotalMemory)
    }

    func testWritesTotalMemoryToCrashReport() {
        let memory: UnsignedNumber = 6 * 1024 * 1024
        let persistence = BaseCrashDataPersistence(attribute: Attributes(deviceTotalMemory: memory))
        var plan = ExceptionHandlingPlan()
        var writer = ReportWriter()
        writer.addStringElement = { _, _, _ in }
        writer.addBooleanElement = { _, _, _ in }
        writer.addUIntegerElement = { writer, name, value in
            XCTAssertEqual(String(cString: name!), "device_total_memory")
            writer!.pointee.context!.assumingMemoryBound(to: UInt64.self).pointee = value
        }
        var recorded: UInt64 = 0
        withUnsafeMutablePointer(to: &recorded) { result in
            writer.context = UnsafeMutableRawPointer(result)
            persistence.writeCrashData(plan: &plan, writer: &writer)
        }

        XCTAssertEqual(recorded, memory)
    }
}
