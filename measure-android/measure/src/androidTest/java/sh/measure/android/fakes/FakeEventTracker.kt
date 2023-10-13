package sh.measure.android.fakes

import sh.measure.android.events.EventTracker
import sh.measure.android.exceptions.MeasureException
import sh.measure.android.gestures.ClickEvent
import sh.measure.android.gestures.LongClickEvent
import sh.measure.android.gestures.ScrollEvent

internal class FakeEventTracker: EventTracker {
    val trackedUnhandledExceptions = mutableListOf<MeasureException>()
    val trackedAnrs = mutableListOf<MeasureException>()
    val trackedClicks = mutableListOf<ClickEvent>()
    val trackedLongClicks = mutableListOf<LongClickEvent>()
    val trackedScrolls = mutableListOf<ScrollEvent>()

    override fun trackUnhandledException(measureException: MeasureException) {
        trackedUnhandledExceptions.add(measureException)
    }

    override fun trackAnr(measureException: MeasureException) {
        trackedAnrs.add(measureException)
    }

    override fun trackClick(click: ClickEvent) {
        trackedClicks.add(click)
    }

    override fun trackLongClick(longClick: LongClickEvent) {
        trackedLongClicks.add(longClick)
    }

    override fun trackScroll(scroll: ScrollEvent) {
        trackedScrolls.add(scroll)
    }
}