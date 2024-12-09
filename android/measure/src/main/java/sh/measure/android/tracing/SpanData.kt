package sh.measure.android.tracing

import sh.measure.android.events.Event

internal data class SpanData(
    /**
     * The name of the span.
     *
     * Follow the open telemetry specification for naming spans.
     * See [Open Telemetry Span Specification](https://opentelemetry.io/docs/specs/otel/trace/api/#span).
     */
    val name: String,

    /**
     * An array of 16 bytes (128-bit) represented as 32 lowercase hex characters
     */
    val traceId: String,

    /**
     * An array of 8 bytes (64-bit) represented as 16 lowercase hex characters
     */
    val spanId: String,

    /**
     * [spanId] for a parent span which allows building a tree of spans.
     */
    val parentId: String?,

    /**
     * A v4 UUID for identifying a session.
     */
    val sessionId: String,

    /**
     * The epoch time in milliseconds when the span started.
     */
    val startTime: Long,

    /**
     * The epoch time in milliseconds when the span ended.
     */
    val endTime: Long,

    /**
     * The duration of the span.
     */
    val duration: Long,

    /**
     * One of unset, ok or error. Signifies whether the operation performed as part of the
     * span was successful or not.
     */
    val status: SpanStatus,

    /**
     * Attributes are key value pairs which add more context to the span.
     * The attribute key names follow [Open Telemetry Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/)
     */
    val attributes: Map<String, Any?> = emptyMap(),

    /**
     * All event IDs part of this span. See [Event] for more details.
     */
    val checkpoints: MutableList<Checkpoint> = mutableListOf(),

    /**
     * Whether the span has ended or not.
     */
    val hasEnded: Boolean,

    /**
     * Whether the span has been sampled or not.
     */
    val isSampled: Boolean,
)
