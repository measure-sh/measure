package sh.measure.android.events

import sh.measure.android.applaunch.ColdLaunchData
import sh.measure.android.applaunch.HotLaunchData
import sh.measure.android.applaunch.WarmLaunchData
import sh.measure.android.attachment.AttachmentInfo
import sh.measure.android.attributes.AttributeProcessor
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.gestures.ClickData
import sh.measure.android.gestures.LongClickData
import sh.measure.android.gestures.ScrollData
import sh.measure.android.lifecycle.ActivityLifecycleData
import sh.measure.android.lifecycle.ApplicationLifecycleData
import sh.measure.android.lifecycle.FragmentLifecycleData
import sh.measure.android.logger.Logger
import sh.measure.android.navigation.NavigationData
import sh.measure.android.networkchange.NetworkChangeData
import sh.measure.android.okhttp.HttpData
import sh.measure.android.performance.CpuUsageData
import sh.measure.android.performance.LowMemoryData
import sh.measure.android.performance.MemoryUsageData
import sh.measure.android.performance.TrimMemoryData

internal interface EventProcessor {
    fun trackUnhandledException(event: Event<ExceptionData>)
    fun trackAnr(event: Event<ExceptionData>)
    fun trackClick(event: Event<ClickData>)
    fun trackLongClick(event: Event<LongClickData>)
    fun trackScroll(event: Event<ScrollData>)
    fun trackActivityLifecycle(event: Event<ActivityLifecycleData>)
    fun trackFragmentLifecycle(event: Event<FragmentLifecycleData>)
    fun trackApplicationLifecycle(event: Event<ApplicationLifecycleData>)
    fun trackColdLaunch(event: Event<ColdLaunchData>)
    fun trackWarmLaunch(event: Event<WarmLaunchData>)
    fun trackHotLaunch(event: Event<HotLaunchData>)
    fun trackNetworkChange(event: Event<NetworkChangeData>)
    fun trackHttp(event: Event<HttpData>)
    fun trackMemoryUsage(event: Event<MemoryUsageData>)
    fun trackLowMemory(event: Event<LowMemoryData>)
    fun trackTrimMemory(event: Event<TrimMemoryData>)
    fun trackCpuUsage(event: Event<CpuUsageData>)
    fun trackNavigation(event: Event<NavigationData>)

    fun storeAttachment(event: AttachmentInfo)
}

internal class MeasureEventProcessor(
    private val logger: Logger,
    private val attributeProcessors: List<AttributeProcessor>,
) : EventProcessor {
    override fun trackUnhandledException(event: Event<ExceptionData>) {
        processEvent(event)
    }

    override fun trackAnr(event: Event<ExceptionData>) {
        processEvent(event)
    }

    override fun trackClick(event: Event<ClickData>) {
        processEvent(event)
    }

    override fun trackLongClick(event: Event<LongClickData>) {
        processEvent(event)
    }

    override fun trackScroll(event: Event<ScrollData>) {
        processEvent(event)
    }

    override fun trackActivityLifecycle(event: Event<ActivityLifecycleData>) {
        processEvent(event)
    }

    override fun trackFragmentLifecycle(event: Event<FragmentLifecycleData>) {
        processEvent(event)
    }

    override fun trackApplicationLifecycle(event: Event<ApplicationLifecycleData>) {
        processEvent(event)
    }

    override fun trackColdLaunch(event: Event<ColdLaunchData>) {
        processEvent(event)
    }

    override fun trackWarmLaunch(event: Event<WarmLaunchData>) {
        processEvent(event)
    }

    override fun trackHotLaunch(event: Event<HotLaunchData>) {
        processEvent(event)
    }

    override fun trackNetworkChange(event: Event<NetworkChangeData>) {
        processEvent(event)
    }

    override fun trackHttp(event: Event<HttpData>) {
        processEvent(event)
    }

    override fun trackMemoryUsage(event: Event<MemoryUsageData>) {
        processEvent(event)
    }

    override fun trackLowMemory(event: Event<LowMemoryData>) {
        processEvent(event)
    }

    override fun trackTrimMemory(event: Event<TrimMemoryData>) {
        processEvent(event)
    }

    override fun trackCpuUsage(event: Event<CpuUsageData>) {
        processEvent(event)
    }

    override fun trackNavigation(event: Event<NavigationData>) {
        processEvent(event)
    }

    override fun storeAttachment(event: AttachmentInfo) {
        processAttachment(event)
    }

    private fun processEvent(event: Event<*>) {
        // Mutate the event.attributes map
        attributeProcessors.forEach { it.appendAttributes(event) }
    }

    private fun processAttachment(event: AttachmentInfo) {
        // TODO: Implement attachment processing
    }
}
