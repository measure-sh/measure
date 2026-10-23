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

    func testReadsMissingOrEmptySessionIdAsNil() {
        let persistence = BaseCrashDataPersistence()

        XCTAssertNil(persistence.readCrashData(from: ["user": [:]]).sessionId)
        XCTAssertNil(persistence.readCrashData(from: ["user": ["session_id": ""]]).sessionId)
        XCTAssertEqual(persistence.readCrashData(from: ["user": ["session_id": "session-123"]]).sessionId, "session-123")
    }

    func testWritesSessionIdAndForegroundWhenAttributesAreNil() {
        let persistence = BaseCrashDataPersistence(attribute: nil, sessionId: "session-123", isForeground: true)
        var plan = ExceptionHandlingPlan()
        var writer = ReportWriter()
        writer.addStringElement = { writer, name, value in
            let recorder = Unmanaged<CrashDataRecorder>.fromOpaque(writer!.pointee.context!).takeUnretainedValue()
            recorder.strings[String(cString: name!)] = String(cString: value!)
        }
        writer.addBooleanElement = { writer, name, value in
            let recorder = Unmanaged<CrashDataRecorder>.fromOpaque(writer!.pointee.context!).takeUnretainedValue()
            recorder.booleans[String(cString: name!)] = value
        }
        let recorder = CrashDataRecorder()
        writer.context = Unmanaged.passUnretained(recorder).toOpaque()

        persistence.writeCrashData(plan: &plan, writer: &writer)

        XCTAssertEqual(recorder.strings, ["session_id": "session-123"])
        XCTAssertEqual(recorder.booleans, ["is_foreground": true])
    }
}

private final class CrashDataRecorder {
    var strings: [String: String] = [:]
    var booleans: [String: Bool] = [:]
}
