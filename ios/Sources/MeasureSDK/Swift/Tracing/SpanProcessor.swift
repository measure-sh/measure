import Foundation

/// Protocol for processing spans at different stages of their lifecycle.
protocol SpanProcessor {
    /// Called when a span is started.
    ///
    /// - Parameter span: The span that was started
    func onStart(_ span: InternalSpan)

    /// Called when a span is about to end.
    ///
    /// - Parameter span: The span that is ending
    func onEnding(_ span: InternalSpan)

    /// Called when a span has ended.
    ///
    /// - Parameter span: The span that has ended
    func onEnded(_ span: InternalSpan)

    /// Function called once the dynamic config gets loaded in memory.
    func onConfigLoaded()
}

/// A concrete implementation of `SpanProcessor` that processes spans at different stages of their lifecycle.
final class BaseSpanProcessor: SpanProcessor {
    private let logger: Logger
    private let signalProcessor: SignalProcessor
    private let attributeProcessors: [AttributeProcessor]
    private let configProvider: ConfigProvider
    private let sampler: SignalSampler
    private var spansBuffer: [InternalSpan]?
    private let bufferLock = NSLock()
    private let attributeValueValidator: AttributeValueValidator

    init(logger: Logger,
         signalProcessor: SignalProcessor,
         attributeProcessors: [AttributeProcessor],
         configProvider: ConfigProvider,
         sampler: SignalSampler,
         attributeValueValidator: AttributeValueValidator) {
        self.logger = logger
        self.signalProcessor = signalProcessor
        self.attributeProcessors = attributeProcessors
        self.configProvider = configProvider
        self.sampler = sampler
        self.attributeValueValidator = attributeValueValidator
        self.spansBuffer = []
    }

    func onStart(_ span: InternalSpan) {
        SignPost.trace(subcategory: "Span", label: "spanProcessorOnStart") {
            logger.log(level: .debug, message: "Span started: \(span.name)", error: nil, data: nil)

            let threadName = OperationQueue.current?.underlyingQueue?.label ?? "unknown"

            let attributes = Attributes()
            attributes.threadName = threadName
            attributes.deviceLowPowerMode =
                ProcessInfo.processInfo.isLowPowerModeEnabled

            attributeProcessors.forEach {
                $0.appendAttributes(attributes)
            }

            span.setInternalAttribute(attributes)

            // Buffer span until config is loaded
            bufferLock.lock()
            spansBuffer?.append(span)
            bufferLock.unlock()
        }
    }

    func onEnding(_ span: InternalSpan) {
        // No-op in current implementation
    }

    func onEnded(_ span: InternalSpan) {
        SignPost.trace(subcategory: "Span", label: "spanProcessorOnEnded") {
            bufferLock.lock()
            let buffering = spansBuffer != nil
            bufferLock.unlock()

            guard !buffering else {
                return
            }

            processSpan(span)
        }
    }

    func onConfigLoaded() {
        logger.log(level: .debug, message: "SpanProcessor config loaded", error: nil, data: nil)

        bufferLock.lock()
        let pendingSpans = spansBuffer ?? []
        spansBuffer = nil
        bufferLock.unlock()

        pendingSpans.forEach { span in
            let isSampled = sampler.shouldSampleTrace(span.traceId)
            span.setSamplingRate(isSampled)

            if span.hasEnded() {
                processSpan(span)
            }
        }
    }

    /// Sanitizes the span data according to configuration rules.
    /// - Parameter spanData: The span data to sanitize
    /// - Returns: a valid `SpanData` object and should be processed, nil if it should be discarded
    private func processSpan(_ span: InternalSpan) {
        if let sanitized = sanitize(span.toSpanData()) {
            signalProcessor.trackSpan(sanitized)

            logger.log(level: .debug, message: "Span ended: \(sanitized.name), duration: \(sanitized.duration)", error: nil, data: nil)
        } else {
            bufferLock.lock()
            spansBuffer?.removeAll { $0.spanId == span.spanId }
            bufferLock.unlock()
        }
    }

    private func sanitize(_ spanData: SpanData) -> SpanData? {
        // Discard span if its duration is negative
        if spanData.duration < 0 {
            logger.log(level: .error,
                       message: "Invalid span: \(spanData.name), duration is negative, span will be dropped",
                       error: nil,
                       data: nil)
            return nil
        }

        // Discard span if it exceeds max span name length
        if spanData.name.count > configProvider.maxSpanNameLength {
            logger.log(level: .error,
                       message: "Invalid span: \(spanData.name), length \(spanData.name.count) exceeded max allowed, span will be dropped",
                       error: nil,
                       data: nil)
            return nil
        }

        let userDefinedAttrs = attributeValueValidator.dropInvalidAttributes(name: "Span: \(spanData.name)", attributes: spanData.userDefinedAttrs)

        // Clean up checkpoints
        var sanitizedCheckpoints = spanData.checkpoints

        let initialSize = sanitizedCheckpoints.count
        sanitizedCheckpoints.removeAll { checkpoint in
            checkpoint.name.count > configProvider.maxCheckpointNameLength
        }

        if sanitizedCheckpoints.count < initialSize {
            logger.log(level: .error,
                       message: "Invalid span: \(spanData.name), dropped \(initialSize - sanitizedCheckpoints.count) checkpoints due to invalid name",
                       error: nil,
                       data: nil)
        }

        if sanitizedCheckpoints.count > configProvider.maxCheckpointsPerSpan {
            logger.log(level: .error,
                       message: "Invalid span: \(spanData.name), max checkpoints exceeded, some checkpoints will be dropped",
                       error: nil,
                       data: nil)
            sanitizedCheckpoints = Array(sanitizedCheckpoints.prefix(Int(configProvider.maxCheckpointsPerSpan)))
        }

        // All validations passed, return a sanitized copy
        return SpanData(name: spanData.name,
                        traceId: spanData.traceId,
                        spanId: spanData.spanId,
                        parentId: spanData.parentId,
                        sessionId: spanData.sessionId,
                        startTime: spanData.startTime,
                        endTime: spanData.endTime,
                        duration: spanData.duration,
                        status: spanData.status,
                        attributes: spanData.attributes,
                        userDefinedAttrs: userDefinedAttrs,
                        checkpoints: sanitizedCheckpoints,
                        hasEnded: spanData.hasEnded,
                        isSampled: spanData.isSampled)
    }
}
