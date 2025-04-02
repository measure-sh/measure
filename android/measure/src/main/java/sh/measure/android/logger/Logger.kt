package sh.measure.android.logger

/**
 * Interface for internal logging in Measure SDK.
 */
internal interface Logger {
    /**
     * The log level to enable,
     */
    val enabled: Boolean
    fun log(level: LogLevel, message: String, throwable: Throwable? = null)
}

/**
 * Log levels for internal logging.
 */
internal enum class LogLevel {
    Debug,
    Error,
}
