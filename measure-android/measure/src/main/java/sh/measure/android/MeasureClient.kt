package sh.measure.android

import android.content.Context
import sh.measure.android.anr.AnrCollector
import sh.measure.android.events.EventTracker
import sh.measure.android.exceptions.UnhandledExceptionCollector
import sh.measure.android.gestures.GestureCollector
import sh.measure.android.gestures.WindowInterceptor
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
    private lateinit var windowInterceptor: WindowInterceptor
    fun init() {
        logger.log(LogLevel.Debug, "Initializing session")
        // The interceptor is initialized here because it needs to listen to early window attach
        // events and will not get registered correctly if done after session creation.
        windowInterceptor = WindowInterceptor().apply { init() }

        // TODO(abhay): this is not ideal, we're going to be waiting for the sdk to do multiple
        //  IO operations before we can do anything else, we might even miss early crashes.
        sessionController.createSession(
            onSuccess = {
                logger.log(LogLevel.Debug, "Session created: $it")
                onSessionCreated()
            },
            onError = {
                logger.log(
                    LogLevel.Error, "Error creating session, unable to initialize Measure SDK"
                )
            },
        )
    }

    private fun onSessionCreated() {
        UnhandledExceptionCollector(logger, eventTracker, timeProvider).register()
        AnrCollector(logger, context, timeProvider, eventTracker).register()
        GestureCollector(logger, eventTracker, windowInterceptor).register()
        sessionController.syncSessions()
        sessionController.deleteSyncedSessions()
    }
}