//
//  periodicExporterTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 21/10/24.
//

import XCTest
@testable import Measure

final class PeriodicExporterTests: XCTestCase {
    private var logger: MockLogger!
    private var configProvider: MockConfigProvider!
    private var timeProvider: MockTimeProvider!
    private var heartbeat: MockHeartbeat!
    private var exporter: MockExporter!
    private var periodicExporter: BasePeriodicExporter!

    override func setUp() {
        super.setUp()
        logger = MockLogger()
        configProvider = MockConfigProvider(maxExportJitterInterval: 0)
        timeProvider = MockTimeProvider()
        heartbeat = MockHeartbeat()
        exporter = MockExporter()

        periodicExporter = BasePeriodicExporter(logger: logger,
                                                configProvider: configProvider,
                                                timeProvider: timeProvider,
                                                heartbeat: heartbeat,
                                                exporter: exporter,
                                                dispatchQueue: MeasureQueue.periodicEventExporter)
        periodicExporter.enable()
    }

    override func tearDown() {
        logger = nil
        configProvider = nil
        timeProvider = nil
        heartbeat = nil
        exporter = nil
        periodicExporter = nil
        super.tearDown()
    }

    func testApplicationWillEnterForeground_startsHeartbeat() {
        periodicExporter.applicationWillEnterForeground()

        XCTAssertTrue(heartbeat.isStarted)
        XCTAssertEqual(heartbeat.startIntervalMs, configProvider.eventsBatchingIntervalMs)
    }

    func testApplicationDidEnterBackground_stopsHeartbeatAndExportsEvents() {
        heartbeat.start(intervalMs: 100, initialDelayMs: 0)

        periodicExporter.applicationDidEnterBackground()

        XCTAssertTrue(heartbeat.isStopped)
    }

    func testExportEvents_skipsIfExportInProgress() {
        periodicExporter.isExportInProgress = true

        periodicExporter.applicationDidEnterBackground()

        XCTAssertFalse(exporter.exportEventsCalled, "Export events should not be called if export is already in progress.")
    }

    func testProcessNewBatchIfTimeElapsed_doesNotCreateBatchIfIntervalNotElapsed() {
        let batchingIntervalMs: Int64 = 1000
        timeProvider.millisTime = 1500
        periodicExporter.lastBatchCreationUptimeMs = 1000
        configProvider.eventsBatchingIntervalMs = batchingIntervalMs

        periodicExporter.pulse()

        XCTAssertFalse(exporter.createBatchCalled)
    }
}
