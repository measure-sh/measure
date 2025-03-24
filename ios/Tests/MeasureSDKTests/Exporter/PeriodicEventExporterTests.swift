//
//  PeriodicEventExporterTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 21/10/24.
//

import XCTest
@testable import Measure

final class PeriodicEventExporterTests: XCTestCase {
    private var logger: MockLogger!
    private var configProvider: MockConfigProvider!
    private var timeProvider: MockTimeProvider!
    private var heartbeat: MockHeartbeat!
    private var eventExporter: MockEventExporter!
    private var periodicEventExporter: BasePeriodicEventExporter!

    override func setUp() {
        super.setUp()
        logger = MockLogger()
        configProvider = MockConfigProvider()
        timeProvider = MockTimeProvider()
        heartbeat = MockHeartbeat()
        eventExporter = MockEventExporter()

        periodicEventExporter = BasePeriodicEventExporter(logger: logger,
                                                           configProvider: configProvider,
                                                           timeProvider: timeProvider,
                                                           heartbeat: heartbeat,
                                                           eventExporter: eventExporter,
                                                           dispatchQueue: MeasureQueue.periodicEventExporter)
    }

    override func tearDown() {
        logger = nil
        configProvider = nil
        timeProvider = nil
        heartbeat = nil
        eventExporter = nil
        periodicEventExporter = nil
        super.tearDown()
    }

    func testApplicationWillEnterForeground_startsHeartbeat() {
        configProvider.eventsBatchingIntervalMs = 1000

        periodicEventExporter.applicationWillEnterForeground()

        XCTAssertTrue(heartbeat.isStarted)
        XCTAssertEqual(heartbeat.startIntervalMs, configProvider.eventsBatchingIntervalMs)
    }

    func testApplicationDidEnterBackground_stopsHeartbeatAndExportsEvents() {
        heartbeat.start(intervalMs: 100, initialDelayMs: 0)

        periodicEventExporter.applicationDidEnterBackground()

        XCTAssertTrue(heartbeat.isStopped)
    }

    func testExportEvents_skipsIfExportInProgress() {
        periodicEventExporter.isExportInProgress = true

        periodicEventExporter.applicationDidEnterBackground()

        XCTAssertFalse(eventExporter.exportEventsCalled, "Export events should not be called if export is already in progress.")
    }

    func testProcessNewBatchIfTimeElapsed_createsAndExportsBatch() {
        let batchingIntervalMs: Int64 = 1000
        timeProvider.millisTime = 2000
        configProvider.eventsBatchingIntervalMs = batchingIntervalMs
        eventExporter.createBatchResult = BatchCreationResult(batchId: "testBatch", eventIds: ["event1", "event2"])

        periodicEventExporter.applicationWillEnterForeground()
        periodicEventExporter.pulse()

        XCTAssertEqual(eventExporter.createBatchCalled, true)
        XCTAssertEqual(eventExporter.exportBatchId, "testBatch")
    }

    func testProcessNewBatchIfTimeElapsed_doesNotCreateBatchIfIntervalNotElapsed() {
        let batchingIntervalMs: Int64 = 1000
        timeProvider.millisTime = 1500
        periodicEventExporter.lastBatchCreationUptimeMs = 1000
        configProvider.eventsBatchingIntervalMs = batchingIntervalMs

        periodicEventExporter.pulse()

        XCTAssertFalse(eventExporter.createBatchCalled)
    }
}
