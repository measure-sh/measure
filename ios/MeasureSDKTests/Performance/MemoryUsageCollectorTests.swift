//
//  MemoryUsageCollectorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 11/11/24.
//

import XCTest
@testable import MeasureSDK

final class MemoryUsageCollectorTests: XCTestCase {
    private var memoryUsageCollector: BaseMemoryUsageCollector!
    private var mockLogger: MockLogger!
    private var mockConfigProvider: MockConfigProvider!
    private var mockEventProcessor: MockEventProcessor!
    private var mockTimeProvider: MockTimeProvider!
    private var mockMemoryUsageCalculator: MockMemoryUsageCalculator!
    private var mockSysCtl: MockSysCtl!

    override func setUp() {
        super.setUp()
        mockLogger = MockLogger()
        mockConfigProvider = MockConfigProvider()
        mockEventProcessor = MockEventProcessor()
        mockTimeProvider = MockTimeProvider()
        mockMemoryUsageCalculator = MockMemoryUsageCalculator()
        mockSysCtl = MockSysCtl()
        memoryUsageCollector = BaseMemoryUsageCollector(
            logger: mockLogger,
            configProvider: mockConfigProvider,
            eventProcessor: mockEventProcessor,
            timeProvider: mockTimeProvider,
            memoryUsageCalaculator: mockMemoryUsageCalculator,
            sysCtl: mockSysCtl
        )
    }

    func testEnableStartsTimerOnce() {
        memoryUsageCollector.enable()
        XCTAssertEqual(mockLogger.logs.count, 1)
        XCTAssertEqual(mockLogger.logs.first, "MemoryUsageCollector enabled.")

        memoryUsageCollector.enable()
        XCTAssertEqual(mockLogger.logs.count, 1, "Enable should not create multiple timers.")
    }

    func testResumeStartsTimerIfNotRunning() {
        memoryUsageCollector.resume()
        XCTAssertEqual(mockLogger.logs.count, 1)
        XCTAssertEqual(mockLogger.logs.first, "MemoryUsageCollector resumed.")
    }

    func testResumeDoesNotStartTimerIfAlreadyRunning() {
        memoryUsageCollector.enable()
        memoryUsageCollector.resume()

        XCTAssertEqual(mockLogger.logs.count, 1, "Resume should not create additional timers if one is already running.")
    }

    func testPauseStopsTimerAndLogsMessage() {
        memoryUsageCollector.enable()
        memoryUsageCollector.pause()

        XCTAssertEqual(mockLogger.logs.count, 2)
        XCTAssertEqual(mockLogger.logs.last, "MemoryUsageCollector paused.")
    }

    func testPauseWithoutTimerDoesNotCrash() {
        memoryUsageCollector.pause()

        XCTAssertEqual(mockLogger.logs.count, 0, "Pause without timer should not log.")
    }

    func testTrackMemoryUsageValidData() {
        mockMemoryUsageCalculator.mockMemoryUsage = 1024
        mockSysCtl.mockMaximumAvailableRam = 4096
        mockConfigProvider.memoryTrackingIntervalMs = 2000
        mockTimeProvider.current = 1_000_000
        let expectedTimestamp = mockTimeProvider.now()

        memoryUsageCollector.trackMemoryUsage()

        XCTAssertNotNil(mockEventProcessor.data)
        if let memoryUsageData = mockEventProcessor.data as? MemoryUsageData {
            XCTAssertEqual(memoryUsageData.maxMemory, 4096)
            XCTAssertEqual(memoryUsageData.usedMemory, 1024)
            XCTAssertEqual(memoryUsageData.interval, mockConfigProvider.memoryTrackingIntervalMs)
        } else {
            XCTFail("Data should be of type MemoryUsageData.")
        }
        XCTAssertEqual(mockEventProcessor.timestamp, expectedTimestamp)
        XCTAssertEqual(mockEventProcessor.type, .memoryUsageAbsolute)
    }

    func testTrackMemoryUsageErrorData() {
        mockMemoryUsageCalculator.mockMemoryUsage = nil

        memoryUsageCollector.trackMemoryUsage()

        XCTAssertNil(mockEventProcessor.data, "No event should be tracked if memory usage is -1.")
        XCTAssertEqual(mockLogger.logs.last, "Could not get memory usage data.")
    }
}
