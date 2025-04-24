//
//  MsrSpanBuilderTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 16/04/25.
//

import XCTest
@testable import Measure

final class MsrSpanBuilderTests: XCTestCase {
    private var idProvider: MockIdProvider!
    private var timeProvider: MockTimeProvider!
    private var logger: MockLogger!
    private var spanProcessor: MockSpanProcessor!
    private var sessionManager: MockSessionManager!
    private var traceSampler: MockTraceSampler!

    override func setUp() {
        super.setUp()
        idProvider = MockIdProvider()
        timeProvider = MockTimeProvider()
        logger = MockLogger()
        spanProcessor = MockSpanProcessor()
        sessionManager = MockSessionManager(sessionId: "session-id")
        traceSampler = MockTraceSampler()
    }

    override func tearDown() {
        idProvider = nil
        timeProvider = nil
        logger = nil
        spanProcessor = nil
        sessionManager = nil
        traceSampler = nil
        super.tearDown()
    }

    func test_setParent_setsParentCorrectly() {
        let parentSpan = MsrSpan.startSpan(name: "parent",
                                           logger: logger,
                                           timeProvider: timeProvider,
                                           sessionManager: sessionManager,
                                           idProvider: idProvider,
                                           traceSampler: traceSampler,
                                           parentSpan: nil,
                                           spanProcessor: spanProcessor)

        let span = MsrSpanBuilder(name: "child",
                                  idProvider: idProvider,
                                  timeProvider: timeProvider,
                                  spanProcessor: spanProcessor,
                                  sessionManager: sessionManager,
                                  traceSampler: traceSampler,
                                  logger: logger).setParent(parentSpan).startSpan()

        XCTAssertEqual(span.parentId, parentSpan.spanId)
    }

    func test_startSpan_usesCurrentTimeFromTimeProvider() {
        timeProvider.current = 100000
        let span = MsrSpanBuilder(name: "test-span",
                                  idProvider: idProvider,
                                  timeProvider: timeProvider,
                                  spanProcessor: spanProcessor,
                                  sessionManager: sessionManager,
                                  traceSampler: traceSampler,
                                  logger: logger).startSpan() as? MsrSpan

        XCTAssertEqual(span!.startTime, 100000)
    }

    func test_startSpan_withTimestampUsesExplicitValue() {
        let span = MsrSpanBuilder(name: "test-span",
                                  idProvider: idProvider,
                                  timeProvider: timeProvider,
                                  spanProcessor: spanProcessor,
                                  sessionManager: sessionManager,
                                  traceSampler: traceSampler,
                                  logger: logger).startSpan(1000001) as? MsrSpan

        XCTAssertEqual(span!.startTime, 1000001)
    }
}
