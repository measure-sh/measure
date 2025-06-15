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
    
    func trackSpan(_ spanData: SpanData)
}

/// A concrete implementation of `SpanProcessor` that processes spans at different stages of their lifecycle.
final class BaseSpanProcessor: SpanProcessor {
    private let logger: Logger
    private let signalProcessor: SignalProcessor
    private let attributeProcessors: [AttributeProcessor]
    private let configProvider: ConfigProvider

    init(logger: Logger,
         signalProcessor: SignalProcessor,
         attributeProcessors: [AttributeProcessor],
         configProvider: ConfigProvider) {
        self.logger = logger
        self.signalProcessor = signalProcessor
        self.attributeProcessors = attributeProcessors
        self.configProvider = configProvider
    }

    func onStart(_ span: InternalSpan) {
        SignPost.trace(subcategory: "Span", label: "spanProcessorOnStart") {
            logger.log(level: .debug, message: "Span started: \(span.name)", error: nil, data: nil)
            let threadName = OperationQueue.current?.underlyingQueue?.label ?? "unknown"
            var attributes = Attributes()
            attributes.threadName = threadName
            attributes.deviceLowPowerMode = ProcessInfo.processInfo.isLowPowerModeEnabled
            attributeProcessors.forEach { processor in
                processor.appendAttributes(&attributes)
            }
            span.setInternalAttribute(attributes)
        }
    }

    func onEnding(_ span: InternalSpan) {
        // No-op in current implementation
    }

    func onEnded(_ span: InternalSpan) {
        SignPost.trace(subcategory: "Span", label: "spanProcessorOnEnded") {
            if let validSpanData = sanitize(span.toSpanData()) {
                signalProcessor.trackSpan(validSpanData)
                logger.log(level: .debug, message: "Span ended: \(validSpanData.name), duration: \(validSpanData.duration)", error: nil, data: nil)
            }
        }
    }
    
    func trackSpan(_ spanData: SpanData) {
        SignPost.trace(subcategory: "Span", label: "spanProcessorTrackSpan") {
            if let validSpanData = sanitize(spanData) {
                var attributes = Attributes()
                attributes.deviceLowPowerMode = ProcessInfo.processInfo.isLowPowerModeEnabled
                attributeProcessors.forEach { processor in
                    processor.appendAttributes(&attributes)
                }
                signalProcessor.trackSpan(validSpanData)
                logger.log(level: .debug, message: "Span tracked: \(validSpanData.name), duration: \(validSpanData.duration)", error: nil, data: nil)
            }
        }
    }

    /// Sanitizes the span data according to configuration rules.
    /// - Parameter spanData: The span data to sanitize
    /// - Returns: a valid `SpanData` object and should be processed, nil if it should be discarded
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
            sanitizedCheckpoints = Array(sanitizedCheckpoints.prefix(configProvider.maxCheckpointsPerSpan))
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
                        userDefinedAttrs: spanData.userDefinedAttrs,
                        checkpoints: sanitizedCheckpoints,
                        hasEnded: spanData.hasEnded,
                        isSampled: spanData.isSampled)
    }
}
