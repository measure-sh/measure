//
//  MsrObjCSpanBuilderTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 05/05/26.
//

import XCTest
@testable import Measure

final class MsrObjCSpanBuilderTests: XCTestCase {
    private var logger: MockLogger!
    private var timeProvider: MockTimeProvider!
    private var idProvider: MockIdProvider!
    private var spanProcessor: MockSpanProcessor!
    private var sessionManager: MockSessionManager!
    private var signalSampler: MockSignalSampler!
    private var attributeTransformer: MockAttributeTransformer!

    override func setUp() {
        super.setUp()
        logger = MockLogger()
        timeProvider = MockTimeProvider()
        idProvider = MockIdProvider()
        spanProcessor = MockSpanProcessor()
        sessionManager = MockSessionManager(sessionId: "session-id")
        signalSampler = MockSignalSampler()
        attributeTransformer = MockAttributeTransformer()
    }

    override func tearDown() {
        logger = nil
        timeProvider = nil
        idProvider = nil
        spanProcessor = nil
        sessionManager = nil
        signalSampler = nil
        attributeTransformer = nil
        super.tearDown()
    }

    private func makeObjCBuilder(name: String = "test-span") -> MsrObjCSpanBuilder {
        let builder = MsrSpanBuilder(name: name,
                                     idProvider: idProvider,
                                     timeProvider: timeProvider,
                                     spanProcessor: spanProcessor,
                                     sessionManager: sessionManager,
                                     signalSampler: signalSampler,
                                     logger: logger)
        return MsrObjCSpanBuilder(builder, attributeTransformer: attributeTransformer)
    }

    private func makeObjCParentSpan() -> MsrObjCSpan {
        let span = MsrSpan.startSpan(name: "parent",
                                     logger: logger,
                                     timeProvider: timeProvider,
                                     sessionManager: sessionManager,
                                     idProvider: idProvider,
                                     signalSampler: signalSampler,
                                     parentSpan: nil,
                                     spanProcessor: spanProcessor)
        return MsrObjCSpan(span, attributeTransformer: attributeTransformer)
    }

    func test_setParent_setsParentIdOnStartedSpan() {
        let parent = makeObjCParentSpan()
        let child = makeObjCBuilder().setParent(parent).startSpan()

        XCTAssertEqual(child.parentId, parent.spanId)
    }

    func test_startSpan_returnsWrappedMsrObjCSpan() {
        let result = makeObjCBuilder().startSpan()

        XCTAssertNotNil(result.span as? MsrSpan)
    }

    func test_startSpanWithTimestamp_passesTimestampToUnderlyingSpan() {
        let result = makeObjCBuilder().startSpan(timestamp: 99999)

        XCTAssertEqual((result.span as? InternalSpan)?.startTime, 99999)
    }

    func test_startSpan_propagatesTransformerToResultingSpan() {
        let span = makeObjCBuilder().startSpan()
        span.setAttributes(["key": "value"])

        XCTAssertEqual(attributeTransformer.transformCallCount, 1)
    }
}
