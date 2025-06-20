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
        let expectation = expectation(description: "Insert and fetch")
        let batch1 = BatchEntity(batchId: "batch1", eventIds: ["event1", "event2"], spanIds: ["span1", "span2"], createdAt: 1_000_000)
        let batch2 = BatchEntity(batchId: "batch2", eventIds: ["event3", "event4"], spanIds: ["span3", "span4"], createdAt: 1_000_000)

        batchStore.insertBatch(batch1) { success1 in
            XCTAssertTrue(success1)
            self.batchStore.insertBatch(batch2) { success2 in
                XCTAssertTrue(success2)

                self.batchStore.getBatches(10) { batches in
                    XCTAssertEqual(batches.count, 2)
                    expectation.fulfill()
                }
            }
        }

        wait(for: [expectation], timeout: 5)
    }

    func testGetBatches() {
        let expectation = expectation(description: "Insert and get")

        let batch = BatchEntity(batchId: "batch1", eventIds: ["event1", "event2"], spanIds: ["span1", "span2"], createdAt: 1_000_000)

        batchStore.insertBatch(batch) { _ in
            self.batchStore.getBatches(1) { batches in
                XCTAssertEqual(batches.count, 1)
                XCTAssertEqual(batches.first?.batchId, "batch1")
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 5)
    }

    func testDeleteBatch() {
        let expectation = expectation(description: "Insert, delete, verify")

        let batch1 = BatchEntity(batchId: "batch1", eventIds: ["event1", "event2"], spanIds: ["span1", "span2"], createdAt: 1_000_000)
        let batch2 = BatchEntity(batchId: "batch2", eventIds: ["event3", "event4"], spanIds: ["span3", "span4"], createdAt: 1_000_000)

        batchStore.insertBatch(batch1) { _ in
            self.batchStore.insertBatch(batch2) { _ in
                self.batchStore.deleteBatch("batch1") {
                    self.batchStore.deleteBatch("batch2") {
                        self.batchStore.getBatches(10) { batches in
                            XCTAssertEqual(batches.count, 0)
                            expectation.fulfill()
                        }
                    }
                }
            }
        }

        wait(for: [expectation], timeout: 5)
    }
}
