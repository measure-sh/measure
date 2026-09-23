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
        let event = TestDataGenerator.generateEvents(id: "1")

        eventStore.insertEvent(event: event)

        let events = eventStore.getAllEvents()
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events.first?.id, event.id)
        XCTAssertEqual(events.first?.sessionId, event.sessionId)
    }

    func testPersistenceAndExportOmitMissingMemoryHeadroom() throws {
        let memory = try persistAndExportMemoryUsage(availableMemory: nil)

        XCTAssertNil(memory["available_memory"])
        XCTAssertEqual(memory["used_memory"] as? UnsignedNumber, 3072)
    }

    func testPersistenceAndExportPreserveZeroMemoryHeadroom() throws {
        let memory = try persistAndExportMemoryUsage(availableMemory: 0)

        XCTAssertEqual(memory["available_memory"] as? UnsignedNumber, 0)
    }

    func testPersistenceAndExportPreserveAvailableMemoryHeadroom() throws {
        let memory = try persistAndExportMemoryUsage(availableMemory: 1024)

        XCTAssertEqual(memory["available_memory"] as? UnsignedNumber, 1024)
    }

    private func persistAndExportMemoryUsage(availableMemory: UnsignedNumber?) throws -> [String: Any] {
        let memoryUsageData = MemoryUsageData(
            maxMemory: 8192,
            usedMemory: 3072,
            interval: 5000,
            availableMemory: availableMemory
        )
        let event = Event(
            id: "memoryEventId",
            sessionId: "session1",
            timestamp: "2026-09-17T00:00:00Z",
            timestampInMillis: 1,
            type: .memoryUsageAbsolute,
            data: memoryUsageData,
            attachments: [],
            attributes: TestDataGenerator.generateAttributes(),
            userTriggered: false
        )

        eventStore.insertEvent(event: EventEntity(event, needsReporting: true))

        let savedEvent = try XCTUnwrap(eventStore.getEvents(eventIds: [event.id])?.first)
        let jsonData = try XCTUnwrap(EventSerializer().getSerialisedEvent(for: savedEvent))
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: jsonData) as? [String: Any])
        return try XCTUnwrap(json["memory_usage_absolute"] as? [String: Any])
    }

    func testGetEventsByIds() {
        let event1 = TestDataGenerator.generateEvents(id: "1")
        let event2 = TestDataGenerator.generateEvents(id: "2")

        eventStore.insertEvent(event: event1)
        eventStore.insertEvent(event: event2)

        let events = eventStore.getEvents(eventIds: ["1", "2"])

        XCTAssertEqual(events?.count, 2)
        XCTAssertTrue(events?.contains(where: { $0.id == "1" }) ?? false)
        XCTAssertTrue(events?.contains(where: { $0.id == "2" }) ?? false)
    }

    func testGetEventsForSessions() {
        let event1 = TestDataGenerator.generateEvents(id: "1")
        let event2 = TestDataGenerator.generateEvents(id: "2")
        let event3 = TestDataGenerator.generateEvents(id: "3", sessionId: "session2")

        eventStore.insertEvent(event: event1)
        eventStore.insertEvent(event: event2)
        eventStore.insertEvent(event: event3)

        let events = eventStore.getEventsForSessions(sessions: ["session1"])

        XCTAssertEqual(events?.count, 2)
        XCTAssertTrue(events?.allSatisfy { $0.sessionId == "session1" } ?? false)
    }

    func testDeleteEventsByIds() {
        let event1 = TestDataGenerator.generateEvents(id: "1")
        let event2 = TestDataGenerator.generateEvents(id: "2")

        eventStore.insertEvent(event: event1)
        eventStore.insertEvent(event: event2)

        eventStore.deleteEvents(eventIds: ["1"])

        let events = eventStore.getAllEvents()

        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events.first?.id, "2")
    }

    func testGetUnBatchedEvents() {
        let event1 = TestDataGenerator.generateEvents(id: "1")
        let event2 = TestDataGenerator.generateEvents(id: "2")

        eventStore.insertEvent(event: event1)
        eventStore.insertEvent(event: event2)

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

        eventStore.insertEvent(event: event1)
        eventStore.insertEvent(event: event2)

        let sessionIds = eventStore.getSessionIdsWithUnBatchedEvents()

        XCTAssertEqual(Set(sessionIds), Set(["session1", "session2"]))
    }

    func testUpdateBatchId() {
        let event1 = TestDataGenerator.generateEvents(id: "1")
        let event2 = TestDataGenerator.generateEvents(id: "2")

        eventStore.insertEvent(event: event1)
        eventStore.insertEvent(event: event2)

        eventStore.updateBatchId("batch1", for: ["1", "2"])

        let events = eventStore.getEvents(eventIds: ["1", "2"])
        XCTAssertTrue(events?.allSatisfy { $0.batchId == "batch1" } ?? false)
    }

    func testGetEventsCount() {
        let event1 = TestDataGenerator.generateEvents(id: "1")
        let event2 = TestDataGenerator.generateEvents(id: "2")

        eventStore.insertEvent(event: event1)
        eventStore.insertEvent(event: event2)

        let count = eventStore.getEventsCount()
        XCTAssertEqual(count, 2)
    }
    // MARK: - App Hang

    private func appHangPayload(state: AppHangState, duration: Number) -> Data {
        let detail = AppHangDetail(threadName: "main", threadSequence: 0, osBuildNumber: "22D72", frames: [])
        let appHang = AppHang(exceptions: [detail],
                              duration: duration,
                              state: state,
                              framework: Framework.apple,
                              foreground: true,
                              binaryImages: nil)
        return try! JSONEncoder().encode(appHang) // swiftlint:disable:this force_try
    }

    func testAppHangPayloadRoundTrips() {
        let payload = appHangPayload(state: .killed, duration: 2000)
        let event = TestDataGenerator.generateEvents(id: "1", type: "app_hang", appHang: payload, pendingResolution: true)

        eventStore.insertEvent(event: event)

        guard let stored = eventStore.getEvents(eventIds: ["1"])?.first else {
            XCTFail("Expected the app hang event to be stored.")
            return
        }
        XCTAssertEqual(stored.appHang, payload)
        XCTAssertTrue(stored.pendingResolution)
        XCTAssertEqual(stored.payloadData, payload, "payloadData must resolve app_hang to the appHang column.")

        let decoded = try? JSONDecoder().decode(AppHang.self, from: stored.appHang ?? Data())
        XCTAssertEqual(decoded?.state, .killed)
        XCTAssertEqual(decoded?.duration, 2000)
    }

    /// An app hang is written the moment it is detected, before its outcome is known. Until it
    /// resolves it must stay out of every export query, even though `needsReporting` is set.
    func testUnresolvedAppHangIsNotExported() {
        let hang = TestDataGenerator.generateEvents(id: "1",
                                                    type: "app_hang",
                                                    appHang: appHangPayload(state: .killed, duration: 2000),
                                                    needsReporting: true,
                                                    pendingResolution: true)
        let other = TestDataGenerator.generateEvents(id: "2", needsReporting: true)

        eventStore.insertEvent(event: hang)
        eventStore.insertEvent(event: other)

        let unBatched = eventStore.getUnBatchedEvents(eventCount: 10, ascending: true, sessionId: nil)
        XCTAssertEqual(unBatched, ["2"], "An unresolved app hang must not be picked up for export.")
    }

    func testResolveAppHangMakesEventExportable() {
        let hang = TestDataGenerator.generateEvents(id: "1",
                                                    type: "app_hang",
                                                    appHang: appHangPayload(state: .killed, duration: 2000),
                                                    needsReporting: false,
                                                    pendingResolution: true)
        eventStore.insertEvent(event: hang)

        let resolved = appHangPayload(state: .recovered, duration: 3184)
        eventStore.resolveAppHang(eventId: "1", payload: resolved, needsReporting: true)

        guard let stored = eventStore.getEvents(eventIds: ["1"])?.first else {
            XCTFail("Expected the app hang event to be stored.")
            return
        }
        XCTAssertFalse(stored.pendingResolution)
        XCTAssertTrue(stored.needsReporting)
        XCTAssertEqual(stored.appHang, resolved)

        let decoded = try? JSONDecoder().decode(AppHang.self, from: stored.appHang ?? Data())
        XCTAssertEqual(decoded?.state, .recovered)
        XCTAssertEqual(decoded?.duration, 3184)

        let unBatched = eventStore.getUnBatchedEvents(eventCount: 10, ascending: true, sessionId: nil)
        XCTAssertEqual(unBatched, ["1"])
    }

    func testResolveAppHangIgnoresUnknownEventId() {
        eventStore.resolveAppHang(eventId: "missing", payload: appHangPayload(state: .recovered, duration: 1), needsReporting: true)

        XCTAssertEqual(eventStore.getEventsCount(), 0)
    }

    /// `markTimelineForReporting` sweeps a whole time window. An unresolved app hang sitting in
    /// that window must not be dragged into an export by an unrelated error.
    func testMarkTimelineForReportingSkipsUnresolvedAppHang() {
        let hang = TestDataGenerator.generateEvents(id: "1",
                                                    type: "app_hang",
                                                    timestampInMillis: 1_000_000,
                                                    appHang: appHangPayload(state: .killed, duration: 2000),
                                                    needsReporting: false,
                                                    pendingResolution: true)
        let other = TestDataGenerator.generateEvents(id: "2", timestampInMillis: 1_000_000, needsReporting: false)

        eventStore.insertEvent(event: hang)
        eventStore.insertEvent(event: other)

        eventStore.markTimelineForReporting(eventTimestampMillis: 1_000_500, durationSeconds: 300, sessionId: "session1")

        let events = eventStore.getEvents(eventIds: ["1", "2"]) ?? []
        XCTAssertEqual(events.first(where: { $0.id == "1" })?.needsReporting, false)
        XCTAssertEqual(events.first(where: { $0.id == "2" })?.needsReporting, true)
    }

    func testUnresolvedAppHangIsNotASessionWithUnBatchedEvents() {
        let hang = TestDataGenerator.generateEvents(id: "1",
                                                    type: "app_hang",
                                                    appHang: appHangPayload(state: .killed, duration: 2000),
                                                    needsReporting: true,
                                                    pendingResolution: true)
        eventStore.insertEvent(event: hang)

        XCTAssertTrue(eventStore.getSessionIdsWithUnBatchedEvents().isEmpty)

        eventStore.resolveAppHang(eventId: "1", payload: appHangPayload(state: .recovered, duration: 3184), needsReporting: true)

        XCTAssertEqual(eventStore.getSessionIdsWithUnBatchedEvents(), ["session1"])
    }
}
