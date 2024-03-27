package sh.measure.android.exceptions

import sh.measure.android.events.EventProcessor
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.networkchange.NetworkInfoProvider
import sh.measure.android.utils.LocaleProvider
import sh.measure.android.utils.TimeProvider
import sh.measure.android.utils.isForegroundProcess
import java.lang.Thread.UncaughtExceptionHandler

/**
 * An [UncaughtExceptionHandler] that tracks unhandled exceptions.
 *
 * Note that the original [UncaughtExceptionHandler], if set, is always called.
 */
internal class UnhandledExceptionCollector(
    private val logger: Logger,
    private val eventProcessor: EventProcessor,
    private val timeProvider: TimeProvider,
    private val networkInfoProvider: NetworkInfoProvider,
    private val localeProvider: LocaleProvider,
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

    override fun uncaughtException(thread: Thread, throwable: Throwable) {
        logger.log(LogLevel.Debug, "Unhandled exception received")
        try {
            val networkType = networkInfoProvider.getNetworkType()
            val measureException = ExceptionFactory.createMeasureException(
                throwable,
                handled = false,
                timestamp = timeProvider.currentTimeSinceEpochInMillis,
                thread = thread,
                networkType = networkType,
                networkGeneration = networkInfoProvider.getNetworkGeneration(networkType),
                networkProvider = networkInfoProvider.getNetworkProvider(networkType),
                foreground = isForegroundProcess(),
                deviceLocale = localeProvider.getLocale(),
            )
            eventProcessor.trackUnhandledException(measureException)
        } catch (e: Throwable) {
            // Prevent an infinite loop of exceptions if the above code fails.
            logger.log(LogLevel.Error, "Failed to track exception", e)
        } finally {
            // Call the original handler so that we do not swallow any exceptions.
            originalHandler?.uncaughtException(thread, throwable)
        }
    }
}
