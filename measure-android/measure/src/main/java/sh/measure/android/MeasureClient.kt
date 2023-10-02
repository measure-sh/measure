package sh.measure.android

import sh.measure.android.exceptions.UnhandledExceptionCollector
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.session.SessionController
import sh.measure.android.utils.TimeProvider
import sh.measure.android.events.EventTracker

/**
 * Maintains global state and provides a way for different components to communicate with each
 * other.
 */
internal class MeasureClient(
    private val logger: Logger,
    private val timeProvider: TimeProvider,
    private val eventTracker: EventTracker,
    private val sessionController: SessionController
) {
    fun init() {
        logger.log(LogLevel.Debug, "Initializing session")

        // TODO(abhay): this is not ideal, we're going to be waiting for the sdk to do multiple
        //  IO operations before we can do anything else, we might even miss early crashes.
        sessionController.createSession {
            logger.log(LogLevel.Debug, "Session created: $it")
            onSessionCreated()
        }
    }

    private fun onSessionCreated() {
        UnhandledExceptionCollector(logger, eventTracker, timeProvider).register()
        sessionController.syncSessions()
        sessionController.deleteSyncedSessions()
    }
}