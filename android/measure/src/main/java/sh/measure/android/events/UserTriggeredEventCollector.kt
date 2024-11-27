package sh.measure.android.events

import sh.measure.android.exceptions.ExceptionFactory
import sh.measure.android.navigation.NavigationData
import sh.measure.android.navigation.ScreenViewData
import sh.measure.android.utils.ProcessInfoProvider
import sh.measure.android.utils.TimeProvider
import java.util.concurrent.atomic.AtomicBoolean

internal interface UserTriggeredEventCollector {
    @Deprecated("Use trackScreenView instead")
    fun trackNavigation(to: String, from: String?)
    fun trackHandledException(throwable: Throwable)
    fun trackScreenView(screenName: String)
    fun register()
    fun unregister()
}

internal class UserTriggeredEventCollectorImpl(
    private val eventProcessor: EventProcessor,
    private val timeProvider: TimeProvider,
    private val processInfoProvider: ProcessInfoProvider,
) : UserTriggeredEventCollector {
    private var enabled = AtomicBoolean(false)

    override fun register() {
        enabled.compareAndSet(false, true)
    }

    override fun unregister() {
        enabled.compareAndSet(true, false)
    }

    @Deprecated("Use trackScreenView instead")
    override fun trackNavigation(to: String, from: String?) {
        if (!enabled.get()) {
            return
        }
        eventProcessor.trackUserTriggered(
            data = NavigationData(
                to = to,
                from = from,
                source = null,
            ),
            timestamp = timeProvider.now(),
            type = EventType.NAVIGATION,
        )
    }

    override fun trackHandledException(throwable: Throwable) {
        if (!enabled.get()) {
            return
        }
        // this is a safe assumption that we're on the same thread as the exception was captured on
        val thread = Thread.currentThread()
        eventProcessor.trackUserTriggered(
            data = ExceptionFactory.createMeasureException(
                throwable = throwable,
                handled = true,
                thread = thread,
                foreground = processInfoProvider.isForegroundProcess(),
            ),
            timestamp = timeProvider.now(),
            type = EventType.EXCEPTION,
        )
    }

    override fun trackScreenView(screenName: String) {
        if (!enabled.get()) {
            return
        }
        eventProcessor.trackUserTriggered(
            data = ScreenViewData(name = screenName),
            timestamp = timeProvider.now(),
            type = EventType.SCREEN_VIEW,
        )
    }
}
