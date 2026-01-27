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
    private var sampler: MockSignalSampler!
    private var attributeValueValidator: AttributeValueValidator!

    override func setUp() {
        super.setUp()
        logger = MockLogger()
        signalProcessor = MockSignalProcessor()
        configProvider = MockConfigProvider()
        sampler = MockSignalSampler()
        attributeValueValidator = BaseAttributeValueValidator(configProvider: configProvider, logger: logger)
    }

    override func tearDown() {
        logger = nil
        signalProcessor = nil
        configProvider = nil
        sampler = nil
        attributeValueValidator = nil
        super.tearDown()
    }

    private func makeSpan(
        spanProcessor: SpanProcessor,
        timeProvider: MockTimeProvider = MockTimeProvider(),
        name: String = "span-name",
        startTime: Int64? = nil,
        isSampled: Bool = true
    ) -> MsrSpan {

        let start = startTime ?? timeProvider.current

        return MsrSpan(
            logger: logger,
            timeProvider: timeProvider,
            isSampled: isSampled,
            name: name,
            spanId: "span-id",
            traceId: "trace-id",
            parentId: nil,
            sessionId: "session-id",
            startTime: start,
            spanProcessor: spanProcessor
        )
    }

    private func makeProcessor(attributeProcessors: [AttributeProcessor] = []) -> BaseSpanProcessor {
        BaseSpanProcessor(
            logger: logger,
            signalProcessor: signalProcessor,
            attributeProcessors: attributeProcessors,
            configProvider: configProvider,
            sampler: sampler,
            attributeValueValidator: attributeValueValidator
        )
    }

    // MARK: onStart

    func test_onStart_setsThreadNameAndCustomAttributes() {
        let attributeProcessor = MockAttributeProcessor {
            $0.deviceName = "test-device"
        }

        let processor = makeProcessor(attributeProcessors: [attributeProcessor])
        processor.onConfigLoaded()

        let span = makeSpan(spanProcessor: processor)
        processor.onStart(span)

        let attrs = span.toSpanData().attributes

        XCTAssertEqual(attrs?.deviceName, "test-device")
        XCTAssertNotNil(attrs?.threadName)
    }

    // MARK: forwarding

    func test_onEnded_tracksSpanAfterConfigLoaded() {
        let processor = makeProcessor()
        processor.onConfigLoaded()

        let span = makeSpan(spanProcessor: processor)
        span.end()

        XCTAssertEqual(signalProcessor.trackSpanCallCount, 1)
        XCTAssertEqual(signalProcessor.spanData?.name, "span-name")
    }

    func test_onEnded_buffersUntilConfigLoaded() {
        let processor = makeProcessor()

        let span = makeSpan(spanProcessor: processor)
        processor.onStart(span)
        span.end()

        XCTAssertEqual(signalProcessor.trackSpanCallCount, 0)

        processor.onConfigLoaded()

        XCTAssertEqual(signalProcessor.trackSpanCallCount, 1)
    }

    func test_onConfigLoaded_onlyProcessesBufferedSpansOnce() {
        let processor = makeProcessor()

        let span = makeSpan(spanProcessor: processor)
        processor.onStart(span)
        span.end()

        processor.onConfigLoaded()
        processor.onConfigLoaded()

        XCTAssertEqual(signalProcessor.trackSpanCallCount, 1)
    }

    // MARK: sampling

    func test_onConfigLoaded_appliesSamplingToBufferedSpan() {
        let processor = makeProcessor()

        let span = makeSpan(spanProcessor: processor, isSampled: false)
        processor.onStart(span)
        span.end()

        sampler.shouldSampleTraceReturnValue = true
        processor.onConfigLoaded()

        XCTAssertTrue(span.isSampled)
    }

    // MARK: sanitization

    func test_discardsSpanWithNegativeDuration() {
        let processor = makeProcessor()
        processor.onConfigLoaded()

        let time = MockTimeProvider()
        time.current = 1000

        let span = makeSpan(spanProcessor: processor, timeProvider: time, startTime: 2000)
        span.end(timestamp: 1000)

        XCTAssertEqual(signalProcessor.trackSpanCallCount, 0)
    }

    func test_discardsSpanWhenNameTooLong() {
        let processor = makeProcessor()
        processor.onConfigLoaded()

        let longName = String(repeating: "s", count: Int(configProvider.maxSpanNameLength) + 1)
        makeSpan(spanProcessor: processor, name: longName).end()

        XCTAssertEqual(signalProcessor.trackSpanCallCount, 0)
    }

    func test_sanitizesCheckpoints() {
        let processor = makeProcessor()
        processor.onConfigLoaded()

        let span = makeSpan(spanProcessor: processor)

        let long = String(repeating: "x", count: Int(configProvider.maxCheckpointNameLength) + 1)
        span.setCheckpoint(long)
        span.setCheckpoint("valid")

        span.end()

        let tracked = signalProcessor.spanData!
        XCTAssertEqual(tracked.checkpoints.count, 1)
        XCTAssertEqual(tracked.checkpoints.first?.name, "valid")
    }

    func test_limitsCheckpointCount() {
        let processor = makeProcessor()
        processor.onConfigLoaded()

        let span = makeSpan(spanProcessor: processor)

        for _ in 0...configProvider.maxCheckpointsPerSpan {
            span.setCheckpoint("cp")
        }

        span.end()

        XCTAssertEqual(signalProcessor.spanData?.checkpoints.count,
                       Int(configProvider.maxCheckpointsPerSpan))
    }

    func test_dropsInvalidUserAttributes() {
        let processor = makeProcessor()
        processor.onConfigLoaded()

        let span = makeSpan(spanProcessor: processor)

        span.setAttribute(
            String(repeating: "k", count: Int(configProvider.maxUserDefinedAttributeKeyLength) + 1),
            value: "value"
        )
        span.setAttribute("valid", value: "value")

        span.end()

        let tracked = signalProcessor.spanData!

        XCTAssertEqual(tracked.userDefinedAttrs?.count, 1)
        XCTAssertEqual(tracked.userDefinedAttrs?["valid"]?.value as? String, "value")
    }
}

//    func test_onConfigLoaded_setsSamplingRateOnBufferedSpans() {
//        let processor = makeProcessor()
//
//        let span = makeSpan(spanProcessor: processor, startTime: 0, isSampled: false)
//        processor.onStart(span)
//        span.end()
//
//        sampler.setSampled(true)
//        processor.onConfigLoaded()
//
//        XCTAssertTrue(span.isSampled)
//    }
//
//    func test_onConfigLoaded_onlyProcessesBufferedSpansOnce() {
//        let processor = makeProcessor()
//
//        let span = makeSpan(spanProcessor: processor, startTime: 0)
//        processor.onStart(span)
//        span.end()
//
//        processor.onConfigLoaded()
//        processor.onConfigLoaded()
//
//        XCTAssertEqual(signalProcessor.trackSpanCallCount, 1)
//    }
//}
