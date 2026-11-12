//
//  PeriodicExporterTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 10/11/26.
//

import XCTest
@testable import Measure

final class PeriodicExporterTests: XCTestCase {
    private let intervalMs: Number = 20
    private var exporter: MockExporter!
    private var queue: DispatchQueue!
    private var periodicExporter: BasePeriodicExporter!

    override func setUp() {
        super.setUp()
        exporter = MockExporter()
        queue = DispatchQueue(label: "sh.measure.tests.periodic.exporter")
        periodicExporter = BasePeriodicExporter(logger: MockLogger(),
                                                configProvider: MockConfigProvider(debugExportIntervalMs: intervalMs),
                                                exporter: exporter,
                                                dispatchQueue: queue)
    }

    override func tearDown() {
        periodicExporter.stop()
        queue.sync {}
        periodicExporter = nil
        exporter = nil
        queue = nil
        super.tearDown()
    }

    func testExportsAtIntervalWhenStarted() {
        periodicExporter.start()

        waitForIntervals(5)

        XCTAssertGreaterThanOrEqual(exportCallCount(), 2)
    }

    func testDoesNotExportBeforeFirstIntervalElapses() {
        let slowExporter = BasePeriodicExporter(logger: MockLogger(),
                                                configProvider: MockConfigProvider(debugExportIntervalMs: 60_000),
                                                exporter: exporter,
                                                dispatchQueue: queue)
        slowExporter.start()

        waitForIntervals(3)

        XCTAssertEqual(exportCallCount(), 0)
        slowExporter.stop()
    }

    func testStopsExportingWhenMeasureIsStopped() {
        periodicExporter.start()
        waitForIntervals(3)

        periodicExporter.stop()
        let countAfterStop = exportCallCount()
        waitForIntervals(5)

        XCTAssertEqual(exportCallCount(), countAfterStop)
    }

    func testResumesExportingWhenRestartedAfterStop() {
        periodicExporter.start()
        periodicExporter.stop()
        let countAfterStop = exportCallCount()

        periodicExporter.start()
        waitForIntervals(5)

        XCTAssertGreaterThan(exportCallCount(), countAfterStop)
    }

    func testDoesNotExportWhenStartedInBackground() {
        periodicExporter.setInForeground(false)

        periodicExporter.start()
        waitForIntervals(5)

        XCTAssertEqual(exportCallCount(), 0)
    }

    func testStopsExportingWhenAppGoesToBackground() {
        periodicExporter.start()
        waitForIntervals(3)

        periodicExporter.setInForeground(false)
        let countAfterBackground = exportCallCount()
        waitForIntervals(5)

        XCTAssertEqual(exportCallCount(), countAfterBackground)
    }

    func testResumesExportingWhenAppReturnsToForeground() {
        periodicExporter.setInForeground(false)
        periodicExporter.start()

        periodicExporter.setInForeground(true)
        waitForIntervals(5)

        XCTAssertGreaterThanOrEqual(exportCallCount(), 2)
    }

    func testDoesNotExportOnForegroundWhenNotStarted() {
        periodicExporter.setInForeground(true)
        waitForIntervals(5)

        XCTAssertEqual(exportCallCount(), 0)
    }

    private func waitForIntervals(_ count: Int) {
        Thread.sleep(forTimeInterval: TimeInterval(intervalMs * Number(count)) / 1000)
    }

    private func exportCallCount() -> Int {
        queue.sync { exporter.exportCallCount }
    }
}
