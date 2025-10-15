//
//  BatchCreatorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 19/10/24.
//

@testable import Measure
import XCTest

final class BatchCreatorTests: XCTestCase {
    var batchCreator: BatchCreator!
    var logger: MockLogger!
    var idProvider: MockIdProvider!
    var configProvider: MockConfigProvider!
    var timeProvider: MockTimeProvider!
    var eventStore: MockEventStore!
    var batchStore: MockBatchStore!
    var spanStore: MockSpanStore!

    override func setUp() {
        super.setUp()
        logger = MockLogger()
        idProvider = MockIdProvider()
        configProvider = MockConfigProvider()
        timeProvider = MockTimeProvider()
        eventStore = MockEventStore()
        batchStore = MockBatchStore()
        spanStore = MockSpanStore()

        batchCreator = BaseBatchCreator(
            logger: logger,
            idProvider: idProvider,
            configProvider: configProvider,
            timeProvider: timeProvider,
            eventStore: eventStore,
            batchStore: batchStore,
            spanStore: spanStore
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

        batchCreator.create(sessionId: nil) { result in
            XCTAssertNil(result)
            self.batchStore.getBatches(5) { batches in
                XCTAssertTrue(batches.isEmpty)
            }
        }
    }

    func testCreateSuccessfulBatch() {
        eventStore.insertEvent(event: TestDataGenerator.generateEvents(id: "event1")) {}
        eventStore.insertEvent(event: TestDataGenerator.generateEvents(id: "event2")) {}
        configProvider.maxAttachmentSizeInEventsBatchInBytes = 300
        configProvider.maxEventsInBatch = 2
        idProvider.uuId = "batch1"
        timeProvider.current = 1727272496000

        batchCreator.create(sessionId: nil) { result in
            XCTAssertNotNil(result)
            XCTAssertEqual(result?.batchId, "batch1")
            XCTAssertTrue(((result?.eventIds.contains("1")) != nil))
            XCTAssertTrue(((result?.eventIds.contains("2")) != nil))

            XCTAssertEqual(self.batchStore.batches.count, 1)
            XCTAssertEqual(self.batchStore.batches.first?.batchId, "batch1")
            XCTAssertTrue(((result?.eventIds.contains("1")) != nil))
            XCTAssertTrue(((result?.eventIds.contains("2")) != nil))

            XCTAssertEqual(self.eventStore.events.first?.batchId, "batch1")
        }
    }
}
