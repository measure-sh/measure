package sh.measure.android.fakes

import sh.measure.android.applaunch.ColdLaunchData
import sh.measure.android.applaunch.HotLaunchData
import sh.measure.android.applaunch.WarmLaunchData
import sh.measure.android.events.Event
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
import sh.measure.android.storage.EventStore

internal class FakeEventStore : EventStore {
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
    val trackedHttpData = mutableListOf<Event<HttpData>>()
    val trackedMemoryUsageDataEvents = mutableListOf<Event<MemoryUsageData>>()
    val trackedLowMemoryDataEvents = mutableListOf<Event<LowMemoryData>>()
    val trackedTrimMemoryDataEvents = mutableListOf<Event<TrimMemoryData>>()
    val trackedCPUUsageDataEvents = mutableListOf<Event<CpuUsageData>>()
    val trackedNavigationDataEvents = mutableListOf<Event<NavigationData>>()

    override fun storeUnhandledException(event: Event<ExceptionData>) {
        trackedUnhandledExceptions.add(event)
    }

    override fun storeAnr(event: Event<ExceptionData>) {
        trackedAnrs.add(event)
    }

    override fun storeClick(event: Event<ClickData>) {
        trackedClicks.add(event)
    }

    override fun storeLongClick(event: Event<LongClickData>) {
        trackedLongClicks.add(event)
    }

    override fun storeScroll(event: Event<ScrollData>) {
        trackedScrolls.add(event)
    }

    override fun storeActivityLifecycle(event: Event<ActivityLifecycleData>) {
        trackedActivityLifecycleData.add(event)
    }

    override fun storeFragmentLifecycle(event: Event<FragmentLifecycleData>) {
        trackedFragmentLifecycleData.add(event)
    }

    override fun storeApplicationLifecycle(event: Event<ApplicationLifecycleData>) {
        trackedApplicationLifecycleData.add(event)
    }

    override fun storeColdLaunch(event: Event<ColdLaunchData>) {
        trackedColdLaunchData.add(event)
    }

    override fun storeWarmLaunch(event: Event<WarmLaunchData>) {
        trackedWarmLaunchData.add(event)
    }

    override fun storeHotLaunch(event: Event<HotLaunchData>) {
        trackedHotLaunchData.add(event)
    }

    override fun storeNetworkChange(event: Event<NetworkChangeData>) {
        trackedNetworkChangeData.add(event)
    }

    override fun storeHttp(event: Event<HttpData>) {
        trackedHttpData.add(event)
    }

    override fun storeMemoryUsage(event: Event<MemoryUsageData>) {
        trackedMemoryUsageDataEvents.add(event)
    }

    override fun storeLowMemory(event: Event<LowMemoryData>) {
        trackedLowMemoryDataEvents.add(event)
    }

    override fun storeTrimMemory(event: Event<TrimMemoryData>) {
        trackedTrimMemoryDataEvents.add(event)
    }

    override fun storeCpuUsage(event: Event<CpuUsageData>) {
        trackedCPUUsageDataEvents.add(event)
    }

    override fun storeNavigation(event: Event<NavigationData>) {
        trackedNavigationDataEvents.add(event)
    }
}
