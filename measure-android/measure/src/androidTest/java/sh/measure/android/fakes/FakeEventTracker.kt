package sh.measure.android.fakes

import sh.measure.android.events.EventTracker
import sh.measure.android.exceptions.MeasureException
import sh.measure.android.gestures.Click
import sh.measure.android.gestures.LongClick
import sh.measure.android.gestures.Scroll

internal class FakeEventTracker: EventTracker {
    val trackedUnhandledExceptions = mutableListOf<MeasureException>()
    val trackedAnrs = mutableListOf<MeasureException>()
    val trackedClicks = mutableListOf<Click>()
    val trackedLongClicks = mutableListOf<LongClick>()
    val trackedScrolls = mutableListOf<Scroll>()

    override fun trackUnhandledException(measureException: MeasureException) {
        trackedUnhandledExceptions.add(measureException)
    }

    override fun trackAnr(measureException: MeasureException) {
        trackedAnrs.add(measureException)
    }

    override fun trackClick(click: Click) {
        trackedClicks.add(click)
    }

    override fun trackLongClick(longClick: LongClick) {
        trackedLongClicks.add(longClick)
    }

    override fun trackScroll(scroll: Scroll) {
        trackedScrolls.add(scroll)
    }
}