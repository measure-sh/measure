//
//  SdkDebugLogWriterTests.swift
//  MeasureSDKTests
//

import XCTest
@testable import Measure

final class SdkDebugLogWriterTests: XCTestCase {
    var sut: SdkDebugLogWriter!
    var logsDir: URL!

    override func setUp() {
        super.setUp()
        sut = SdkDebugLogWriter()
        logsDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("SdkDebugLogWriterTests-\(UUID().uuidString)")
    }

    override func tearDown() {
        sut = nil
        if let logsDir, FileManager.default.fileExists(atPath: logsDir.path) {
            try? FileManager.default.removeItem(at: logsDir)
        }
        logsDir = nil
        super.tearDown()
    }

    // MARK: - start

    func test_start_createsLogFileInDirectory() {
        let timestamp: Int64 = 1234567890
        let expectation = expectation(description: "File created on background queue")

        sut.start(sdkVersion: "1.0.0", timestamp: timestamp, logsDir: logsDir)

        // flush() dispatches to the serial queue; calling it ensures the start work has completed.
        sut.flush()

        // Give the serial queue time to process start + flush
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 5.0)

        let filePath = logsDir.appendingPathComponent("\(timestamp)").path
        XCTAssertTrue(FileManager.default.fileExists(atPath: filePath), "Log file should exist at \(filePath)")
    }

    func test_start_writesHeaderToFile() {
        let timestamp: Int64 = 9999999999
        let sdkVersion = "2.3.1"
        let expectation = expectation(description: "Header written")

        sut.start(sdkVersion: sdkVersion, timestamp: timestamp, logsDir: logsDir)
        sut.flush()

        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 5.0)

        let fileURL = logsDir.appendingPathComponent("\(timestamp)")
        let contents = try? String(contentsOf: fileURL, encoding: .utf8)
        XCTAssertNotNil(contents, "Should be able to read file contents")
        XCTAssertTrue(contents?.hasPrefix("\(sdkVersion) \(timestamp)\n") == true,
                      "First line should be '<sdkVersion> <timestamp>\\n', got: \(contents ?? "nil")")
    }

    // MARK: - writeLog + flush

    func test_writeLog_thenFlushWritesEntryToFile() {
        let timestamp: Int64 = 1111111111
        let expectation = expectation(description: "Log entry flushed")

        sut.start(sdkVersion: "1.0.0", timestamp: timestamp, logsDir: logsDir)
        sut.writeLog(level: .debug, message: "test message", error: nil)
        sut.flush()

        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 5.0)

        let fileURL = logsDir.appendingPathComponent("\(timestamp)")
        let contents = (try? String(contentsOf: fileURL, encoding: .utf8)) ?? ""
        XCTAssertTrue(contents.contains("Debug test message"), "File should contain the log entry, got: \(contents)")
    }

    func test_writeLog_multipleEntries_allFlushedToFile() {
        let timestamp: Int64 = 2222222222
        let expectation = expectation(description: "Multiple entries flushed")

        sut.start(sdkVersion: "1.0.0", timestamp: timestamp, logsDir: logsDir)
        sut.writeLog(level: .debug, message: "first", error: nil)
        sut.writeLog(level: .info, message: "second", error: nil)
        sut.writeLog(level: .error, message: "third", error: nil)
        sut.flush()

        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 5.0)

        let fileURL = logsDir.appendingPathComponent("\(timestamp)")
        let contents = (try? String(contentsOf: fileURL, encoding: .utf8)) ?? ""
        XCTAssertTrue(contents.contains("Debug first"), "Should contain first entry")
        XCTAssertTrue(contents.contains("Info second"), "Should contain second entry")
        XCTAssertTrue(contents.contains("Error third"), "Should contain third entry")
    }

    func test_writeLog_withError_includesErrorInOutput() {
        let timestamp: Int64 = 3333333333
        let expectation = expectation(description: "Error entry flushed")

        sut.start(sdkVersion: "1.0.0", timestamp: timestamp, logsDir: logsDir)

        let testError = NSError(domain: "test.domain", code: 99, userInfo: [NSLocalizedDescriptionKey: "something broke"])
        sut.writeLog(level: .error, message: "failed op", error: testError)
        sut.flush()

        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 5.0)

        let fileURL = logsDir.appendingPathComponent("\(timestamp)")
        let contents = (try? String(contentsOf: fileURL, encoding: .utf8)) ?? ""
        XCTAssertTrue(contents.contains("something broke"), "File should include error description, got: \(contents)")
    }

    // MARK: - Error handling

    func test_start_silentlyHandlesInvalidDirectory() {
        let invalidDir = URL(fileURLWithPath: "/nonexistent/readonly/path")
        let expectation = expectation(description: "No crash on invalid directory")

        // Should not crash
        sut.start(sdkVersion: "1.0.0", timestamp: 0, logsDir: invalidDir)
        sut.flush()

        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 5.0)
        // If we reach here without crashing, the test passes
    }
}
