package sh.measure.kmp.logs

import sh.measure.kmp.Measure

/**
 * Severity of a log tracked using [Measure.log].
 */
enum class LogSeverity {
    Debug,
    Info,
    Warning,
    Error,
    Fatal,
}
