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
        let batch1 = BatchEntity(batchId: "batch1", eventIds: ["event1", "event2"], spanIds: ["span1", "span2"], createdAt: 1_000_000)
        let batch2 = BatchEntity(batchId: "batch2", eventIds: ["event3", "event4"], spanIds: ["span3", "span4"], createdAt: 1_000_000)

        // Perform concurrent inserts
        let expectation1 = expectation(description: "Insert batch 1")
        let expectation2 = expectation(description: "Insert batch 2")

        DispatchQueue.global().async {
            self.batchStore.insertBatch(batch1) { success in
                XCTAssertTrue(success)
                expectation1.fulfill()
            }
        }

        DispatchQueue.global().async {
            self.batchStore.insertBatch(batch2) { success in
                XCTAssertTrue(success)
                expectation2.fulfill()
            }
        }

        wait(for: [expectation1, expectation2], timeout: 5)

        // Assert that both batches are inserted properly
        batchStore.getBatches(10) { batches in
            XCTAssertEqual(batches.count, 2)
        }
    }

    func testGetBatches() {
        let batch = BatchEntity(batchId: "batch1", eventIds: ["event1", "event2"], spanIds: ["span1", "span2"], createdAt: 1_000_000)
        batchStore.insertBatch(batch) { _ in }

        let expectation = expectation(description: "Get batches")

        DispatchQueue.global().async {
            self.batchStore.getBatches(1) { batches in
                XCTAssertEqual(batches.count, 1)
                XCTAssertEqual(batches.first?.batchId, "batch1")
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 5)
    }

    func testDeleteBatch() {
        let batch1 = BatchEntity(batchId: "batch1", eventIds: ["event1", "event2"], spanIds: ["span1", "span2"], createdAt: 1_000_000)
        let batch2 = BatchEntity(batchId: "batch2", eventIds: ["event3", "event4"], spanIds: ["span3", "span4"], createdAt: 1_000_000)

        batchStore.insertBatch(batch1) { _ in }
        batchStore.insertBatch(batch2) { _ in }

        let expectation1 = expectation(description: "Delete batch 1")
        let expectation2 = expectation(description: "Delete batch 2")

        DispatchQueue.global().async {
            self.batchStore.deleteBatch("batch1")
            expectation1.fulfill()
        }

        DispatchQueue.global().async {
            self.batchStore.deleteBatch("batch2")
            expectation2.fulfill()
        }

        wait(for: [expectation1, expectation2], timeout: 5)

        batchStore.getBatches(10) { batches in
            XCTAssertEqual(batches.count, 0)
        }
    }

    func testDeleteNonExistentBatch() {
        let expectation1 = expectation(description: "Batch inserted")
        let expectation2 = expectation(description: "Delete non-existent batch")

        let batch = BatchEntity(batchId: "batch1", eventIds: ["event1", "event2"], spanIds: ["span1", "span2"], createdAt: 1_000_000)

        batchStore.insertBatch(batch) { _ in
            expectation1.fulfill()
        }

        wait(for: [expectation1], timeout: 5)

        batchStore.deleteBatch("nonExistentBatch")
        expectation2.fulfill()

        wait(for: [expectation2], timeout: 5)

        batchStore.getBatches(10) { batches in
            XCTAssertEqual(batches.count, 1)
            XCTAssertEqual(batches.first?.batchId, "batch1")
        }
    }
}
