package sh.measure.android.logs

import sh.measure.android.Measure

/**
 * Severity of a log tracked using [Measure.log].
 */
enum class LogSeverity(internal val value: String, internal val severityNumber: Int) {
    Debug("debug", 8),
    Info("info", 12),
    Warning("warning", 16),
    Error("error", 20),
    Fatal("fatal", 24),
}
