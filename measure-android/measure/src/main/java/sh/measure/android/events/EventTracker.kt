package sh.measure.android.events

import sh.measure.android.exceptions.MeasureException
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.session.SessionController

internal interface EventTracker {
    fun trackUnhandledException(measureException: MeasureException)
    fun trackAnr(measureException: MeasureException)
}

internal class MeasureEventTracker(
    private val logger: Logger,
    private val sessionController: SessionController,
) : EventTracker {
    override fun trackUnhandledException(measureException: MeasureException) {
        assert(!measureException.handled)
        logger.log(LogLevel.Debug, "Tracking unhandled exception")
        sessionController.storeEventSync(measureException.toEvent())
    }

    override fun trackAnr(measureException: MeasureException) {
        assert(measureException.isAnr)
        logger.log(LogLevel.Debug, "Tracking ANR")
        sessionController.storeEventSync(measureException.toEvent())
    }
}