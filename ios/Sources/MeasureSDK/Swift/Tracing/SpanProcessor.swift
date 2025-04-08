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
