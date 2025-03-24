//
//  EventExporterTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 20/10/24.
//

import XCTest
@testable import Measure

final class BaseEventExporterTests: XCTestCase {
    private var logger: MockLogger!
    private var networkClient: MockNetworkClient!
    private var batchCreator: MockBatchCreator!
    private var batchStore: MockBatchStore!
    private var eventStore: MockEventStore!
    private var eventExporter: BaseEventExporter!

    override func setUp() {
        super.setUp()
        logger = MockLogger()
        networkClient = MockNetworkClient()
        batchCreator = MockBatchCreator()
        batchStore = MockBatchStore()
        eventStore = MockEventStore()
        eventExporter = BaseEventExporter(
            logger: logger,
            networkClient: networkClient,
            batchCreator: batchCreator,
            batchStore: batchStore,
            eventStore: eventStore
        )
    }

    func test_exportBatchWithNoAttachments() {
        let batchId = "batch1"
        let eventIds = ["event1", "event2"]
        eventStore.insertEvent(event: TestDataGenerator.generateEvents(id: "event1", attachmentSize: 100))
        eventStore.insertEvent(event: TestDataGenerator.generateEvents(id: "event2", attachmentSize: 200))

        let response = eventExporter.export(batchId: batchId, eventIds: eventIds)

        XCTAssertNotNil(response)
        XCTAssertTrue(networkClient.executeCalled)
        XCTAssertEqual(networkClient.executedBatchId, batchId)
        XCTAssertEqual(networkClient.executedEvents.count, 2)
        XCTAssertEqual(networkClient.executedEvents[0].id, "event1")
        XCTAssertEqual(networkClient.executedEvents[1].id, "event2")
    }

    func test_exportBatchNoEventsFound() {
        let batchId = "batch1"
        let eventIds = ["event-id"]

        let response = eventExporter.export(batchId: batchId, eventIds: eventIds)

        XCTAssertNil(response)
        XCTAssertFalse(networkClient.executeCalled)
    }

    func test_getExistingBatches() {
        let batch1 = BatchEntity(batchId: "batch1", eventIds: ["event1", "event2"], createdAt: 1727272496000)
        let batch2 = BatchEntity(batchId: "batch2", eventIds: ["event3", "event4"], createdAt: 1727272497000)

        batchStore.batches = [batch1, batch2]
        let batches = eventExporter.getExistingBatches()

        XCTAssertEqual(batches.count, 2)
        XCTAssertEqual(batches[0].eventIds, ["event1", "event2"])
        XCTAssertEqual(batches[1].eventIds, ["event3", "event4"])
    }

    func test_deleteEventsAndBatchOnSuccessfulExport() {
        let batchId = "batch1"
        let eventIds = ["event1", "event2"]
        eventStore.insertEvent(event: TestDataGenerator.generateEvents(id: "event1", attachmentSize: 100))
        eventStore.insertEvent(event: TestDataGenerator.generateEvents(id: "event2", attachmentSize: 200))

        networkClient.response = .success(body: "success")

        let response = eventExporter.export(batchId: batchId, eventIds: eventIds)

        XCTAssertNotNil(response)
        XCTAssertTrue(eventStore.deleteEventsCalled)
        XCTAssertEqual(eventStore.deletedEventIds, eventIds)
        XCTAssertTrue(batchStore.deleteBatchCalled)
        XCTAssertEqual(batchStore.deletedBatchId, batchId)
    }

    func test_deleteEventsAndBatchOnClientError() {
        let batchId = "batch1"
        let eventIds = ["event1", "event2"]
        eventStore.insertEvent(event: TestDataGenerator.generateEvents(id: "event1", attachmentSize: 100))
        eventStore.insertEvent(event: TestDataGenerator.generateEvents(id: "event2", attachmentSize: 200))

        networkClient.response = .error(.clientError(responseCode: 400, body: "error"))

        let response = eventExporter.export(batchId: batchId, eventIds: eventIds)

        XCTAssertNotNil(response)
        XCTAssertTrue(eventStore.deleteEventsCalled)
        XCTAssertEqual(eventStore.deletedEventIds, eventIds)
        XCTAssertTrue(batchStore.deleteBatchCalled)
        XCTAssertEqual(batchStore.deletedBatchId, batchId)
    }
}
