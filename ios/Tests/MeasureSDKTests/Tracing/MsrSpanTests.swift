//
//  MsrSpanTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 13/04/25.
//

import XCTest
@testable import Measure

// swiftlint:disable force_cast
final class MsrSpanTests: XCTestCase { // swiftlint:disable:this type_body_length
    private var logger: MockLogger!
    private var timeProvider: MockTimeProvider!
    private var idProvider: MockIdProvider!
    private var spanProcessor: MockSpanProcessor!
    private var sessionManager: MockSessionManager!
    private var traceSampler: MockTraceSampler!

    override func setUp() {
        super.setUp()
        logger = MockLogger()
        timeProvider = MockTimeProvider()
        idProvider = MockIdProvider()
        spanProcessor = MockSpanProcessor()
        sessionManager = MockSessionManager(sessionId: "session-id")
        traceSampler = MockTraceSampler()
    }

    override func tearDown() {
        logger = nil
        timeProvider = nil
        idProvider = nil
        spanProcessor = nil
        sessionManager = nil
        traceSampler = nil
        super.tearDown()
    }

    func test_startSpan_setsParentSpanIfProvided() {
        let parentSpan = MsrSpan(logger: logger,
                                 timeProvider: timeProvider,
                                 isSampled: traceSampler.shouldSample(),
                                 name: "parent-span",
                                 spanId: "span-id",
                                 traceId: "trace-id",
                                 parentId: nil,
                                 sessionId: sessionManager.sessionId,
                                 startTime: 1000,
                                 spanProcessor: spanProcessor)
        let span = MsrSpan.startSpan(name: "span-name",
                                     logger: logger,
                                     timeProvider: timeProvider,
                                     sessionManager: sessionManager,
                                     idProvider: idProvider,
                                     traceSampler: traceSampler,
                                     parentSpan: parentSpan,
                                     spanProcessor: spanProcessor)

        XCTAssertEqual(span.parentId, parentSpan.spanId)
    }

    func test_startSpan_setsCurrentTimestamp() {
        timeProvider.current = 1000
        let span = MsrSpan.startSpan(name: "span-name",
                                     logger: logger,
                                     timeProvider: timeProvider,
                                     sessionManager: sessionManager,
                                     idProvider: idProvider,
                                     traceSampler: traceSampler,
                                     parentSpan: nil,
                                     spanProcessor: spanProcessor) as! MsrSpan
        XCTAssertEqual(span.startTime, 1000)
    }

    func test_startSpan_setsTimestampIfProvided() {
        let timestamp: Int64 = 10000
        let span = MsrSpan.startSpan(name: "span-name",
                                     logger: logger,
                                     timeProvider: timeProvider,
                                     sessionManager: sessionManager,
                                     idProvider: idProvider,
                                     traceSampler: traceSampler,
                                     parentSpan: nil,
                                     spanProcessor: spanProcessor,
                                     timestamp: timestamp) as! MsrSpan
        XCTAssertEqual(span.startTime, timestamp)
    }

    func test_startSpan_triggersSpanProcessorOnStart() {
        let span = MsrSpan.startSpan(name: "span-name",
                                     logger: logger,
                                     timeProvider: timeProvider,
                                     sessionManager: sessionManager,
                                     idProvider: idProvider,
                                     traceSampler: traceSampler,
                                     parentSpan: nil,
                                     spanProcessor: spanProcessor) as! MsrSpan
        spanProcessor.verifyOnStartCalled(with: span)
    }

    func test_defaultSpanStatus_isUnset() {
        let span = MsrSpan.startSpan(name: "span-name",
                                     logger: logger,
                                     timeProvider: timeProvider,
                                     sessionManager: sessionManager,
                                     idProvider: idProvider,
                                     traceSampler: traceSampler,
                                     parentSpan: nil,
                                     spanProcessor: spanProcessor) as! MsrSpan
        XCTAssertEqual(span.getStatus(), .unset)
    }

    func test_setStatus_updatesSpanStatus() {
        let span = MsrSpan.startSpan(name: "span-name",
                                     logger: logger,
                                     timeProvider: timeProvider,
                                     sessionManager: sessionManager,
                                     idProvider: idProvider,
                                     traceSampler: traceSampler,
                                     parentSpan: nil,
                                     spanProcessor: spanProcessor) as! MsrSpan
        span.setStatus(.ok)
        XCTAssertEqual(span.getStatus(), .ok)
    }

    func test_setName_updatesSpanName() {
        let span = MsrSpan.startSpan(name: "span-name",
                                     logger: logger,
                                     timeProvider: timeProvider,
                                     sessionManager: sessionManager,
                                     idProvider: idProvider,
                                     traceSampler: traceSampler,
                                     parentSpan: nil,
                                     spanProcessor: spanProcessor) as! MsrSpan
        span.setName("updated-span-name")
        XCTAssertEqual(span.name, "updated-span-name")
    }

    func test_hasEnded_forActiveSpan_isFalse() {
        let span = MsrSpan.startSpan(name: "span-name",
                                     logger: logger,
                                     timeProvider: timeProvider,
                                     sessionManager: sessionManager,
                                     idProvider: idProvider,
                                     traceSampler: traceSampler,
                                     parentSpan: nil,
                                     spanProcessor: spanProcessor) as! MsrSpan
        XCTAssertFalse(span.hasEnded())
    }

    func test_hasEnded_forEndedSpan_isTrue() {
        let span = MsrSpan.startSpan(name: "span-name",
                                     logger: logger,
                                     timeProvider: timeProvider,
                                     sessionManager: sessionManager,
                                     idProvider: idProvider,
                                     traceSampler: traceSampler,
                                     parentSpan: nil,
                                     spanProcessor: spanProcessor) as! MsrSpan
        span.end()
        XCTAssertTrue(span.hasEnded())
    }

    func test_end_updatesSpanDuration() {
        timeProvider.current = 1000
        let span = MsrSpan.startSpan(name: "span-name",
                                     logger: logger,
                                     timeProvider: timeProvider,
                                     sessionManager: sessionManager,
                                     idProvider: idProvider,
                                     traceSampler: traceSampler,
                                     parentSpan: nil,
                                     spanProcessor: spanProcessor) as! MsrSpan
        timeProvider.current = 2000
        let duration = span.end().getDuration()
        XCTAssertEqual(duration, 1000)
    }

    func test_setCheckpoint_addsCheckpoint() {
        let span = MsrSpan.startSpan(name: "span-name",
                                     logger: logger,
                                     timeProvider: timeProvider,
                                     sessionManager: sessionManager,
                                     idProvider: idProvider,
                                     traceSampler: traceSampler,
                                     parentSpan: nil,
                                     spanProcessor: spanProcessor) as! MsrSpan
        span.setCheckpoint("checkpoint")
        XCTAssertEqual(span.checkpoints.count, 1)
        XCTAssertEqual(span.checkpoints.first?.name, "checkpoint")
    }

    func test_setCheckpoint_onEndedSpan_doesNotAdd() {
        let span = MsrSpan.startSpan(name: "span-name",
                                     logger: logger,
                                     timeProvider: timeProvider,
                                     sessionManager: sessionManager,
                                     idProvider: idProvider,
                                     traceSampler: traceSampler,
                                     parentSpan: nil,
                                     spanProcessor: spanProcessor).end() as! MsrSpan
        span.setCheckpoint("event-id")
        XCTAssertEqual(span.checkpoints.count, 0)
    }

    func test_setAttribute_addsKeyValuePair() {
        let span = MsrSpan.startSpan(name: "span-name",
                                     logger: logger,
                                     timeProvider: timeProvider,
                                     sessionManager: sessionManager,
                                     idProvider: idProvider,
                                     traceSampler: traceSampler,
                                     parentSpan: nil,
                                     spanProcessor: spanProcessor) as! MsrSpan
        span.setAttribute("key", value: "value")
        XCTAssertEqual(span.getUserDefinedAttrs()["key"] as! String, "value")
    }

    func test_setAttribute_onEndedSpan_doesNothing() {
        let span = MsrSpan.startSpan(name: "span-name",
                                     logger: logger,
                                     timeProvider: timeProvider,
                                     sessionManager: sessionManager,
                                     idProvider: idProvider,
                                     traceSampler: traceSampler,
                                     parentSpan: nil,
                                     spanProcessor: spanProcessor).end() as! MsrSpan
        span.setAttribute("key", value: "value")
        XCTAssertEqual(span.getUserDefinedAttrs().count, 0)
    }

    func test_removeAttribute_removesKey() {
        let span = MsrSpan.startSpan(name: "span-name",
                                     logger: logger,
                                     timeProvider: timeProvider,
                                     sessionManager: sessionManager,
                                     idProvider: idProvider,
                                     traceSampler: traceSampler,
                                     parentSpan: nil,
                                     spanProcessor: spanProcessor) as! MsrSpan
        span.setAttribute("key", value: "value")
        span.removeAttribute("key")
        XCTAssertEqual(span.getUserDefinedAttrs().count, 0)
    }

    func test_duration_isZeroForActiveSpan() {
        timeProvider.current = 1000
        let span = MsrSpan.startSpan(name: "span-name",
                                     logger: logger,
                                     timeProvider: timeProvider,
                                     sessionManager: sessionManager,
                                     idProvider: idProvider,
                                     traceSampler: traceSampler,
                                     parentSpan: nil,
                                     spanProcessor: spanProcessor) as! MsrSpan
        timeProvider.current = 2000
        XCTAssertEqual(span.getDuration(), 0)
    }

    func test_samplingState_rootSpan() {
        traceSampler.sample = true
        let sampledSpan = MsrSpan.startSpan(name: "sampled",
                                            logger: logger,
                                            timeProvider: timeProvider,
                                            sessionManager: sessionManager,
                                            idProvider: idProvider,
                                            traceSampler: traceSampler,
                                            parentSpan: nil,
                                            spanProcessor: spanProcessor)
        XCTAssertTrue(sampledSpan.isSampled)

        traceSampler.sample = false
        let unsampledSpan = MsrSpan.startSpan(name: "unsampled",
                                              logger: logger,
                                              timeProvider: timeProvider,
                                              sessionManager: sessionManager,
                                              idProvider: idProvider,
                                              traceSampler: traceSampler,
                                              parentSpan: nil,
                                              spanProcessor: spanProcessor)
        XCTAssertFalse(unsampledSpan.isSampled)
    }

    func test_samplingState_childSpanInheritsFromParent() {
        traceSampler.sample = true
        let parentSpan = MsrSpan.startSpan(name: "parent",
                                           logger: logger,
                                           timeProvider: timeProvider,
                                           sessionManager: sessionManager,
                                           idProvider: idProvider,
                                           traceSampler: traceSampler,
                                           parentSpan: nil,
                                           spanProcessor: spanProcessor)

        traceSampler.sample = false
        let childSpan = MsrSpan.startSpan(name: "child",
                                          logger: logger,
                                          timeProvider: timeProvider,
                                          sessionManager: sessionManager,
                                          idProvider: idProvider,
                                          traceSampler: traceSampler,
                                          parentSpan: parentSpan,
                                          spanProcessor: spanProcessor)
        XCTAssertTrue(childSpan.isSampled)

        traceSampler.sample = false
        let unsampledParent = MsrSpan.startSpan(name: "unsampled-parent",
                                                logger: logger,
                                                timeProvider: timeProvider,
                                                sessionManager: sessionManager,
                                                idProvider: idProvider,
                                                traceSampler: traceSampler,
                                                parentSpan: nil,
                                                spanProcessor: spanProcessor)
        traceSampler.sample = true
        let unsampledChild = MsrSpan.startSpan(name: "child",
                                               logger: logger,
                                               timeProvider: timeProvider,
                                               sessionManager: sessionManager,
                                               idProvider: idProvider,
                                               traceSampler: traceSampler,
                                               parentSpan: unsampledParent,
                                               spanProcessor: spanProcessor)
        XCTAssertFalse(unsampledChild.isSampled)
    }

    func test_parentAndTraceId_areCorrectlyInherited() {
        let parent = MsrSpan.startSpan(name: "parent",
                                       logger: logger,
                                       timeProvider: timeProvider,
                                       sessionManager: sessionManager,
                                       idProvider: idProvider,
                                       traceSampler: traceSampler,
                                       parentSpan: nil,
                                       spanProcessor: spanProcessor)
        let child = MsrSpan.startSpan(name: "child",
                                      logger: logger,
                                      timeProvider: timeProvider,
                                      sessionManager: sessionManager,
                                      idProvider: idProvider,
                                      traceSampler: traceSampler,
                                      parentSpan: parent,
                                      spanProcessor: spanProcessor)
        XCTAssertEqual(child.traceId, parent.traceId)
        XCTAssertEqual(child.parentId, parent.spanId)
    }

    func test_setParent_assignsTraceAndParentId() {
        let parent = MsrSpan.startSpan(name: "parent",
                                       logger: logger,
                                       timeProvider: timeProvider,
                                       sessionManager: sessionManager,
                                       idProvider: idProvider,
                                       traceSampler: traceSampler,
                                       parentSpan: nil,
                                       spanProcessor: spanProcessor)
        let child = MsrSpan.startSpan(name: "child",
                                      logger: logger,
                                      timeProvider: timeProvider,
                                      sessionManager: sessionManager,
                                      idProvider: idProvider,
                                      traceSampler: traceSampler,
                                      parentSpan: nil,
                                      spanProcessor: spanProcessor)
        child.setParent(parent)
        XCTAssertEqual(child.traceId, parent.traceId)
        XCTAssertEqual(child.parentId, parent.spanId)
    }
}
// swiftlint:enable force_cast
