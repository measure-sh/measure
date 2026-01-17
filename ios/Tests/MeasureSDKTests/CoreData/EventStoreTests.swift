//
//  EventStoreTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/09/24.
//

import CoreData
@testable import Measure
import XCTest

final class EventStoreTests: XCTestCase {
    var coreDataManager: MockCoreDataManager!
    var logger: MockLogger!
    var eventStore: EventStore!

    override func setUp() {
        super.setUp()
        coreDataManager = MockCoreDataManager()
        logger = MockLogger()
        eventStore = BaseEventStore(coreDataManager: coreDataManager, logger: logger)
    }

    override func tearDown() {
        eventStore = nil
        coreDataManager = nil
        logger = nil
        super.tearDown()
    }

    func testInsertEvent() {
        let expectation = expectation(description: "Insert and fetch event")
        let event = TestDataGenerator.generateEvents(id: "1")

        eventStore.insertEvent(event: event) {
            self.eventStore.getEventsForSessions(sessions: ["session1"]) { events in
                XCTAssertEqual(events?.count, 1)
                XCTAssertEqual(events?.first?.id, event.id)
                XCTAssertEqual(events?.first?.sessionId, event.sessionId)
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 2.0)
    }

    func testGetEventsByIds() {
        let event1 = TestDataGenerator.generateEvents(id: "1")
        let event2 = TestDataGenerator.generateEvents(id: "2")

        let insertExpectation = expectation(description: "Insert events")

        eventStore.insertEvents(events: [event1, event2]) {
            insertExpectation.fulfill()
        }

        wait(for: [insertExpectation], timeout: 2.0)

        let events = eventStore.getEvents(eventIds: ["1", "2"])

        XCTAssertEqual(events?.count, 2)
        XCTAssertTrue(events?.contains(where: { $0.id == "1" }) ?? false)
        XCTAssertTrue(events?.contains(where: { $0.id == "2" }) ?? false)
    }

    func testGetEventsForSessions() {
        let expectation = expectation(description: "Fetch events for sessions")
        let event1 = TestDataGenerator.generateEvents(id: "1")
        let event2 = TestDataGenerator.generateEvents(id: "2")
        let event3 = TestDataGenerator.generateEvents(id: "3", sessionId: "session2")

        eventStore.insertEvents(events: [event1, event2, event3]) {
            self.eventStore.getEventsForSessions(sessions: ["session1"]) { events in
                XCTAssertEqual(events?.count, 2)
                XCTAssertTrue(events?.allSatisfy { $0.sessionId == "session1" } ?? false)
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 2.0)
    }

    func testDeleteEventsByIds() {
        let expectation = expectation(description: "Delete and verify events")
        let event1 = TestDataGenerator.generateEvents(id: "1")
        let event2 = TestDataGenerator.generateEvents(id: "2")

        eventStore.insertEvents(events: [event1, event2]) {
            self.eventStore.deleteEvents(eventIds: ["1"])

            self.eventStore.getEventsForSessions(sessions: ["session1"]) { events in
                XCTAssertEqual(events?.count, 1)
                XCTAssertEqual(events?.first?.id, "2")
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 2.0)
    }

    func testGetUnBatchedEvents() {
        let event1 = TestDataGenerator.generateEvents(id: "1")
        let event2 = TestDataGenerator.generateEvents(id: "2")

        let expectation = expectation(description: "Insert events")

        eventStore.insertEvents(events: [event1, event2]) {
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 2.0)

        let eventIds = eventStore.getUnBatchedEvents(
            eventCount: 10,
            ascending: true,
            sessionId: nil
        )

        XCTAssertEqual(eventIds.count, 2)
        XCTAssertTrue(eventIds.contains("1"))
        XCTAssertTrue(eventIds.contains("2"))
    }

    func testGetSessionIdsWithUnBatchedEvents() {
        let event1 = TestDataGenerator.generateEvents(id: "1", sessionId: "session1")
        let event2 = TestDataGenerator.generateEvents(id: "2", sessionId: "session2")

        let expectation = expectation(description: "Insert events")

        eventStore.insertEvents(events: [event1, event2]) {
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 2.0)

        let sessionIds = eventStore.getSessionIdsWithUnBatchedEvents()

        XCTAssertEqual(Set(sessionIds), Set(["session1", "session2"]))
    }

    func testUpdateBatchId() {
        let event1 = TestDataGenerator.generateEvents(id: "1")
        let event2 = TestDataGenerator.generateEvents(id: "2")

        let expectation = expectation(description: "Insert events")

        eventStore.insertEvents(events: [event1, event2]) {
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 2.0)

        eventStore.updateBatchId("batch1", for: ["1", "2"])

        let events = eventStore.getEvents(eventIds: ["1", "2"])
        XCTAssertTrue(events?.allSatisfy { $0.batchId == "batch1" } ?? false)
    }

    func testGetEventsCount() {
        let event1 = TestDataGenerator.generateEvents(id: "1")
        let event2 = TestDataGenerator.generateEvents(id: "2")

        let insertExpectation = expectation(description: "Insert events")

        eventStore.insertEvents(events: [event1, event2]) {
            insertExpectation.fulfill()
        }

        wait(for: [insertExpectation], timeout: 2.0)

        let countExpectation = expectation(description: "Get count")

        eventStore.getEventsCount { count in
            XCTAssertEqual(count, 2)
            countExpectation.fulfill()
        }

        wait(for: [countExpectation], timeout: 2.0)
    }
}
