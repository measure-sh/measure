import Foundation

/// Protocol for configuring and creating a new `Span`.
public protocol SpanBuilder {
    /// Sets the parent span for the span being built.
    /// - Parameter span: The span to set as parent
    /// - Returns: The builder instance for method chaining
    func setParent(_ span: Span) -> SpanBuilder

    /// Creates and starts a new span with the current time.
    /// - Returns: A new `Span` instance
    ///
    /// Note: After calling this method, any further builder configurations will be ignored.
    /// The start time is automatically set using `Measure.getCurrentTime()`.
    func startSpan() -> Span

    /// Creates and starts a new span with the specified start time.
    /// - Parameter timeMs: The start time in milliseconds since epoch, obtained via `Measure.getCurrentTime()`
    /// - Returns: A new `Span` instance
    ///
    /// Note: After calling this method, any further builder configurations will be ignored.
    /// Use this method when you need to trace an operation that has already started.
    func startSpan(_ timestamp: Int64) -> Span
}
