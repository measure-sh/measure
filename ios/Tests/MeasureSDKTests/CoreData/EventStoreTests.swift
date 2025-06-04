//
//  EventStoreTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/09/24.
//

import CoreData
@testable import Measure
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
        let expectation = self.expectation(description: "Insert and fetch event")
        let event = TestDataGenerator.generateEvents(id: "1")

        eventStore.insertEvent(event: event)

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            self.eventStore.getEventsForSessions(sessions: ["session1"]) { events in
                XCTAssertEqual(events?.count, 1, "Should only insert one event despite concurrent inserts.")
                XCTAssertEqual(events?.first?.id, event.id, "Inserted event ID should match.")
                XCTAssertEqual(events?.first?.sessionId, event.sessionId, "Inserted event sessionId should match.")
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 2.0)
    }

    func testGetEvents() {
        let expectation = self.expectation(description: "Insert and fetch specific events")
        let event1 = TestDataGenerator.generateEvents(id: "1")
        let event2 = TestDataGenerator.generateEvents(id: "2")
        eventStore.insertEvent(event: event1)
        eventStore.insertEvent(event: event2)

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            let eventIds = ["1", "2"]
            self.eventStore.getEvents(eventIds: eventIds) { events in
                XCTAssertEqual(events?.count, 2, "Should fetch 2 events matching the event IDs.")
                XCTAssertTrue(events?.contains(where: { $0.id == "1" }) ?? false, "Fetched events should contain event with ID '1'.")
                XCTAssertTrue(events?.contains(where: { $0.id == "2" }) ?? false, "Fetched events should contain event with ID '2'.")
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 2.0)
    }

    func testGetEventsForSessions() {
        let expectation = self.expectation(description: "Fetch events for sessions should complete")
        let event1 = TestDataGenerator.generateEvents(id: "1")
        let event2 = TestDataGenerator.generateEvents(id: "2")
        let event3 = TestDataGenerator.generateEvents(id: "3", sessionId: "session2", timestamp: "2024-09-25T12:34:56Z", type: "test")
        eventStore.insertEvent(event: event1)
        eventStore.insertEvent(event: event2)
        eventStore.insertEvent(event: event3)

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            self.eventStore.getEventsForSessions(sessions: ["session1"]) { events in
                XCTAssertEqual(events?.count, 2, "Should fetch 2 events for session1.")
                XCTAssertTrue(((events?.allSatisfy { $0.sessionId == "session1" }) != nil), "Fetched events should all have session ID 'session1'.")
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 2.0)
    }

    func testDeleteEvents() {
        let expectation = self.expectation(description: "Delete and verify events")

        let event1 = TestDataGenerator.generateEvents(id: "1")
        let event2 = TestDataGenerator.generateEvents(id: "2")
        eventStore.insertEvent(event: event1)
        eventStore.insertEvent(event: event2)

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            let eventIds = ["1"]
            self.eventStore.deleteEvents(eventIds: eventIds)

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                self.eventStore.getEventsForSessions(sessions: ["session1"]) { events in
                    XCTAssertEqual(events?.count, 1, "Only one event should remain after deletion.")
                    XCTAssertEqual(events?.first?.id, "2", "Event with ID '2' should remain.")
                    expectation.fulfill()
                }
            }
        }

        wait(for: [expectation], timeout: 3.0)
    }
}
