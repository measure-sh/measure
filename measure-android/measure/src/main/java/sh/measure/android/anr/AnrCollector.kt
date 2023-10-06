package sh.measure.android.anr

import android.content.Context
import sh.measure.android.events.EventTracker
import sh.measure.android.exceptions.ExceptionFactory
import sh.measure.android.exceptions.MeasureException
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.TimeProvider

private const val ANR_TIMEOUT_MILLIS = 5000

internal class AnrCollector(
    private val logger: Logger,
    private val context: Context,
    private val timeProvider: TimeProvider,
    private val tracker: EventTracker
) : ANRWatchDog.ANRListener {
    fun register() {
        ANRWatchDog(
            context = context,
            timeoutInterval = ANR_TIMEOUT_MILLIS,
            timeProvider = timeProvider,
            anrListener = this
        ).start()
    }

    override fun onAppNotResponding(error: AnrError) {
        logger.log(LogLevel.Error, "ANR detected", error)
        tracker.trackAnr(toMeasureException(error))
    }

    private fun toMeasureException(anr: AnrError): MeasureException {
        return ExceptionFactory.createMeasureException(
            throwable = anr,
            handled = false,
            timestamp = anr.timestamp,
            thread = anr.thread,
            isAnr = true
        )
    }
}