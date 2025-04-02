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
        mockMeasureInitializer = MockMeasureInitializer()
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
        XCTAssertTrue(logger.logs.contains("PeriodicEventExporter enabled."))
        XCTAssertTrue(logger.logs.contains("HttpEventCollector enabled."))
        XCTAssertTrue(logger.logs.contains("NetworkChangeCollector enabled."))
        XCTAssertTrue(logger.logs.contains("AppLaunchCollector enabled."))
        XCTAssertTrue(logger.logs.contains("LifecycleCollector enabled."))
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
        XCTAssertTrue(logger.logs.contains("PeriodicEventExporter disabled."))
        XCTAssertTrue(logger.logs.contains("HttpEventCollector disabled."))
        XCTAssertTrue(logger.logs.contains("GestureCollector disabled."))
        XCTAssertTrue(logger.logs.contains("NetworkChangeCollector disabled."))
        XCTAssertTrue(logger.logs.contains("CustomEventCollector disabled."))
        XCTAssertTrue(logger.logs.contains("Crash reporter disabled."))
    }

    func testStop_alwaysOnCollectors() {
        guard let logger = mockMeasureInitializer.logger as? MockLogger else {
            XCTFail("Unexpected logger type.")
            return
        }
        XCTAssertTrue(logger.logs.contains("AppLaunchCollector enabled."))
    }
}
