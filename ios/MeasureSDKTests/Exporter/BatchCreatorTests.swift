//
//  BatchCreatorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 19/10/24.
//

@testable import MeasureSDK
import XCTest

final class BatchCreatorTests: XCTestCase {
    var batchCreator: BatchCreator!
    var logger: MockLogger!
    var idProvider: MockIdProvider!
    var configProvider: MockConfigProvider!
    var timeProvider: MockTimeProvider!
    var eventStore: MockEventStore!
    var batchStore: MockBatchStore!

    override func setUp() {
        super.setUp()
        logger = MockLogger()
        idProvider = MockIdProvider()
        configProvider = MockConfigProvider()
        timeProvider = MockTimeProvider()
        eventStore = MockEventStore()
        batchStore = MockBatchStore()

        batchCreator = BaseBatchCreator(
            logger: logger,
            idProvider: idProvider,
            configProvider: configProvider,
            timeProvider: timeProvider,
            eventStore: eventStore,
            batchStore: batchStore
        )
    }

    override func tearDown() {
        batchCreator = nil
        logger = nil
        idProvider = nil
        configProvider = nil
        timeProvider = nil
        eventStore = nil
        batchStore = nil
        super.tearDown()
    }

    func testCreateWithNoEvents() {
        eventStore.events = []

        let result = batchCreator.create(sessionId: nil)

        XCTAssertNil(result)
        let batches = batchStore.getBatches(5)
        XCTAssertTrue(batches.isEmpty)
    }

    func testCreateWithEventsButExceedsAttachmentSize() {
        eventStore.insertEvent(event: TestDataGenerator.generateEvents(id: "event1", attachmentSize: 200))
        eventStore.insertEvent(event: TestDataGenerator.generateEvents(id: "event2", attachmentSize: 300))
        configProvider.maxAttachmentSizeInEventsBatchInBytes = 100
        configProvider.maxEventsInBatch = 2

        let result = batchCreator.create(sessionId: nil)
        let batches = batchStore.getBatches(5)

        XCTAssertNil(result)
        XCTAssertTrue(batches.isEmpty)
    }

    func testCreateSuccessfulBatch() {
        eventStore.insertEvent(event: TestDataGenerator.generateEvents(id: "event1", attachmentSize: 100))
        eventStore.insertEvent(event: TestDataGenerator.generateEvents(id: "event2", attachmentSize: 200))
        configProvider.maxAttachmentSizeInEventsBatchInBytes = 300
        configProvider.maxEventsInBatch = 2
        idProvider.idString = "batch1"
        timeProvider.current = 1727272496000

        let result = batchCreator.create(sessionId: nil)

        XCTAssertNotNil(result)
        XCTAssertEqual(result?.batchId, "batch1")
        XCTAssertTrue(((result?.eventIds.contains("1")) != nil))
        XCTAssertTrue(((result?.eventIds.contains("2")) != nil))

        XCTAssertEqual(batchStore.batches.count, 1)
        XCTAssertEqual(batchStore.batches.first?.batchId, "batch1")
        XCTAssertTrue(((result?.eventIds.contains("1")) != nil))
        XCTAssertTrue(((result?.eventIds.contains("2")) != nil))

        XCTAssertEqual(eventStore.events.first?.batchId, "batch1")
    }

    func testCreateReturnsNilIfNoEventsToBatchAfterFiltering() {
        eventStore.insertEvent(event: TestDataGenerator.generateEvents(id: "event1", attachmentSize: 200))
        eventStore.insertEvent(event: TestDataGenerator.generateEvents(id: "event2", attachmentSize: 300))
        configProvider.maxAttachmentSizeInEventsBatchInBytes = 100
        configProvider.maxEventsInBatch = 2

        let result = batchCreator.create(sessionId: nil)
        let batches = batchStore.getBatches(5)

        XCTAssertNil(result)
        XCTAssertTrue(batches.isEmpty)
    }
}
