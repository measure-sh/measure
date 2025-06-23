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

    func testGetEvents() {
        let expectation = expectation(description: "Insert and fetch specific events")
        let event1 = TestDataGenerator.generateEvents(id: "1")
        let event2 = TestDataGenerator.generateEvents(id: "2")

        eventStore.insertEvent(event: event1) {
            self.eventStore.insertEvent(event: event2) {
                let eventIds = ["1", "2"]
                self.eventStore.getEvents(eventIds: eventIds) { events in
                    XCTAssertEqual(events?.count, 2)
                    XCTAssertTrue(events?.contains(where: { $0.id == "1" }) ?? false)
                    XCTAssertTrue(events?.contains(where: { $0.id == "2" }) ?? false)
                    expectation.fulfill()
                }
            }
        }

        wait(for: [expectation], timeout: 2.0)
    }

    func testGetEventsForSessions() {
        let expectation = expectation(description: "Fetch events for sessions should complete")
        let event1 = TestDataGenerator.generateEvents(id: "1")
        let event2 = TestDataGenerator.generateEvents(id: "2")
        let event3 = TestDataGenerator.generateEvents(id: "3", sessionId: "session2")

        eventStore.insertEvent(event: event1) {
            self.eventStore.insertEvent(event: event2) {
                self.eventStore.insertEvent(event: event3) {
                    self.eventStore.getEventsForSessions(sessions: ["session1"]) { events in
                        XCTAssertEqual(events?.count, 2)
                        XCTAssertTrue(events?.allSatisfy { $0.sessionId == "session1" } ?? false)
                        expectation.fulfill()
                    }
                }
            }
        }

        wait(for: [expectation], timeout: 2.0)
    }

    func testDeleteEvents() {
        let expectation = expectation(description: "Delete and verify events")

        let event1 = TestDataGenerator.generateEvents(id: "1")
        let event2 = TestDataGenerator.generateEvents(id: "2")

        eventStore.insertEvent(event: event1) {
            self.eventStore.insertEvent(event: event2) {
                self.eventStore.deleteEvents(eventIds: ["1"]) {
                    self.eventStore.getEventsForSessions(sessions: ["session1"]) { events in
                        XCTAssertEqual(events?.count, 1)
                        XCTAssertEqual(events?.first?.id, "2")
                        expectation.fulfill()
                    }
                }
            }
        }

        wait(for: [expectation], timeout: 3.0)
    }
}
