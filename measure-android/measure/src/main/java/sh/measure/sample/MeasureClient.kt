package sh.measure.sample

import kotlinx.serialization.json.Json
import sh.measure.sample.exceptions.ExceptionData
import sh.measure.sample.logger.LogLevel
import sh.measure.sample.logger.Logger

/**
 * Maintains global state and provides a way for different components to communicate with each
 * other.
 */
internal class MeasureClient(private val logger: Logger) {

    fun log(level: LogLevel, message: String, throwable: Throwable? = null) {
        logger.log(level, message, throwable)
    }

    fun captureException(exceptionData: ExceptionData) {
        // Fire a event with exception data.
        // Add resource attributes - eg. device, os, app info, etc.
        // Add context attributes - user info, resumed activity, network info, rooted device,
        // Application in foreground/background, last gesture, memory usage, battery level,
        // etc.
        logger.log(LogLevel.Fatal, Json.encodeToString(ExceptionData.serializer(), exceptionData))
    }
}