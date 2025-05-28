//
//  InternalSignalCollectorTests.swift
//  MeasureSDK
//
//  Created by Abhay Sood on 14/04/25.
//

import XCTest
@testable import Measure

final class BaseInternalSignalCollectorTests: XCTestCase {
    private var logger: MockLogger!
    private var signalProcessor: MockSignalProcessor!
    private var eventCollector: BaseInternalSignalCollector!
    private var fileManagerHelper = FileManagerHelper()

    override func setUp() {
        super.setUp()

        logger = MockLogger()
        signalProcessor = MockSignalProcessor()

        eventCollector = BaseInternalSignalCollector(
            logger: logger,
            signalProcessor: signalProcessor
        )
    }

    func testTrackEvent_withoutPlatformAttribute_logsWarning() {
        eventCollector.enable()
        var eventData: [String: Any?] = ["key": "value"]
        let type = EventType.custom.rawValue

        eventCollector.trackEvent(
            data: &eventData,
            type: type,
            timestamp: 097654121,
            attributes: [:],
            userDefinedAttrs: [:],
            userTriggered: true,
            sessionId: nil,
            threadName: nil
        )

        XCTAssertNil(signalProcessor.data)
        XCTAssertTrue(logger.logs[1].contains("Platform not found in attributes, cannot process event"))
    }

    func testTrackEvent_tracksCustomEvent() {
        eventCollector.enable()
        var eventData: [String: Any?] = ["name": "custom-event"]
        let type = EventType.custom.rawValue

        eventCollector.trackEvent(
            data: &eventData,
            type: type,
            timestamp: 097654121,
            attributes: [:],
            userDefinedAttrs: [:],
            userTriggered: true,
            sessionId: nil,
            threadName: nil
        )

        XCTAssertNotNil(signalProcessor.data)
    }

    func testTrackEvent_WithInvalidArgument_logsError() {
        eventCollector.enable()
        var eventData: [String: Any?] = [:]
        let type = EventType.custom.rawValue

        eventCollector.trackEvent(
            data: &eventData,
            type: type,
            timestamp: 097654121,
            attributes: ["platform": "flutter"],
            userDefinedAttrs: [:],
            userTriggered: true,
            sessionId: nil,
            threadName: nil
        )

        XCTAssertNil(signalProcessor.data)
        XCTAssertTrue(logger.logs[1].contains("Error processing event"))
    }

    func testTrackEvent_WithObfuscatedFlutterException_tracksExceptionEvent() { // swiftlint:disable:this function_body_length
        eventCollector.enable()
        let type = EventType.exception.rawValue

        guard var eventData = fileManagerHelper.getExceptionDict(fileName: "flutter_obfuscated", fileExtension: "json") else {
            XCTFail("Failed to read JSON file from test bundle.")
            return
        }
        let expectedException = Exception(
            handled: false,
            exceptions: [
                ExceptionDetail(
                    type: nil,
                    message: nil,
                    frames: [
                        StackFrame(
                            binaryName: nil,
                            binaryAddress: nil,
                            offset: nil,
                            frameIndex: 0,
                            symbolAddress: nil,
                            inApp: false,
                            className: nil,
                            methodName: nil,
                            fileName: nil,
                            lineNumber: nil,
                            columnNumber: nil,
                            moduleName: nil,
                            instructionAddress: "0x7af71c4903"
                        ),
                        StackFrame(
                            binaryName: nil,
                            binaryAddress: nil,
                            offset: nil,
                            frameIndex: 1,
                            symbolAddress: nil,
                            inApp: false,
                            className: nil,
                            methodName: nil,
                            fileName: nil,
                            lineNumber: nil,
                            columnNumber: nil,
                            moduleName: nil,
                            instructionAddress: "0x7af71c48cf"
                        )
                    ],
                    signal: nil,
                    threadName: nil,
                    threadSequence: 0,
                    osBuildNumber: nil
                )
            ],
            foreground: true,
            threads: [],
            binaryImages: nil,
            framework: "ios"
        )

        eventCollector.trackEvent(
            data: &eventData,
            type: type,
            timestamp: 097654121,
            attributes: ["platform": "flutter"],
            userDefinedAttrs: [:],
            userTriggered: true,
            sessionId: nil,
            threadName: nil
        )

        XCTAssertNotNil(signalProcessor.data)
        guard let data = signalProcessor.data as? Exception else {
            XCTFail("Data is not of type Exception")
            return
        }
        XCTAssertEqual(data, expectedException)
    }
    
    func testTrackEvent_WithUnobfuscatedFlutterException_tracksExceptionEvent() {
        eventCollector.enable()
        let type = EventType.exception.rawValue
        
        guard var eventData = fileManagerHelper.getExceptionDict(fileName: "flutter_unobfuscated", fileExtension: "json") else {
            XCTFail("Failed to read JSON file from test bundle.")
            return
        }
        let expectedException = Exception(
            handled: false,
            exceptions: [
                ExceptionDetail(
                    type: nil,
                    message: nil,
                    frames: [
                        StackFrame(
                            binaryName: nil,
                            binaryAddress: nil,
                            offset: nil,
                            frameIndex: 0,
                            symbolAddress: nil,
                            inApp: false,
                            className: "_MyAppState",
                            methodName: "_throwException",
                            fileName: "main.dart",
                            lineNumber: 84,
                            columnNumber: 5,
                            moduleName: "package:measure_flutter_example/",
                            instructionAddress: nil
                        ),
                        StackFrame(
                            binaryName: nil,
                            binaryAddress: nil,
                            offset: nil,
                            frameIndex: 1,
                            symbolAddress: nil,
                            inApp: false,
                            className: "_InkResponseState",
                            methodName: "handleTap",
                            fileName: "ink_well.dart",
                            lineNumber: 1176,
                            columnNumber: 21,
                            moduleName: "package:flutter/src/material/",
                            instructionAddress: nil
                        ),
                        StackFrame(
                            binaryName: nil,
                            binaryAddress: nil,
                            offset: nil,
                            frameIndex: 2,
                            symbolAddress: nil,
                            inApp: false,
                            className: nil,
                            methodName: "_invoke1",
                            fileName: "hooks.dart",
                            lineNumber: 330,
                            columnNumber: 10,
                            moduleName: "dart:ui/",
                            instructionAddress: nil
                        )
                    ],
                    signal: nil,
                    threadName: nil,
                    threadSequence: 0,
                    osBuildNumber: nil
                )
            ],
            foreground: true,
            threads: [],
            binaryImages: nil,
            framework: "ios"
        )

        eventCollector.trackEvent(
            data: &eventData,
            type: type,
            timestamp: 097654121,
            attributes: [:],
            userDefinedAttrs: [:],
            userTriggered: true,
            sessionId: nil,
            threadName: nil
        )

        XCTAssertNotNil(signalProcessor.data)
        guard let data = signalProcessor.data as? Exception else {
            XCTFail("Data is not of type Exception")
            return
        }
        XCTAssertEqual(data, expectedException)
    }

    func testTrackEvent_WithExceptionEvent_updatesForgroundProperty() {
        eventCollector.enable()
        let type = EventType.exception.rawValue

        guard var eventData = fileManagerHelper.getExceptionDict(fileName: "flutter_background", fileExtension: "json") else {
            XCTFail("Failed to read JSON file from test bundle.")
            return
        }

        eventCollector.trackEvent(
            data: &eventData,
            type: type,
            timestamp: 097654121,
            attributes: ["platform": "flutter"],
            userDefinedAttrs: [:],
            userTriggered: true,
            sessionId: nil,
            threadName: nil
        )

        XCTAssertNotNil(signalProcessor.data)
        guard let data = signalProcessor.data as? Exception else {
            XCTFail("Data is not of type Exception")
            return
        }
        XCTAssertEqual(data.foreground, true)
    }
}
