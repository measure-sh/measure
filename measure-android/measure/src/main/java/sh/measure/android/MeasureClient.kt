package sh.measure.android

import sh.measure.android.exceptions.UnhandledExceptionCollector
import sh.measure.android.logger.Logger
import sh.measure.android.session.SessionController
import sh.measure.android.time.TimeProvider
import sh.measure.android.tracker.SignalTracker

/**
 * Maintains global state and provides a way for different components to communicate with each
 * other.
 */
internal class MeasureClient(
    private val logger: Logger,
    private val timeProvider: TimeProvider,
    private val signalTracker: SignalTracker,
    private val sessionController: SessionController
) {
    fun init() {
        sessionController.createSession()
        UnhandledExceptionCollector(logger, signalTracker, timeProvider).register()
        sessionController.syncSessions()
        sessionController.deleteSessionsWithoutCrash()
    }
}