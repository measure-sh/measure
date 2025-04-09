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
        SignPost.trace(label: "msr-spanProcessor-onStart") {
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
        let spanData = span.toSpanData()
        if !sanitize(spanData) {
            return
        }
        signalProcessor.trackSpan(spanData)
        logger.log(level: .debug, message: "Span ended: \(spanData.name), duration: \(spanData.duration)", error: nil, data: nil)
    }

    /// Sanitizes the span data according to configuration rules.
    /// - Parameter spanData: The span data to sanitize
    /// - Returns: true if the span data is valid and should be processed, false if it should be discarded
    private func sanitize(_ spanData: SpanData) -> Bool {
        // Discard span if its duration is negative
        if spanData.duration < 0 {
            logger.log(level: .error, message: "Invalid span: \(spanData.name), duration is negative, span will be dropped", error: nil, data: nil)
            return false
        }

        // Discard span if it exceeds max span name length
        if spanData.name.count > configProvider.maxSpanNameLength {
            logger.log(level: .error, message: "Invalid span: \(spanData.name), length \(spanData.name.count) exceeded max allowed, span will be dropped", error: nil, data: nil)
            return false
        }

        // Remove invalid checkpoints
        var checkpoints = spanData.checkpoints
        let initialSize = checkpoints.count
        checkpoints.removeAll { checkpoint in
            checkpoint.name.count > configProvider.maxCheckpointNameLength
        }
        if checkpoints.count < initialSize {
            logger.log(level: .error, message: "Invalid span: \(spanData.name), dropped \(initialSize - checkpoints.count) checkpoints due to invalid name", error: nil, data: nil)
        }

        // Limit number of checkpoints per span
        if checkpoints.count > configProvider.maxCheckpointsPerSpan {
            logger.log(level: .error, message: "Invalid span: \(spanData.name), max checkpoints exceeded, some checkpoints will be dropped", error: nil, data: nil)
            checkpoints = Array(checkpoints.prefix(configProvider.maxCheckpointsPerSpan))
        }

        // Validation passed
        return true
    }
}
