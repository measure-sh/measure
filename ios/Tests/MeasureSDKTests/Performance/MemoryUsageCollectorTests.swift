//
//  MemoryUsageCollectorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 11/11/24.
//

import XCTest
@testable import Measure

final class MemoryUsageCollectorTests: XCTestCase {
    private var memoryUsageCollector: BaseMemoryUsageCollector!
    private var mockLogger: MockLogger!
    private var mockConfigProvider: MockConfigProvider!
    private var mockSignalProcessor: MockSignalProcessor!
    private var mockTimeProvider: MockTimeProvider!
    private var mockMemoryUsageCalculator: MockMemoryUsageCalculator!
    private var mockSysCtl: MockSysCtl!

    override func setUp() {
        super.setUp()
        mockLogger = MockLogger()
        mockConfigProvider = MockConfigProvider()
        mockSignalProcessor = MockSignalProcessor()
        mockTimeProvider = MockTimeProvider()
        mockMemoryUsageCalculator = MockMemoryUsageCalculator()
        mockSysCtl = MockSysCtl()
        memoryUsageCollector = BaseMemoryUsageCollector(logger: mockLogger,
                                                        configProvider: mockConfigProvider,
                                                        signalProcessor: mockSignalProcessor,
                                                        timeProvider: mockTimeProvider,
                                                        memoryUsageCalculator: mockMemoryUsageCalculator,
                                                        sysCtl: mockSysCtl)
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
        XCTAssertEqual(mockLogger.logs.count, 0)
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
        mockConfigProvider.memoryUsageInterval = 2000
        mockTimeProvider.current = 1_000_000
        let expectedTimestamp = mockTimeProvider.now()

        memoryUsageCollector.trackMemoryUsage()

        XCTAssertNotNil(mockSignalProcessor.data)
        if let memoryUsageData = mockSignalProcessor.data as? MemoryUsageData {
            XCTAssertEqual(memoryUsageData.maxMemory, 4096)
            XCTAssertEqual(memoryUsageData.usedMemory, 1024)
        } else {
            XCTFail("Data should be of type MemoryUsageData.")
        }
        XCTAssertEqual(mockSignalProcessor.timestamp, expectedTimestamp)
        XCTAssertEqual(mockSignalProcessor.type, .memoryUsageAbsolute)
    }

    func testTrackMemoryUsageErrorData() {
        mockMemoryUsageCalculator.mockMemoryUsage = nil

        memoryUsageCollector.trackMemoryUsage()

        XCTAssertNil(mockSignalProcessor.data, "No event should be tracked if memory usage is -1.")
        XCTAssertEqual(mockLogger.logs.last, "Could not get memory usage data.")
    }
}
