package sh.measure.android.tracing

/**
 * Scope is the mechanism used to maintain current span context.
 *
 * A scope is created when a span is made as current using [Span.makeCurrent], once the scope
 * is closed, the current span will be replaced with the earlier one if any.
 *
 * Failure to close a scope correctly can break tracing and cause memory leaks.
 *
 * It is recommended to use scopes in a try-with-resources block in java or with [use] function
 * in Kotlin to ensure the scopes are closed correctly. Example:
 *
 * ```kotlin
 * span.makeCurrent().use {
 *   // do work here
 * }
 * ``
 *
 * or,
 *
 * ```kotlin
 * Measure.withScope(span) {
 *   // do work here
 * }
 * ```
 */
internal interface Scope : AutoCloseable
