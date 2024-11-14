//
//  CpuUsageCollectorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 11/11/24.
//

import XCTest
@testable import MeasureSDK

final class CpuUsageCollectorTests: XCTestCase {
    private var cpuUsageCollector: BaseCpuUsageCollector!
    private var mockLogger: MockLogger!
    private var mockConfigProvider: MockConfigProvider!
    private var mockEventProcessor: MockEventProcessor!
    private var mockTimeProvider: MockTimeProvider!
    private var mockCpuUsageCalculator: MockCpuUsageCalculator!
    private var mockSysCtl: MockSysCtl!

    override func setUp() {
        super.setUp()
        mockLogger = MockLogger()
        mockConfigProvider = MockConfigProvider()
        mockEventProcessor = MockEventProcessor()
        mockTimeProvider = MockTimeProvider()
        mockCpuUsageCalculator = MockCpuUsageCalculator()
        mockSysCtl = MockSysCtl()
        cpuUsageCollector = BaseCpuUsageCollector(
            logger: mockLogger,
            configProvider: mockConfigProvider,
            eventProcessor: mockEventProcessor,
            timeProvider: mockTimeProvider,
            cpuUsageCalculator: mockCpuUsageCalculator,
            sysCtl: mockSysCtl
        )
    }

    func testEnableStartsTimerOnce() {
        cpuUsageCollector.enable()
        XCTAssertEqual(mockLogger.logs.count, 1)
        XCTAssertEqual(mockLogger.logs.first, "CpuUsageCollector enabled.")

        cpuUsageCollector.enable()
        XCTAssertEqual(mockLogger.logs.count, 1, "Enable should not create multiple timers.")
    }

    func testResumeStartsTimerIfNotRunning() {
        cpuUsageCollector.resume()
        XCTAssertEqual(mockLogger.logs.count, 1)
        XCTAssertEqual(mockLogger.logs.first, "CpuUsageCollector resumed.")
    }

    func testResumeDoesNotStartTimerIfAlreadyRunning() {
        cpuUsageCollector.enable()
        cpuUsageCollector.resume()

        XCTAssertEqual(mockLogger.logs.count, 1, "Resume should not create additional timers if one is already running.")
    }

    func testPauseStopsTimerAndLogsMessage() {
        cpuUsageCollector.enable()
        cpuUsageCollector.pause()

        XCTAssertEqual(mockLogger.logs.count, 2)
        XCTAssertEqual(mockLogger.logs.last, "CpuUsageCollector paused.")
    }

    func testPauseWithoutTimerDoesNotCrash() {
        cpuUsageCollector.pause()

        XCTAssertEqual(mockLogger.logs.count, 0, "Pause without timer should not log.")
    }

    func testTrackCpuUsageValidData() {
        mockCpuUsageCalculator.mockCpuUsage = 25.5
        mockSysCtl.mockCpuCores = 4
        mockSysCtl.mockCpuFrequency = 2500
        mockConfigProvider.cpuTrackingIntervalMs = 1000
        mockTimeProvider.current = 1_000_000
        let expectedTimestamp = mockTimeProvider.now()

        cpuUsageCollector.trackCpuUsage()

        XCTAssertNotNil(mockEventProcessor.data)
        if let cpuUsageData = mockEventProcessor.data as? CpuUsageData {
            XCTAssertEqual(cpuUsageData.numCores, 4)
            XCTAssertEqual(cpuUsageData.clockSpeed, 2500)
            XCTAssertEqual(cpuUsageData.percentageUsage, 25.5)
            XCTAssertEqual(cpuUsageData.interval, mockConfigProvider.cpuTrackingIntervalMs)
        } else {
            XCTFail("Data should be of type CpuUsageData.")
        }
        XCTAssertEqual(mockEventProcessor.timestamp, expectedTimestamp)
        XCTAssertEqual(mockEventProcessor.type, .cpuUsage)
    }

    func testTrackCpuUsageErrorData() {
        mockCpuUsageCalculator.mockCpuUsage = -1

        cpuUsageCollector.trackCpuUsage()

        XCTAssertNil(mockEventProcessor.data, "No event should be tracked if CPU usage is -1.")
        XCTAssertEqual(mockLogger.logs.last, "Could not get CPU usage data.")
    }
}
