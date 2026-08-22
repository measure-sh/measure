//
//  SerializationPerfTests.swift
//  PerfTests
//
//  Created by Adwin Ross on 22/08/26.
//

import XCTest
@testable import Measure

final class SerializationPerfTests: XCTestCase {
    private static var sink = 0

    private let current = EventSerializer()

    private var typicalEvents: [EventEntity] = []
    private var typicalSpans: [SpanEntity] = []
    private var attachmentEvents: [EventEntity] = []

    private var options: XCTMeasureOptions {
        let options = XCTMeasureOptions.default
        options.iterationCount = 10
        return options
    }

    private var metrics: [XCTMetric] {
        [XCTClockMetric(), XCTCPUMetric(), XCTMemoryMetric()]
    }

    private static let largeEvents = Fixtures.typicalBatch(eventCount: 3_800)
    private static let largeSpans = Fixtures.spans(count: 380)

    private var largeBatchOptions: XCTMeasureOptions {
        let options = XCTMeasureOptions.default
        options.iterationCount = 5
        return options
    }

    override func tearDown() {
        MallocCounter.shared.stop()
        super.tearDown()
    }

    override func setUpWithError() throws {
        try super.setUpWithError()
        typicalEvents = Fixtures.typicalBatch(eventCount: 500)
        typicalSpans = Fixtures.spans(count: 50)
        attachmentEvents = Fixtures.attachmentBatch(eventCount: 20,
                                                    attachmentsPerEvent: 2,
                                                    attachmentBytes: 250 * 1024)
    }

    func testCurrent_typicalBatch() {
        measure(metrics: metrics, options: options) {
            Self.sink += currentBatchPayload(events: typicalEvents, spans: typicalSpans).count
        }
    }

    func testCurrent_attachmentBatch() {
        measure(metrics: metrics, options: options) {
            Self.sink += currentBatchPayload(events: attachmentEvents, spans: []).count
        }
    }

    func testCurrent_largeBatch() {
        measure(metrics: metrics, options: largeBatchOptions) {
            Self.sink += currentBatchPayload(events: Self.largeEvents, spans: Self.largeSpans).count
        }
    }

    func testCurrent_largeBatch_allocations() {
        measure(metrics: [AllocationMetric()], options: largeBatchOptions) {
            Self.sink += currentBatchPayload(events: Self.largeEvents, spans: Self.largeSpans).count
        }
    }

    func testCurrent_eventsOnly() {
        measure(metrics: metrics, options: options) {
            for event in typicalEvents {
                Self.sink += current.getSerialisedEvent(for: event)?.count ?? 0
            }
        }
    }

    func testCurrent_typicalBatch_allocations() {
        measure(metrics: [AllocationMetric()], options: options) {
            Self.sink += currentBatchPayload(events: typicalEvents, spans: typicalSpans).count
        }
    }

    func testCurrent_attachmentBatch_allocations() {
        measure(metrics: [AllocationMetric()], options: options) {
            Self.sink += currentBatchPayload(events: attachmentEvents, spans: []).count
        }
    }

    func testCurrent_scalarEscaping_allocations() {
        let strings = [
            "9F0E9C3A-1F2B-4C3D-9E8F-0A1B2C3D4E5F", "2026-08-20T10:00:00.000Z", "gesture_click",
            "com.measure.export", "checkout_button", "id", "session_id", "timestamp", "type",
            "attribute", "user_defined_attribute", "attachments", "user_triggered"
        ]

        measure(metrics: [AllocationMetric()], options: options) {
            for _ in 0..<500 {
                for string in strings {
                    Self.sink += JSONWriter.escaped(string).count
                }
            }
        }
    }

    func testClockTicksAndCoreCountAreUsableOnThisDevice() {
        let sysCtl = BaseSysCtl()
        let ticks = sysCtl.getClockTicksPerSecond()
        let cores = sysCtl.getCpuCores()

        var systemInfo = utsname()
        uname(&systemInfo)
        let model = withUnsafePointer(to: &systemInfo.machine) {
            $0.withMemoryRebound(to: CChar.self, capacity: 1) { String(validatingUTF8: $0) ?? "unknown" }
        }

        print("""

        ── cpu_usage inputs on \(model) ──────────────────────────
        clock ticks/sec: \(ticks)
        cpu cores:       \(cores)
        ──────────────────────────────────────────────────────────

        """)

        XCTAssertGreaterThan(ticks, 0, "a zero clock tick rate gets the whole batch rejected by the backend")
        XCTAssertGreaterThan(cores, 0, "a zero core count gets the whole batch rejected by the backend")
    }

    func testAllocationCounterObservesKnownAllocations() throws {
        try XCTSkipUnless(MallocCounter.shared.isAvailable, "malloc_logger symbol is unavailable")

        let expected = 1_000
        var objects: [NSObject] = []
        objects.reserveCapacity(expected)

        MallocCounter.shared.start()
        for _ in 0..<expected {
            objects.append(NSObject())
        }
        MallocCounter.shared.stop()

        let result = MallocCounter.shared.lastResult
        XCTAssertEqual(objects.count, expected)
        XCTAssertGreaterThanOrEqual(result.count, Int64(expected),
                                    "expected at least \(expected) allocations, counted \(result.count)")
        XCTAssertGreaterThan(result.bytes, 0)
    }

    func testReportPayloadSizes() {
        let typical = currentBatchPayload(events: typicalEvents, spans: typicalSpans).count
        let attachments = currentBatchPayload(events: attachmentEvents, spans: []).count
        let large = currentBatchPayload(events: Self.largeEvents, spans: Self.largeSpans).count

        print("""

        ── payload sizes ─────────────────────────────────────────
        typical batch      \(typical) B
        attachment batch   \(attachments) B
        large batch        \(large) B
        ──────────────────────────────────────────────────────────

        """)

        XCTAssertGreaterThan(typical, 0)
        XCTAssertGreaterThan(attachments, 0)
        XCTAssertGreaterThan(large, 0)
    }

    private func currentBatchPayload(events: [EventEntity], spans: [SpanEntity]) -> Data {
        let serializedEvents = events.compactMap { current.getSerialisedEvent(for: $0) }
        let serializedSpans = spans.compactMap { current.serializeSpan($0) }

        let payloadSize = (serializedEvents + serializedSpans).reduce(0) { $0 + $1.count + 1 }
        var jsonBody = Data(capacity: payloadSize + 32)
        jsonBody.append(contentsOf: "{\"events\":".utf8)
        JSONWriter.appendArray(of: serializedEvents, to: &jsonBody)
        jsonBody.append(contentsOf: ",\"spans\":".utf8)
        JSONWriter.appendArray(of: serializedSpans, to: &jsonBody)
        jsonBody.append(contentsOf: "}".utf8)

        return jsonBody
    }
}
