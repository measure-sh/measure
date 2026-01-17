//
//  MeasureInternalTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 31/03/25.
//

import XCTest
@testable import Measure

final class MeasureInternalTests: XCTestCase {
    private var mockMeasureInitializer: MockMeasureInitializer!
    private var measureInternal: MeasureInternal!

    override func setUp() {
        super.setUp()
        mockMeasureInitializer = MockMeasureInitializer(configProvider: MockConfigProvider(autoStart: false))
        measureInternal = MeasureInternal(mockMeasureInitializer)
    }

    override func tearDown() {
        measureInternal = nil
        mockMeasureInitializer = nil
        super.tearDown()
    }

    func testInitialization_logsInitializationMessage() {
        guard let logger = mockMeasureInitializer.logger as? MockLogger else {
            XCTFail("Unexpected logger type.")
            return
        }
        XCTAssertTrue(logger.logs.contains("Initializing Measure SDK"))
    }

    func testStart_logsStartMessage() {
        measureInternal.start()
        guard let logger = mockMeasureInitializer.logger as? MockLogger else {
            XCTFail("Unexpected logger type.")
            return
        }
        XCTAssertTrue(logger.logs.contains("Starting Measure SDK"))
    }

    func testStop_logsStopMessage() {
        measureInternal.start()
        measureInternal.stop()
        guard let logger = mockMeasureInitializer.logger as? MockLogger else {
            XCTFail("Unexpected logger type.")
            return
        }
        XCTAssertTrue(logger.logs.contains("Starting Measure SDK"))
        XCTAssertTrue(logger.logs.contains("Stopping Measure SDK"))
    }

    func testStart_registersCollectors() {
        measureInternal.start()
        guard let logger = mockMeasureInitializer.logger as? MockLogger else {
            XCTFail("Unexpected logger type.")
            return
        }
        XCTAssertTrue(logger.logs.contains("CustomEventCollector enabled."))
        XCTAssertTrue(logger.logs.contains("CpuUsageCollector enabled."))
        XCTAssertTrue(logger.logs.contains("CustomEventCollector enabled."))
        XCTAssertTrue(logger.logs.contains("UserTriggeredEventCollector enabled."))
        XCTAssertTrue(logger.logs.contains("CpuUsageCollector enabled."))
        XCTAssertTrue(logger.logs.contains("MemoryUsageCollector enabled."))
        XCTAssertTrue(logger.logs.contains("HttpEventCollector enabled."))
        XCTAssertTrue(logger.logs.contains("NetworkChangeCollector enabled."))
        XCTAssertTrue(logger.logs.contains("AppLaunchCollector enabled."))
        XCTAssertTrue(logger.logs.contains("LifecycleCollector enabled."))
        XCTAssertTrue(logger.logs.contains("InternalEventCollector enabled."))
        // PLCrashReportor fails to get initalized in testing environment and throws an error. Hence this condition.
        //
        XCTAssertTrue(logger.logs.contains("Failed to enable crash reporter."))
    }

    func testStop_unregistersCollectors() {
        measureInternal.start()
        measureInternal.stop()
        guard let logger = mockMeasureInitializer.logger as? MockLogger else {
            XCTFail("Unexpected logger type.")
            return
        }
        XCTAssertTrue(logger.logs.contains("CustomEventCollector disabled."))
        XCTAssertTrue(logger.logs.contains("CpuUsageCollector disabled."))
        XCTAssertTrue(logger.logs.contains("CustomEventCollector disabled."))
        XCTAssertTrue(logger.logs.contains("UserTriggeredEventCollector disabled."))
        XCTAssertTrue(logger.logs.contains("CpuUsageCollector disabled."))
        XCTAssertTrue(logger.logs.contains("MemoryUsageCollector disabled."))
        XCTAssertTrue(logger.logs.contains("HttpEventCollector disabled."))
        XCTAssertTrue(logger.logs.contains("GestureCollector disabled."))
        XCTAssertTrue(logger.logs.contains("NetworkChangeCollector disabled."))
        XCTAssertTrue(logger.logs.contains("CustomEventCollector disabled."))
        XCTAssertTrue(logger.logs.contains("Crash reporter disabled."))
        XCTAssertTrue(logger.logs.contains("InternalEventCollector disabled."))
    }

    func testStop_alwaysOnCollectors() {
        guard let logger = mockMeasureInitializer.logger as? MockLogger else {
            XCTFail("Unexpected logger type.")
            return
        }
        XCTAssertTrue(logger.logs.contains("AppLaunchCollector enabled."))
    }

    func testStart_setsIsStartedToTrue() {
        measureInternal.start()
        XCTAssertTrue(measureInternal.isStarted, "isStarted should be true after calling start()")
    }

    func testStart_doesNothingIfAlreadyStarted() {
        guard let logger = mockMeasureInitializer.logger as? MockLogger else {
            XCTFail("Unexpected logger type.")
            return
        }
        measureInternal.start()
        logger.logs.removeAll()
        measureInternal.start()
        XCTAssertFalse(logger.logs.contains("Starting Measure SDK"), "start() should not log a message if already started")
    }

    func testStop_setsIsStartedToFalse() {
        measureInternal.start()
        measureInternal.stop()
        XCTAssertFalse(measureInternal.isStarted, "isStarted should be false after calling stop()")
    }

    func testStop_doesNothingIfAlreadyStopped() {
        guard let logger = mockMeasureInitializer.logger as? MockLogger else {
            XCTFail("Unexpected logger type.")
            return
        }
        XCTAssertTrue(logger.logs.contains("Initializing Measure SDK"))
        measureInternal.stop()
        XCTAssertFalse(logger.logs.contains("Stopping Measure SDK"), "stop() should not log a message if not started")
        measureInternal.start()
        measureInternal.stop()
        logger.logs.removeAll()
        measureInternal.stop()
        XCTAssertFalse(logger.logs.contains("Stopping Measure SDK"), "stop() should not log a message if already stopped")
    }

    func testDependentFunctions_returnEarlyIfNotStarted() {
        // Since `isStarted` is now internal, we can directly verify its state.
        XCTAssertFalse(measureInternal.isStarted, "isStarted should be false initially")

        let logger = mockMeasureInitializer.logger as! MockLogger // swiftlint:disable:this force_cast
        logger.logs.removeAll()

        // Test `trackEvent`
        measureInternal.trackEvent(name: "TestEvent", attributes: [:], timestamp: nil)
        XCTAssertFalse(logger.logs.contains(where: { $0.contains("Event processed") }), "trackEvent should not proceed if not started")

        // Test `createSpan`
        let spanBuilder = measureInternal.createSpan(name: "TestSpan")
        XCTAssertNil(spanBuilder, "createSpan should return nil if not started")

        // Test `startSpan`
        let invalidSpan = measureInternal.startSpan(name: "TestSpan")
        XCTAssertTrue(invalidSpan is InvalidSpan, "startSpan should return an InvalidSpan if not started")

        // Test `startBugReportFlow`
        measureInternal.startBugReportFlow(takeScreenshot: false, bugReportConfig: .default)
        XCTAssertFalse(logger.logs.contains("Bug Report Flow Started"), "startBugReportFlow should not proceed if not started")

        // Test `trackBugReport`
        measureInternal.trackBugReport(description: "Bug", attachments: [], attributes: [:])
        XCTAssertFalse(logger.logs.contains(where: { $0.contains("Event processed") }), "trackBugReport should not proceed if not started")

        // Test `captureScreenshot` and `captureLayoutSnapshot`
        let viewController = UIViewController()
        var screenshotAttachment: MsrAttachment?
        measureInternal.captureScreenshot(for: viewController) { attachment in
            screenshotAttachment = attachment
        }
        XCTAssertNil(screenshotAttachment, "captureScreenshot should not create an attachment if not started")

        var layoutAttachment: MsrAttachment?
        measureInternal.captureLayoutSnapshot(for: viewController) { attachment in
            layoutAttachment = attachment
        }
        XCTAssertNil(layoutAttachment, "captureLayoutSnapshot should not create an attachment if not started")

        // Test `trackError`
        measureInternal.trackError(NSError(domain: "Test", code: 1), attributes: [:], collectStackTraces: false)
        XCTAssertFalse(logger.logs.contains(where: { $0.contains("Event processed") }), "trackError should not proceed if not started")
    }
}
