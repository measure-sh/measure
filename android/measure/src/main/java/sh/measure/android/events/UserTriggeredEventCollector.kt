package sh.measure.android.events

import sh.measure.android.exceptions.ExceptionFactory
import sh.measure.android.navigation.NavigationData
import sh.measure.android.navigation.ScreenViewData
import sh.measure.android.utils.ProcessInfoProvider
import sh.measure.android.utils.TimeProvider

internal interface UserTriggeredEventCollector {
    @Deprecated("Use trackScreenView instead")
    fun trackNavigation(to: String, from: String?)
    fun trackHandledException(throwable: Throwable)
    fun trackScreenView(screenName: String)
}

internal class UserTriggeredEventCollectorImpl(
    private val eventProcessor: EventProcessor,
    private val timeProvider: TimeProvider,
    private val processInfoProvider: ProcessInfoProvider,
) : UserTriggeredEventCollector {
    @Deprecated("Use trackScreenView instead")
    override fun trackNavigation(to: String, from: String?) {
        eventProcessor.trackUserTriggered(
            data = NavigationData(
                to = to,
                from = from,
                source = null,
            ),
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            type = EventType.NAVIGATION,
        )
    }

    override fun trackHandledException(throwable: Throwable) {
        // this is a safe assumption that we're on the same thread as the exception was captured on
        val thread = Thread.currentThread()
        eventProcessor.trackUserTriggered(
            data = ExceptionFactory.createMeasureException(
                throwable = throwable,
                handled = true,
                thread = thread,
                foreground = processInfoProvider.isForegroundProcess(),
            ),
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            type = EventType.EXCEPTION,
        )
    }

    override fun trackScreenView(screenName: String) {
        eventProcessor.trackUserTriggered(
            data = ScreenViewData(name = screenName),
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            type = EventType.SCREEN_VIEW,
        )
    }
}
