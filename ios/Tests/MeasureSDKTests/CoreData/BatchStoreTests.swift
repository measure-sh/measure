//
//  BatchStoreTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 19/10/24.
//

import CoreData
@testable import Measure
import XCTest

final class BatchStoreTests: XCTestCase {
    var batchStore: BatchStore!
    var mockCoreDataManager: MockCoreDataManager!
    var mockLogger: MockLogger!

    override func setUp() {
        super.setUp()
        mockCoreDataManager = MockCoreDataManager()
        mockLogger = MockLogger()
        batchStore = BaseBatchStore(coreDataManager: mockCoreDataManager, logger: mockLogger)
    }

    override func tearDown() {
        batchStore = nil
        mockCoreDataManager = nil
        mockLogger = nil
        super.tearDown()
    }

    func testInsertBatch() {
        let batch1 = BatchEntity(
            batchId: "batch1",
            eventIds: ["event1", "event2"],
            spanIds: ["span1", "span2"],
            createdAt: 1_000_000
        )

        let batch2 = BatchEntity(
            batchId: "batch2",
            eventIds: ["event3", "event4"],
            spanIds: ["span3", "span4"],
            createdAt: 1_000_000
        )

        let success1 = batchStore.insertBatch(batch1)
        let success2 = batchStore.insertBatch(batch2)

        XCTAssertTrue(success1)
        XCTAssertTrue(success2)

        let batches = batchStore.getBatches(10)
        XCTAssertEqual(batches.count, 2)
    }

    func testGetBatches() {
        let batch = BatchEntity(
            batchId: "batch1",
            eventIds: ["event1", "event2"],
            spanIds: ["span1", "span2"],
            createdAt: 1_000_000
        )

        let success = batchStore.insertBatch(batch)
        XCTAssertTrue(success)

        let batches = batchStore.getBatches(1)

        XCTAssertEqual(batches.count, 1)
        XCTAssertEqual(batches.first?.batchId, "batch1")
    }

    func testGetBatchById() {
        let batch = BatchEntity(
            batchId: "batch1",
            eventIds: ["event1"],
            spanIds: ["span1"],
            createdAt: 1_000_000
        )

        _ = batchStore.insertBatch(batch)

        let fetchedBatch = batchStore.getBatch("batch1")

        XCTAssertNotNil(fetchedBatch)
        XCTAssertEqual(fetchedBatch?.batchId, "batch1")
    }

    func testDeleteBatch() {
        let batch1 = BatchEntity(
            batchId: "batch1",
            eventIds: ["event1", "event2"],
            spanIds: ["span1", "span2"],
            createdAt: 1_000_000
        )

        let batch2 = BatchEntity(
            batchId: "batch2",
            eventIds: ["event3", "event4"],
            spanIds: ["span3", "span4"],
            createdAt: 1_000_000
        )

        _ = batchStore.insertBatch(batch1)
        _ = batchStore.insertBatch(batch2)

        batchStore.deleteBatch("batch1")
        batchStore.deleteBatch("batch2")

        let batches = batchStore.getBatches(10)
        XCTAssertEqual(batches.count, 0)
    }
}
