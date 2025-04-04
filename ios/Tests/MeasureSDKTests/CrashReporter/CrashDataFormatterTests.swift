//
//  CrashDataFormatterTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 21/09/24.
//

import CrashReporter
@testable import Measure
import XCTest

final class CrashDataFormatterTests: XCTestCase {
    private var crashDataFormatter: CrashDataFormatter!
    var fileManagerHelper = FileManagerHelper()

    func testBackgroundThreadException() { // swiftlint:disable:this function_body_length
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

        XCTAssertEqual(exception.handled, exceptionJson.handled, "Handled field mismatch")
        XCTAssertEqual(exception.foreground, exceptionJson.foreground, "Foreground field mismatch")

        XCTAssertEqual(exception.exceptions.count, exceptionJson.exceptions.count, "Exception details count mismatch")
        for (index, exceptionDetail) in exception.exceptions.enumerated() {
            let expectedDetail = exceptionJson.exceptions[index]
            XCTAssertEqual(exceptionDetail.type, expectedDetail.type, "Exception type mismatch at index \(index)")
            XCTAssertEqual(exceptionDetail.message, expectedDetail.message, "Exception message mismatch at index \(index)")
            XCTAssertEqual(exceptionDetail.signal, expectedDetail.signal, "Signal mismatch at index \(index)")
            XCTAssertEqual(exceptionDetail.threadName, expectedDetail.threadName, "Thread name mismatch at index \(index)")
            XCTAssertEqual(exceptionDetail.threadSequence, expectedDetail.threadSequence, "Thread sequence mismatch at index \(index)")
            XCTAssertEqual(exceptionDetail.osBuildNumber, expectedDetail.osBuildNumber, "OS build number mismatch at index \(index)")

            XCTAssertEqual(exceptionDetail.frames?.count, expectedDetail.frames?.count, "Stack frames count mismatch at index \(index)")
            for (frameIndex, frame) in (exceptionDetail.frames ?? []).enumerated() {
                let expectedFrame = (expectedDetail.frames ?? [])[frameIndex]
                XCTAssertEqual(frame.binaryName, expectedFrame.binaryName, "Binary name mismatch in frame \(frameIndex) of exception \(index)")
                XCTAssertEqual(frame.binaryAddress, expectedFrame.binaryAddress, "Binary address mismatch in frame \(frameIndex) of exception \(index)")
                XCTAssertEqual(frame.offset, expectedFrame.offset, "Offset mismatch in frame \(frameIndex) of exception \(index)")
                XCTAssertEqual(frame.frameIndex, expectedFrame.frameIndex, "Frame index mismatch in frame \(frameIndex) of exception \(index)")
                XCTAssertEqual(frame.symbolAddress, expectedFrame.symbolAddress, "Symbol address mismatch in frame \(frameIndex) of exception \(index)")
                XCTAssertEqual(frame.inApp, expectedFrame.inApp, "In-app flag mismatch in frame \(frameIndex) of exception \(index)")
            }
        }

        XCTAssertEqual(exception.threads?.count, exceptionJson.threads?.count, "Thread details count mismatch")
        for (index, thread) in (exception.threads ?? []).enumerated() {
            let expectedThread = (exceptionJson.threads ?? [])[index]
            XCTAssertEqual(thread.name, expectedThread.name, "Thread name mismatch at index \(index)")
            XCTAssertEqual(thread.sequence, expectedThread.sequence, "Thread sequence mismatch at index \(index)")
            XCTAssertEqual(thread.frames.count, expectedThread.frames.count, "Thread frames count mismatch at index \(index)")
            for (frameIndex, frame) in thread.frames.enumerated() {
                let expectedFrame = expectedThread.frames[frameIndex]
                XCTAssertEqual(frame.binaryName, expectedFrame.binaryName, "Binary name mismatch in frame \(frameIndex) of thread \(index)")
                XCTAssertEqual(frame.binaryAddress, expectedFrame.binaryAddress, "Binary address mismatch in frame \(frameIndex) of thread \(index)")
                XCTAssertEqual(frame.offset, expectedFrame.offset, "Offset mismatch in frame \(frameIndex) of thread \(index)")
                XCTAssertEqual(frame.frameIndex, expectedFrame.frameIndex, "Frame index mismatch in frame \(frameIndex) of thread \(index)")
                XCTAssertEqual(frame.symbolAddress, expectedFrame.symbolAddress, "Symbol address mismatch in frame \(frameIndex) of thread \(index)")
                XCTAssertEqual(frame.inApp, expectedFrame.inApp, "In-app flag mismatch in frame \(frameIndex) of thread \(index)")
            }
        }

        XCTAssertEqual(exception.binaryImages?.count, exceptionJson.binaryImages?.count, "Binary images count mismatch")
        for (index, binaryImage) in (exception.binaryImages ?? []).enumerated() {
            let expectedBinaryImage = (exceptionJson.binaryImages ?? [])[index]
            XCTAssertEqual(binaryImage.startAddress, expectedBinaryImage.startAddress, "Start address mismatch for binary image \(index)")
            XCTAssertEqual(binaryImage.endAddress, expectedBinaryImage.endAddress, "End address mismatch for binary image \(index)")
            XCTAssertEqual(binaryImage.system, expectedBinaryImage.system, "System flag mismatch for binary image \(index)")
            XCTAssertEqual(binaryImage.name, expectedBinaryImage.name, "Name mismatch for binary image \(index)")
            XCTAssertEqual(binaryImage.arch, expectedBinaryImage.arch, "Arch mismatch for binary image \(index)")
            XCTAssertEqual(binaryImage.uuid, expectedBinaryImage.uuid, "UUID mismatch for binary image \(index)")
            XCTAssertEqual(binaryImage.path, expectedBinaryImage.path, "Path mismatch for binary image \(index)")
        }
    }

    func testAbort() { // swiftlint:disable:this function_body_length
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

        XCTAssertEqual(exception.handled, exceptionJson.handled, "Handled field mismatch")
        XCTAssertEqual(exception.foreground, exceptionJson.foreground, "Foreground field mismatch")

        XCTAssertEqual(exception.exceptions.count, exceptionJson.exceptions.count, "Exception details count mismatch")
        for (index, exceptionDetail) in exception.exceptions.enumerated() {
            let expectedDetail = exceptionJson.exceptions[index]
            XCTAssertEqual(exceptionDetail.type, expectedDetail.type, "Exception type mismatch at index \(index)")
            XCTAssertEqual(exceptionDetail.message, expectedDetail.message, "Exception message mismatch at index \(index)")
            XCTAssertEqual(exceptionDetail.signal, expectedDetail.signal, "Signal mismatch at index \(index)")
            XCTAssertEqual(exceptionDetail.threadName, expectedDetail.threadName, "Thread name mismatch at index \(index)")
            XCTAssertEqual(exceptionDetail.threadSequence, expectedDetail.threadSequence, "Thread sequence mismatch at index \(index)")
            XCTAssertEqual(exceptionDetail.osBuildNumber, expectedDetail.osBuildNumber, "OS build number mismatch at index \(index)")

            XCTAssertEqual(exceptionDetail.frames?.count, expectedDetail.frames?.count, "Stack frames count mismatch at index \(index)")
            for (frameIndex, frame) in (exceptionDetail.frames ?? []).enumerated() {
                let expectedFrame = (expectedDetail.frames ?? [])[frameIndex]
                XCTAssertEqual(frame.binaryName, expectedFrame.binaryName, "Binary name mismatch in frame \(frameIndex) of exception \(index)")
                XCTAssertEqual(frame.binaryAddress, expectedFrame.binaryAddress, "Binary address mismatch in frame \(frameIndex) of exception \(index)")
                XCTAssertEqual(frame.offset, expectedFrame.offset, "Offset mismatch in frame \(frameIndex) of exception \(index)")
                XCTAssertEqual(frame.frameIndex, expectedFrame.frameIndex, "Frame index mismatch in frame \(frameIndex) of exception \(index)")
                XCTAssertEqual(frame.symbolAddress, expectedFrame.symbolAddress, "Symbol address mismatch in frame \(frameIndex) of exception \(index)")
                XCTAssertEqual(frame.inApp, expectedFrame.inApp, "In-app flag mismatch in frame \(frameIndex) of exception \(index)")
            }
        }

        XCTAssertEqual(exception.threads?.count, exceptionJson.threads?.count, "Thread details count mismatch")
        for (index, thread) in (exception.threads ?? []).enumerated() {
            let expectedThread = (exceptionJson.threads ?? [])[index]
            XCTAssertEqual(thread.name, expectedThread.name, "Thread name mismatch at index \(index)")
            XCTAssertEqual(thread.sequence, expectedThread.sequence, "Thread sequence mismatch at index \(index)")
            XCTAssertEqual(thread.frames.count, expectedThread.frames.count, "Thread frames count mismatch at index \(index)")
            for (frameIndex, frame) in thread.frames.enumerated() {
                let expectedFrame = expectedThread.frames[frameIndex]
                XCTAssertEqual(frame.binaryName, expectedFrame.binaryName, "Binary name mismatch in frame \(frameIndex) of thread \(index)")
                XCTAssertEqual(frame.binaryAddress, expectedFrame.binaryAddress, "Binary address mismatch in frame \(frameIndex) of thread \(index)")
                XCTAssertEqual(frame.offset, expectedFrame.offset, "Offset mismatch in frame \(frameIndex) of thread \(index)")
                XCTAssertEqual(frame.frameIndex, expectedFrame.frameIndex, "Frame index mismatch in frame \(frameIndex) of thread \(index)")
                XCTAssertEqual(frame.symbolAddress, expectedFrame.symbolAddress, "Symbol address mismatch in frame \(frameIndex) of thread \(index)")
                XCTAssertEqual(frame.inApp, expectedFrame.inApp, "In-app flag mismatch in frame \(frameIndex) of thread \(index)")
            }
        }

        XCTAssertEqual(exception.binaryImages?.count, exceptionJson.binaryImages?.count, "Binary images count mismatch")
        for (index, binaryImage) in (exception.binaryImages ?? []).enumerated() {
            let expectedBinaryImage = (exceptionJson.binaryImages ?? [])[index]
            XCTAssertEqual(binaryImage.startAddress, expectedBinaryImage.startAddress, "Start address mismatch for binary image \(index)")
            XCTAssertEqual(binaryImage.endAddress, expectedBinaryImage.endAddress, "End address mismatch for binary image \(index)")
            XCTAssertEqual(binaryImage.system, expectedBinaryImage.system, "System flag mismatch for binary image \(index)")
            XCTAssertEqual(binaryImage.name, expectedBinaryImage.name, "Name mismatch for binary image \(index)")
            XCTAssertEqual(binaryImage.arch, expectedBinaryImage.arch, "Arch mismatch for binary image \(index)")
            XCTAssertEqual(binaryImage.uuid, expectedBinaryImage.uuid, "UUID mismatch for binary image \(index)")
            XCTAssertEqual(binaryImage.path, expectedBinaryImage.path, "Path mismatch for binary image \(index)")
        }
    }
}
