//
//  EventStoreTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/09/24.
//

import CoreData
@testable import MeasureSDK
import XCTest

class EventStoreTests: XCTestCase {
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
        let event = TestDataGenerator.generateEvents(id: "1")

        let insertExpectation = expectation(description: "Insert event should complete")
        DispatchQueue.global().async {
            self.eventStore.insertEvent(event: event)
        }

        DispatchQueue.global().async {
            insertExpectation.fulfill()
        }

        wait(for: [insertExpectation], timeout: 5.0)

        let events = self.eventStore.getEventsForSessions(sessions: ["session1"])
        XCTAssertEqual(events?.count, 1, "Should only insert one event despite concurrent inserts.")
        XCTAssertEqual(events?.first?.id, event.id, "Inserted event ID should match.")
        XCTAssertEqual(events?.first?.sessionId, event.sessionId, "Inserted event sessionId should match.")
    }

    func testGetEvents() {
        let event1 = TestDataGenerator.generateEvents(id: "1")
        let event2 = TestDataGenerator.generateEvents(id: "2")
        self.eventStore.insertEvent(event: event1)
        self.eventStore.insertEvent(event: event2)

        let eventIds = ["1", "2"]

        let fetchExpectation = expectation(description: "Fetch events should complete")
        var fetchedEvents: [EventEntity]?
        DispatchQueue.global().async {
            let events = self.eventStore.getEvents(eventIds: eventIds)
            fetchedEvents = events
            fetchExpectation.fulfill()
        }

        wait(for: [fetchExpectation], timeout: 5.0)

        XCTAssertEqual(fetchedEvents?.count, 2, "Should fetch 2 events matching the event IDs.")
        XCTAssertTrue(fetchedEvents?.contains(where: { $0.id == "1" }) ?? false, "Fetched events should contain event with ID '1'.")
        XCTAssertTrue(fetchedEvents?.contains(where: { $0.id == "2" }) ?? false, "Fetched events should contain event with ID '2'.")
    }

    func testGetEventsForSessions() {
        let event1 = TestDataGenerator.generateEvents(id: "1")
        let event2 = TestDataGenerator.generateEvents(id: "2")
        let event3 = TestDataGenerator.generateEvents(id: "3", sessionId: "session2", timestamp: "2024-09-25T12:34:56Z", type: "test")
        self.eventStore.insertEvent(event: event1)
        self.eventStore.insertEvent(event: event2)
        self.eventStore.insertEvent(event: event3)

        let sessionIds = ["session1"]

        let fetchExpectation = expectation(description: "Fetch events for sessions should complete")
        var fetchedEvents: [EventEntity]?
        DispatchQueue.global().async {
            let events = self.eventStore.getEventsForSessions(sessions: sessionIds)
            fetchedEvents = events
            fetchExpectation.fulfill()
        }

        wait(for: [fetchExpectation], timeout: 5.0)

        XCTAssertEqual(fetchedEvents?.count, 2, "Should fetch 2 events for session1.")
        XCTAssertTrue(fetchedEvents?.contains(where: { $0.sessionId == "session1" }) ?? false, "Fetched events should all have session ID 'session1'.")
        XCTAssertFalse(fetchedEvents?.contains(where: { $0.sessionId == "session2" }) ?? false, "Fetched events should not include events from other sessions.")
    }

    func testDeleteEvents() {
        let event1 = TestDataGenerator.generateEvents(id: "1")
        let event2 = TestDataGenerator.generateEvents(id: "2")
        self.eventStore.insertEvent(event: event1)
        self.eventStore.insertEvent(event: event2)

        let eventIds = ["1"]

        let deleteExpectation = expectation(description: "Delete events should complete")
        DispatchQueue.global().async {
            self.eventStore.deleteEvents(eventIds: eventIds)
            deleteExpectation.fulfill()
        }

        wait(for: [deleteExpectation], timeout: 5.0)

        let events = self.eventStore.getEventsForSessions(sessions: ["session1"])
        XCTAssertEqual(events?.count, 1, "Only one event should remain after deletion.")
        XCTAssertEqual(events?.first?.id, "2", "Event with ID '2' should remain.")
    }
}
