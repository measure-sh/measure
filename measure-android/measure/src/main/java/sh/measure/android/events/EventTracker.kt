package sh.measure.android.events

import sh.measure.android.cold_launch.ColdLaunchEvent
import sh.measure.android.exceptions.MeasureException
import sh.measure.android.gestures.ClickEvent
import sh.measure.android.gestures.LongClickEvent
import sh.measure.android.gestures.ScrollEvent
import sh.measure.android.lifecycle.ActivityLifecycleEvent
import sh.measure.android.lifecycle.ApplicationLifecycleEvent
import sh.measure.android.lifecycle.FragmentLifecycleEvent
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.session.SessionController

internal interface EventTracker {
    fun trackUnhandledException(measureException: MeasureException)
    fun trackAnr(measureException: MeasureException)
    fun trackClick(click: ClickEvent)
    fun trackLongClick(longClick: LongClickEvent)
    fun trackScroll(scroll: ScrollEvent)
    fun trackActivityLifecycleEvent(event: ActivityLifecycleEvent)
    fun trackFragmentLifecycleEvent(event: FragmentLifecycleEvent)
    fun trackApplicationLifecycleEvent(event: ApplicationLifecycleEvent)
    fun trackColdLaunch(event: ColdLaunchEvent)
}

// TODO: refactor to make serialization happen on background thread.
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

    override fun trackClick(click: ClickEvent) {
        logger.log(LogLevel.Debug, "Tracking click")
        sessionController.storeEvent(click.toEvent())
    }

    override fun trackLongClick(longClick: LongClickEvent) {
        logger.log(LogLevel.Debug, "Tracking long click")
        sessionController.storeEvent(longClick.toEvent())
    }

    override fun trackScroll(scroll: ScrollEvent) {
        logger.log(LogLevel.Debug, "Tracking swipe")
        sessionController.storeEvent(scroll.toEvent())
    }

    override fun trackActivityLifecycleEvent(event: ActivityLifecycleEvent) {
        logger.log(
            LogLevel.Debug, "Tracking activity lifecycle event ${event.type}"
        )
        sessionController.storeEvent(event.toEvent())
    }

    override fun trackFragmentLifecycleEvent(event: FragmentLifecycleEvent) {
        logger.log(
            LogLevel.Debug, "Tracking fragment lifecycle event ${event.type}"
        )
        sessionController.storeEvent(event.toEvent())
    }

    override fun trackApplicationLifecycleEvent(event: ApplicationLifecycleEvent) {
        logger.log(
            LogLevel.Debug, "Tracking application lifecycle event ${event.type}"
        )
        sessionController.storeEvent(event.toEvent())
    }

    override fun trackColdLaunch(event: ColdLaunchEvent) {
        logger.log(LogLevel.Debug, "Tracking cold launch (${event.ttid}ms)")
        sessionController.storeEvent(event.toEvent())
    }
}
