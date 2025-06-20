//
//  ExporterTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 20/10/24.
//

import XCTest
@testable import Measure

final class BaseexporterTests: XCTestCase {
    private var logger: MockLogger!
    private var networkClient: MockNetworkClient!
    private var batchCreator: MockBatchCreator!
    private var batchStore: MockBatchStore!
    private var eventStore: MockEventStore!
    private var exporter: BaseExporter!
    private var spanStore: MockSpanStore!

    override func setUp() {
        super.setUp()
        logger = MockLogger()
        networkClient = MockNetworkClient()
        batchCreator = MockBatchCreator()
        batchStore = MockBatchStore()
        eventStore = MockEventStore()
        spanStore = MockSpanStore()
        exporter = BaseExporter(
            logger: logger,
            networkClient: networkClient,
            batchCreator: batchCreator,
            batchStore: batchStore,
            eventStore: eventStore,
            spanStore: spanStore
        )
    }

    func test_exportBatchWithNoAttachments() {
        let batchId = "batch1"
        let eventIds = ["event1", "event2"]
        let spanIds = ["span1", "span2"]
        eventStore.insertEvent(event: TestDataGenerator.generateEvents(id: "event1", attachmentSize: 100)) {}
        eventStore.insertEvent(event: TestDataGenerator.generateEvents(id: "event2", attachmentSize: 200)) {}

        exporter.export(batchId: batchId, eventIds: eventIds, spanIds: spanIds) { response in
            XCTAssertNotNil(response)
            XCTAssertTrue(self.networkClient.executeCalled)
            XCTAssertEqual(self.networkClient.executedBatchId, batchId)
            XCTAssertEqual(self.networkClient.executedEvents.count, 2)
            XCTAssertEqual(self.networkClient.executedEvents[0].id, "event1")
            XCTAssertEqual(self.networkClient.executedEvents[1].id, "event2")
        }
    }

    func test_exportBatchNoEventsFound() {
        let batchId = "batch1"
        let eventIds = ["event-id"]
        let spanIds = ["span-id"]

        exporter.export(batchId: batchId, eventIds: eventIds, spanIds: spanIds) { response in
            XCTAssertNil(response)
            XCTAssertFalse(self.networkClient.executeCalled)
        }
    }

    func test_getExistingBatches() {
        let batch1 = BatchEntity(batchId: "batch1", eventIds: ["event1", "event2"], spanIds: ["span1", "span2"], createdAt: 1727272496000)
        let batch2 = BatchEntity(batchId: "batch2", eventIds: ["event3", "event4"], spanIds: ["span3", "span4"], createdAt: 1727272497000)

        batchStore.batches = [batch1, batch2]
        exporter.getExistingBatches() { batches in
            XCTAssertEqual(batches.count, 2)
            XCTAssertEqual(batches[0].eventIds, ["event1", "event2"])
            XCTAssertEqual(batches[1].eventIds, ["event3", "event4"])
        }
    }

    func test_deleteEventsAndBatchOnSuccessfulExport() {
        let batchId = "batch1"
        let eventIds = ["event1", "event2"]
        let spanIds = ["span1", "span2"]
        eventStore.insertEvent(event: TestDataGenerator.generateEvents(id: "event1", attachmentSize: 100)) {}
        eventStore.insertEvent(event: TestDataGenerator.generateEvents(id: "event2", attachmentSize: 200)) {}

        networkClient.response = .success(body: "success")

        exporter.export(batchId: batchId, eventIds: eventIds, spanIds: spanIds) { response in
            XCTAssertNotNil(response)
            XCTAssertTrue(self.eventStore.deleteEventsCalled)
            XCTAssertEqual(self.eventStore.deletedEventIds, eventIds)
            XCTAssertTrue(self.batchStore.deleteBatchCalled)
            XCTAssertEqual(self.batchStore.deletedBatchId, batchId)
        }
    }

    func test_deleteEventsAndBatchOnClientError() {
        let batchId = "batch1"
        let eventIds = ["event1", "event2"]
        let spanIds = ["span1", "span2"]
        eventStore.insertEvent(event: TestDataGenerator.generateEvents(id: "event1", attachmentSize: 100)) {}
        eventStore.insertEvent(event: TestDataGenerator.generateEvents(id: "event2", attachmentSize: 200)) {}

        networkClient.response = .error(.clientError(responseCode: 400, body: "error"))

        exporter.export(batchId: batchId, eventIds: eventIds, spanIds: spanIds) { response in
            XCTAssertNotNil(response)
            XCTAssertTrue(self.eventStore.deleteEventsCalled)
            XCTAssertEqual(self.eventStore.deletedEventIds, eventIds)
            XCTAssertTrue(self.batchStore.deleteBatchCalled)
            XCTAssertEqual(self.batchStore.deletedBatchId, batchId)
        }
    }
}
