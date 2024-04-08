package sh.measure.android.fakes

import sh.measure.android.applaunch.ColdLaunchData
import sh.measure.android.applaunch.HotLaunchData
import sh.measure.android.applaunch.WarmLaunchData
import sh.measure.android.events.Event
import sh.measure.android.events.EventProcessor
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.gestures.ClickData
import sh.measure.android.gestures.LongClickData
import sh.measure.android.gestures.ScrollData
import sh.measure.android.lifecycle.ActivityLifecycleData
import sh.measure.android.lifecycle.ApplicationLifecycleData
import sh.measure.android.lifecycle.FragmentLifecycleData
import sh.measure.android.navigation.NavigationData
import sh.measure.android.networkchange.NetworkChangeData
import sh.measure.android.okhttp.HttpData
import sh.measure.android.performance.CpuUsageData
import sh.measure.android.performance.LowMemoryData
import sh.measure.android.performance.MemoryUsageData
import sh.measure.android.performance.TrimMemoryData

@Suppress("MemberVisibilityCanBePrivate")
internal class FakeEventProcessor : EventProcessor {
    val trackedUnhandledExceptions = mutableListOf<Event<ExceptionData>>()
    val trackedAnrs = mutableListOf<Event<ExceptionData>>()
    val trackedClicks = mutableListOf<Event<ClickData>>()
    val trackedLongClicks = mutableListOf<Event<LongClickData>>()
    val trackedScrolls = mutableListOf<Event<ScrollData>>()
    val trackedActivityLifecycleData = mutableListOf<Event<ActivityLifecycleData>>()
    val trackedFragmentLifecycleData = mutableListOf<Event<FragmentLifecycleData>>()
    val trackedApplicationLifecycleData = mutableListOf<Event<ApplicationLifecycleData>>()
    val trackedColdLaunchData = mutableListOf<Event<ColdLaunchData>>()
    val trackedWarmLaunchData = mutableListOf<Event<WarmLaunchData>>()
    val trackedNetworkChangeData = mutableListOf<Event<NetworkChangeData>>()
    val trackedHotLaunchData = mutableListOf<Event<HotLaunchData>>()
    val trackHttpData = mutableListOf<Event<HttpData>>()
    val trackedMemoryUsageDataEvents = mutableListOf<Event<MemoryUsageData>>()
    val trackedLowMemoryDataEvents = mutableListOf<Event<LowMemoryData>>()
    val trackedTrimMemoryDataEvents = mutableListOf<Event<TrimMemoryData>>()
    val trackedCPUUsageDataEvents = mutableListOf<Event<CpuUsageData>>()
    val trackedNavigationData = mutableListOf<Event<NavigationData>>()

    override fun trackUnhandledException(event: Event<ExceptionData>) {
        trackedUnhandledExceptions.add(event)
    }

    override fun trackAnr(event: Event<ExceptionData>) {
        trackedAnrs.add(event)
    }

    override fun trackClick(event: Event<ClickData>) {
        trackedClicks.add(event)
    }

    override fun trackLongClick(event: Event<LongClickData>) {
        trackedLongClicks.add(event)
    }

    override fun trackScroll(event: Event<ScrollData>) {
        trackedScrolls.add(event)
    }

    override fun trackActivityLifecycle(event: Event<ActivityLifecycleData>) {
        trackedActivityLifecycleData.add(event)
    }

    override fun trackFragmentLifecycle(event: Event<FragmentLifecycleData>) {
        trackedFragmentLifecycleData.add(event)
    }

    override fun trackApplicationLifecycle(event: Event<ApplicationLifecycleData>) {
        trackedApplicationLifecycleData.add(event)
    }

    override fun trackColdLaunch(event: Event<ColdLaunchData>) {
        trackedColdLaunchData.add(event)
    }

    override fun trackWarmLaunch(event: Event<WarmLaunchData>) {
        trackedWarmLaunchData.add(event)
    }

    override fun trackHotLaunch(event: Event<HotLaunchData>) {
        trackedHotLaunchData.add(event)
    }

    override fun trackNetworkChange(event: Event<NetworkChangeData>) {
        trackedNetworkChangeData.add(event)
    }

    override fun trackHttp(event: Event<HttpData>) {
        trackHttpData.add(event)
    }

    override fun trackMemoryUsage(event: Event<MemoryUsageData>) {
        trackedMemoryUsageDataEvents.add(event)
    }

    override fun trackLowMemory(event: Event<LowMemoryData>) {
        trackedLowMemoryDataEvents.add(event)
    }

    override fun trackTrimMemory(event: Event<TrimMemoryData>) {
        trackedTrimMemoryDataEvents.add(event)
    }

    override fun trackCpuUsage(event: Event<CpuUsageData>) {
        trackedCPUUsageDataEvents.add(event)
    }

    override fun trackNavigation(event: Event<NavigationData>) {
        trackedNavigationData.add(event)
    }
}
