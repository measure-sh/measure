package sh.measure.android.events

import sh.measure.android.exceptions.MeasureException
import sh.measure.android.gestures.ClickEvent
import sh.measure.android.gestures.LongClickEvent
import sh.measure.android.gestures.ScrollEvent
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.session.SessionController

internal interface EventTracker {
    fun trackUnhandledException(measureException: MeasureException)
    fun trackAnr(measureException: MeasureException)
    fun trackClick(click: ClickEvent)
    fun trackLongClick(longClick: LongClickEvent)
    fun trackScroll(scroll: ScrollEvent)
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
}
