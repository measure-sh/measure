//
//  MsrObjCSpanTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 05/05/26.
//

import XCTest
@testable import Measure

final class MsrObjCSpanTests: XCTestCase {
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

    private func makeSpan(name: String = "test-span") -> MsrSpan {
        MsrSpan.startSpan(name: name,
                          logger: logger,
                          timeProvider: timeProvider,
                          sessionManager: sessionManager,
                          idProvider: idProvider,
                          signalSampler: signalSampler,
                          parentSpan: nil,
                          spanProcessor: spanProcessor) as! MsrSpan
    }

    private func makeObjCSpan(name: String = "test-span") -> MsrObjCSpan {
        MsrObjCSpan(makeSpan(name: name), attributeTransformer: attributeTransformer)
    }

    func test_properties_delegateToUnderlyingSpan() {
        idProvider.spanid = "span-123"
        idProvider.traceid = "trace-456"
        let span = makeObjCSpan()

        XCTAssertEqual(span.spanId, "span-123")
        XCTAssertEqual(span.traceId, "trace-456")
        XCTAssertNil(span.parentId)
        XCTAssertEqual(span.isSampled, signalSampler.shouldTrackTrace())
    }

    func test_setStatus_unset_mapsCorrectly() {
        let span = makeObjCSpan()
        span.setStatus(.unset)

        XCTAssertEqual((span.span as? InternalSpan)?.getStatus(), .unset)
    }

    func test_setStatus_ok_mapsCorrectly() {
        let span = makeObjCSpan()
        span.setStatus(.ok)

        XCTAssertEqual((span.span as? InternalSpan)?.getStatus(), .ok)
    }

    func test_setStatus_error_mapsCorrectly() {
        let span = makeObjCSpan()
        span.setStatus(.error)

        XCTAssertEqual((span.span as? InternalSpan)?.getStatus(), .error)
    }

    func test_setParent_setsParentIdOnChildSpan() {
        let parent = makeObjCSpan(name: "parent")
        let child = makeObjCSpan(name: "child")

        child.setParent(parent)

        XCTAssertEqual(child.parentId, parent.spanId)
    }

    func test_setAttributes_usesTransformer() {
        let span = makeObjCSpan()
        span.setAttributes(["count": 1])

        XCTAssertEqual(attributeTransformer.transformCallCount, 1)
        XCTAssertEqual(attributeTransformer.lastInput?["count"] as? Int, 1)
    }

    func test_invalid_hasInvalidSpanValues() {
        XCTAssertEqual(MsrObjCSpan.invalid.spanId, "invalid-span-id")
        XCTAssertEqual(MsrObjCSpan.invalid.traceId, "invalid-trace-id")
        XCTAssertFalse(MsrObjCSpan.invalid.isSampled)
    }
}
