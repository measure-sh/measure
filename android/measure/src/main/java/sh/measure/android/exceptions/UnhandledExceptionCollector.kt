package sh.measure.android.exceptions

import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.ProcessInfoProvider
import sh.measure.android.utils.TimeProvider
import java.lang.Thread.UncaughtExceptionHandler

/**
 * An [UncaughtExceptionHandler] that tracks unhandled exceptions.
 *
 * Note that the original [UncaughtExceptionHandler], if set, is always called.
 */
internal class UnhandledExceptionCollector(
    private val logger: Logger,
    private val signalProcessor: SignalProcessor,
    private val timeProvider: TimeProvider,
    private val processInfo: ProcessInfoProvider,
) : UncaughtExceptionHandler {

    private val originalHandler: UncaughtExceptionHandler? =
        Thread.getDefaultUncaughtExceptionHandler()

    /**
     * Registers [UnhandledExceptionCollector] as the [UncaughtExceptionHandler].
     */
    fun register() {
        logger.log(LogLevel.Debug, "Registering exception handler")
        Thread.setDefaultUncaughtExceptionHandler(this)
    }

    fun unregister() {
        logger.log(LogLevel.Debug, "Unregistering exception handler")
        Thread.setDefaultUncaughtExceptionHandler(originalHandler)
    }

    override fun uncaughtException(thread: Thread, throwable: Throwable) {
        logger.log(LogLevel.Debug, "Unhandled exception received")
        try {
            signalProcessor.trackCrash(
                timestamp = timeProvider.now(),
                type = EventType.EXCEPTION,
                data = ExceptionFactory.createMeasureException(
                    throwable,
                    handled = false,
                    thread = thread,
                    foreground = processInfo.isForegroundProcess(),
                ),
            )
        } catch (e: Throwable) {
            // Prevent an infinite loop of exceptions if the above code fails.
            logger.log(LogLevel.Error, "Failed to track exception", e)
        } finally {
            // Call the original handler so that we do not swallow any exceptions.
            originalHandler?.uncaughtException(thread, throwable)
        }
    }
}
