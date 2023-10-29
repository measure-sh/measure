package sh.measure.android.fakes

import sh.measure.android.cold_launch.ColdLaunchEvent
import sh.measure.android.events.EventTracker
import sh.measure.android.exceptions.MeasureException
import sh.measure.android.gestures.ClickEvent
import sh.measure.android.gestures.LongClickEvent
import sh.measure.android.gestures.ScrollEvent
import sh.measure.android.lifecycle.ActivityLifecycleEvent
import sh.measure.android.lifecycle.ApplicationLifecycleEvent
import sh.measure.android.lifecycle.FragmentLifecycleEvent

@Suppress("MemberVisibilityCanBePrivate")
internal class FakeEventTracker: EventTracker {
    val trackedUnhandledExceptions = mutableListOf<MeasureException>()
    val trackedAnrs = mutableListOf<MeasureException>()
    val trackedClicks = mutableListOf<ClickEvent>()
    val trackedLongClicks = mutableListOf<LongClickEvent>()
    val trackedScrolls = mutableListOf<ScrollEvent>()
    val trackedActivityLifecycleEvents = mutableListOf<ActivityLifecycleEvent>()
    val trackedFragmentLifecycleEvents = mutableListOf<FragmentLifecycleEvent>()
    val trackedApplicationLifecycleEvents = mutableListOf<ApplicationLifecycleEvent>()
    val trackedStartupTTIDEvents = mutableListOf<ColdLaunchEvent>()

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

    override fun trackActivityLifecycleEvent(event: ActivityLifecycleEvent) {
        trackedActivityLifecycleEvents.add(event)
    }

    override fun trackFragmentLifecycleEvent(event: FragmentLifecycleEvent) {
        trackedFragmentLifecycleEvents.add(event)
    }

    override fun trackApplicationLifecycleEvent(event: ApplicationLifecycleEvent) {
        trackedApplicationLifecycleEvents.add(event)
    }

    override fun trackColdLaunch(event: ColdLaunchEvent) {
        trackedStartupTTIDEvents.add(event)
    }
}