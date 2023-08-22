package sh.measure.sample.logger

/**
 * Interface for internal logging in Measure SDK.
 */
internal interface Logger {
    fun log(level: LogLevel, message: String, throwable: Throwable? = null)
}

/**
 * Log levels for internal logging.
 */
internal enum class LogLevel {
    Debug, Info, Warning, Error, Fatal
}

