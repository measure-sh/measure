package sh.measure.android.fakes

import sh.measure.android.applaunch.ColdLaunchEvent
import sh.measure.android.applaunch.HotLaunchEvent
import sh.measure.android.applaunch.WarmLaunchEvent
import sh.measure.android.attachment.AttachmentInfo
import sh.measure.android.events.EventProcessor
import sh.measure.android.exceptions.MeasureException
import sh.measure.android.gestures.ClickEvent
import sh.measure.android.gestures.LongClickEvent
import sh.measure.android.gestures.ScrollEvent
import sh.measure.android.lifecycle.ActivityLifecycleEvent
import sh.measure.android.lifecycle.ApplicationLifecycleEvent
import sh.measure.android.lifecycle.FragmentLifecycleEvent
import sh.measure.android.navigation.NavigationEvent
import sh.measure.android.networkchange.NetworkChangeEvent
import sh.measure.android.okhttp.HttpEvent
import sh.measure.android.performance.CpuUsage
import sh.measure.android.performance.LowMemory
import sh.measure.android.performance.MemoryUsage
import sh.measure.android.performance.TrimMemory

@Suppress("MemberVisibilityCanBePrivate")
internal class FakeEventProcessor : EventProcessor {
    val trackedUnhandledExceptions = mutableListOf<MeasureException>()
    val trackedAnrs = mutableListOf<MeasureException>()
    val trackedClicks = mutableListOf<ClickEvent>()
    val trackedLongClicks = mutableListOf<LongClickEvent>()
    val trackedScrolls = mutableListOf<ScrollEvent>()
    val trackedActivityLifecycleEvents = mutableListOf<ActivityLifecycleEvent>()
    val trackedFragmentLifecycleEvents = mutableListOf<FragmentLifecycleEvent>()
    val trackedApplicationLifecycleEvents = mutableListOf<ApplicationLifecycleEvent>()
    val trackedColdLaunchEvents = mutableListOf<ColdLaunchEvent>()
    val trackedWarmLaunchEvents = mutableListOf<WarmLaunchEvent>()
    val trackedNetworkChangeEvents = mutableListOf<NetworkChangeEvent>()
    val trackedHotLaunchEvents = mutableListOf<HotLaunchEvent>()
    val trackedAttachments = mutableListOf<AttachmentInfo>()
    val trackHttpEvents = mutableListOf<HttpEvent>()
    val trackedMemoryUsageEvents = mutableListOf<MemoryUsage>()
    val trackedLowMemoryEvents = mutableListOf<LowMemory>()
    val trackedTrimMemoryEvents = mutableListOf<TrimMemory>()
    val trackedCPUUsageEvents = mutableListOf<CpuUsage>()
    val trackedNavigationEvents = mutableListOf<NavigationEvent>()

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
        trackedColdLaunchEvents.add(event)
    }

    override fun trackWarmLaunchEvent(event: WarmLaunchEvent) {
        trackedWarmLaunchEvents.add(event)
    }

    override fun trackHotLaunchEvent(event: HotLaunchEvent) {
        trackedHotLaunchEvents.add(event)
    }

    override fun trackNetworkChange(event: NetworkChangeEvent) {
        trackedNetworkChangeEvents.add(event)
    }

    override fun trackHttpEvent(event: HttpEvent) {
        trackHttpEvents.add(event)
    }

    override fun trackMemoryUsage(memoryUsage: MemoryUsage) {
        trackedMemoryUsageEvents.add(memoryUsage)
    }

    override fun trackLowMemory(lowMemory: LowMemory) {
        trackedLowMemoryEvents.add(lowMemory)
    }

    override fun trackTrimMemory(trimMemory: TrimMemory) {
        trackedTrimMemoryEvents.add(trimMemory)
    }

    override fun trackCpuUsage(cpuUsage: CpuUsage) {
        trackedCPUUsageEvents.add(cpuUsage)
    }

    override fun trackNavigationEvent(navigationEvent: NavigationEvent) {
        trackedNavigationEvents.add(navigationEvent)
    }

    override fun storeAttachment(attachmentInfo: AttachmentInfo) {
        trackedAttachments.add(attachmentInfo)
    }
}
