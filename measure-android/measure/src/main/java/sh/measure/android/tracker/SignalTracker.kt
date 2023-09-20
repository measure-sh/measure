package sh.measure.android.tracker

import android.os.StrictMode
import sh.measure.android.exceptions.MeasureException
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.session.SessionController

internal interface SignalTracker {
    fun trackUnhandledException(measureException: MeasureException)
}

internal class MeasureSignalTracker(
    private val logger: Logger,
    private val sessionController: SessionController
) : SignalTracker {

    override fun trackUnhandledException(measureException: MeasureException) {
        assert(!measureException.handled)
        logger.log(LogLevel.Debug, "Tracking unhandled exception")

        // The write operation is performed synchronously to ensure it is completed before the
        // process terminates in the event of a crash.
        val oldPolicy = StrictMode.getThreadPolicy()
        StrictMode.setThreadPolicy(StrictMode.allowThreadDiskWrites())
        try {
            sessionController.syncActiveSessionOnCrash(measureException)
        } finally {
            StrictMode.setThreadPolicy(oldPolicy)
        }
    }
}