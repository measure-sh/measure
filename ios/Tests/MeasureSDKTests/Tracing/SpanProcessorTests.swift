//
//  SpanProcessorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 16/04/25.
//

import XCTest
@testable import Measure

final class BaseSpanProcessorTests: XCTestCase {
    private var logger: MockLogger!
    private var signalProcessor: MockSignalProcessor!
    private var configProvider: MockConfigProvider!

    override func setUp() {
        super.setUp()
        logger = MockLogger()
        signalProcessor = MockSignalProcessor()
        configProvider = MockConfigProvider()
    }

    override func tearDown() {
        logger = nil
        signalProcessor = nil
        configProvider = nil
        super.tearDown()
    }

    private func getSpan(logger: Logger,
                         timeProvider: TimeProvider,
                         spanProcessor: SpanProcessor,
                         name: String = "span-name",
                         spanId: String = "span-id",
                         traceId: String = "trace-id",
                         parentId: String? = nil,
                         sessionId: String = "session-id",
                         startTime: Int64 = 987654321,
                         isSampled: Bool = true) -> MsrSpan {
        return MsrSpan(logger: logger,
                       timeProvider: timeProvider,
                       isSampled: isSampled,
                       name: name,
                       spanId: spanId,
                       traceId: traceId,
                       parentId: parentId,
                       sessionId: sessionId,
                       startTime: startTime,
                       spanProcessor: spanProcessor)
    }

    func test_onStart_appendsAttributesToSpan() {
        let timeProvider = MockTimeProvider()
        let attributeProcessor = MockAttributeProcessor { attributes in
            attributes.deviceName = "test-device"
        }

        let spanProcessor = BaseSpanProcessor(
            logger: logger,
            signalProcessor: signalProcessor,
            attributeProcessors: [attributeProcessor],
            configProvider: configProvider
        )

        let span = getSpan(
            logger: logger,
            timeProvider: timeProvider,
            spanProcessor: spanProcessor
        )

        spanProcessor.onStart(span)
        let attributes = span.attributes

        XCTAssertEqual(attributes?.deviceName, "test-device")
    }

    func test_onStart_addsThreadNameToAttributes() {
        let timeProvider = MockTimeProvider()
        let attributeProcessor = MockAttributeProcessor { attributes in
            attributes.threadName = "unknown"
        }
        let spanProcessor = BaseSpanProcessor(
            logger: logger,
            signalProcessor: signalProcessor,
            attributeProcessors: [attributeProcessor],
            configProvider: configProvider
        )

        let span = getSpan(
            logger: logger,
            timeProvider: timeProvider,
            spanProcessor: spanProcessor
        )

        spanProcessor.onStart(span)
        XCTAssertEqual(span.attributes?.threadName, "unknown")
    }

    func test_onEnded_delegatesToSignalProcessor() {
        let spanProcessor = BaseSpanProcessor(
            logger: logger,
            signalProcessor: signalProcessor,
            attributeProcessors: [],
            configProvider: configProvider
        )

        let span = getSpan(
            logger: logger,
            timeProvider: MockTimeProvider(),
            spanProcessor: spanProcessor,
            startTime: 2000
        )
        span.end(timestamp: 3000)

        XCTAssertEqual(signalProcessor.spanData?.name, "span-name")
    }

    func test_onEnded_discardsSpanWithNegativeDuration() {
        let timeProvider = MockTimeProvider()
        timeProvider.current = 4000
        let spanProcessor = BaseSpanProcessor(
            logger: logger,
            signalProcessor: signalProcessor,
            attributeProcessors: [],
            configProvider: configProvider
        )

        let span = getSpan(
            logger: logger,
            timeProvider: timeProvider,
            spanProcessor: spanProcessor,
            startTime: 5000
        )
        span.end(timestamp: 4000)

        XCTAssertNil(signalProcessor.spanData)
    }

    func test_onEnded_discardsSpanWithLongName() {
        let longName = String(repeating: "a", count: configProvider.maxSpanNameLength + 1)
        let timeProvider = MockTimeProvider()
        timeProvider.current = 1000
        let spanProcessor = BaseSpanProcessor(
            logger: logger,
            signalProcessor: signalProcessor,
            attributeProcessors: [],
            configProvider: configProvider
        )

        let span = getSpan(
            logger: logger,
            timeProvider: timeProvider,
            spanProcessor: spanProcessor,
            name: longName
        )
        span.end(timestamp: 2000)

        XCTAssertNil(signalProcessor.spanData)
    }

    func test_onEnded_discardsCheckpointsWithLongNames() {
        let longName = String(repeating: "a", count: configProvider.maxCheckpointNameLength + 1)
        let spanProcessor = BaseSpanProcessor(
            logger: logger,
            signalProcessor: signalProcessor,
            attributeProcessors: [],
            configProvider: configProvider
        )

        let span = getSpan(
            logger: logger,
            timeProvider: MockTimeProvider(),
            spanProcessor: spanProcessor,
            startTime: 1000
        )
        span.setCheckpoint(longName)
        span.end(timestamp: 2000)

        XCTAssertEqual(signalProcessor.spanData?.checkpoints.count, 0)
    }

    func test_onEnded_limitsCheckpointCount() {
        let timeProvider = MockTimeProvider()
        let spanProcessor = BaseSpanProcessor(
            logger: logger,
            signalProcessor: signalProcessor,
            attributeProcessors: [],
            configProvider: configProvider
        )

        let span = getSpan(
            logger: logger,
            timeProvider: timeProvider,
            spanProcessor: spanProcessor,
            startTime: 1000
        )

        for _ in 0...(configProvider.maxCheckpointsPerSpan + 5) {
            span.setCheckpoint("checkpoint")
        }

        span.end(timestamp: 3000)
        XCTAssertEqual(signalProcessor.spanData?.checkpoints.count, configProvider.maxCheckpointsPerSpan)
    }
}
