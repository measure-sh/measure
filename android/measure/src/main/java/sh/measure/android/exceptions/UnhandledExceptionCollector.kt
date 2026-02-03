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

    private var previousHandler: UncaughtExceptionHandler? = null

    fun register() {
        val current = Thread.getDefaultUncaughtExceptionHandler()
        if (current === this) return
        previousHandler = current
        Thread.setDefaultUncaughtExceptionHandler(this)
    }

    fun unregister() {
        val current = Thread.getDefaultUncaughtExceptionHandler()
        if (current !== this) return
        Thread.setDefaultUncaughtExceptionHandler(previousHandler)
    }

    override fun uncaughtException(thread: Thread, throwable: Throwable) {
        try {
            signalProcessor.trackCrash(
                data = ExceptionFactory.createMeasureException(
                    throwable,
                    handled = false,
                    thread = thread,
                    foreground = processInfo.isForegroundProcess(),
                ),
                timestamp = timeProvider.now(),
                type = EventType.EXCEPTION,
                takeScreenshot = true,
            )
        } catch (e: Throwable) {
            logger.log(LogLevel.Debug, "Failed to track unhandled exception", e)
        } finally {
            previousHandler?.uncaughtException(thread, throwable)
        }
    }
}
