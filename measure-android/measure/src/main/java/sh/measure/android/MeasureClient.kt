package sh.measure.android

import android.app.Application
import android.content.Context
import sh.measure.android.anr.AnrCollector
import sh.measure.android.events.EventTracker
import sh.measure.android.exceptions.UnhandledExceptionCollector
import sh.measure.android.gestures.GestureCollector
import sh.measure.android.lifecycle.LifecycleCollector
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.session.SessionController
import sh.measure.android.utils.TimeProvider

/**
 * Maintains global state and provides a way for different components to communicate with each
 * other.
 */
internal class MeasureClient(
    private val logger: Logger,
    private val context: Context,
    private val timeProvider: TimeProvider,
    private val eventTracker: EventTracker,
    private val sessionController: SessionController
) {
    fun init() {
        logger.log(LogLevel.Debug, "Initializing session")
        sessionController.createSession()
        UnhandledExceptionCollector(logger, eventTracker, timeProvider).register()
        AnrCollector(logger, context, timeProvider, eventTracker).register()
        LifecycleCollector(context as Application, eventTracker, timeProvider).register()
        GestureCollector(logger, eventTracker, timeProvider).register()

        // TODO: do this after app launch is completed to not mess up the app startup time.
        sessionController.syncAllSessions()
    }
}