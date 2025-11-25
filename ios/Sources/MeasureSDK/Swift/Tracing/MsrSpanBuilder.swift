import Foundation

/// A builder class for creating and configuring new spans.
final class MsrSpanBuilder: SpanBuilder {
    private let name: String
    private let idProvider: IdProvider
    private let timeProvider: TimeProvider
    private let spanProcessor: SpanProcessor
    private let sessionManager: SessionManager
    private let signalSampler: SignalSampler
    private let logger: Logger
    private var parentSpan: Span?

    init(name: String,
         idProvider: IdProvider,
         timeProvider: TimeProvider,
         spanProcessor: SpanProcessor,
         sessionManager: SessionManager,
         signalSampler: SignalSampler,
         logger: Logger) {
        self.name = name
        self.idProvider = idProvider
        self.timeProvider = timeProvider
        self.spanProcessor = spanProcessor
        self.sessionManager = sessionManager
        self.signalSampler = signalSampler
        self.logger = logger
    }

    /// Sets the parent span for the span being built.
    /// - Parameter span: The span to set as parent
    /// - Returns: The builder instance for method chaining
    func setParent(_ span: Span) -> SpanBuilder {
        self.parentSpan = span
        return self
    }

    /// Creates and starts a new span with the current time.
    /// - Returns: A new Span instance
    func startSpan() -> Span {
        return MsrSpan.startSpan(name: name,
                                 logger: logger,
                                 timeProvider: timeProvider,
                                 sessionManager: sessionManager,
                                 idProvider: idProvider,
                                 signalSampler: signalSampler,
                                 parentSpan: parentSpan,
                                 spanProcessor: spanProcessor)
    }

    /// Creates and starts a new span with the specified start time.
    /// - Parameter timeMs: The start time in milliseconds since epoch
    /// - Returns: A new Span instance
    func startSpan(_ timestamp: Number) -> Span {
        return MsrSpan.startSpan(name: name,
                                 logger: logger,
                                 timeProvider: timeProvider,
                                 sessionManager: sessionManager,
                                 idProvider: idProvider,
                                 signalSampler: signalSampler,
                                 parentSpan: parentSpan,
                                 spanProcessor: spanProcessor,
                                 timestamp: timestamp)
    }
}
