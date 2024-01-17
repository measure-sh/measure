package sh.measure.android.events

import sh.measure.android.applaunch.ColdLaunchEvent
import sh.measure.android.applaunch.HotLaunchEvent
import sh.measure.android.applaunch.WarmLaunchEvent
import sh.measure.android.attachment.AttachmentInfo
import sh.measure.android.exceptions.MeasureException
import sh.measure.android.gestures.ClickEvent
import sh.measure.android.gestures.LongClickEvent
import sh.measure.android.gestures.ScrollEvent
import sh.measure.android.lifecycle.ActivityLifecycleEvent
import sh.measure.android.lifecycle.ApplicationLifecycleEvent
import sh.measure.android.lifecycle.FragmentLifecycleEvent
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.networkchange.NetworkChangeEvent
import sh.measure.android.okhttp.HttpEvent
import sh.measure.android.performance.CpuUsage
import sh.measure.android.performance.LowMemory
import sh.measure.android.performance.MemoryUsage
import sh.measure.android.performance.TrimMemory
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
    fun trackWarmLaunchEvent(event: WarmLaunchEvent)
    fun trackHotLaunchEvent(event: HotLaunchEvent)
    fun trackNetworkChange(event: NetworkChangeEvent)
    fun trackHttpEvent(event: HttpEvent)
    fun storeAttachment(attachmentInfo: AttachmentInfo)
    fun trackMemoryUsage(memoryUsage: MemoryUsage)
    fun trackLowMemory(lowMemory: LowMemory)
    fun trackTrimMemory(trimMemory: TrimMemory)
    fun trackCpuUsage(cpuUsage: CpuUsage)
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
            LogLevel.Debug,
            "Tracking activity lifecycle event ${event.type}",
        )
        sessionController.storeEvent(event.toEvent())
    }

    override fun trackFragmentLifecycleEvent(event: FragmentLifecycleEvent) {
        logger.log(
            LogLevel.Debug,
            "Tracking fragment lifecycle event ${event.type}",
        )
        sessionController.storeEvent(event.toEvent())
    }

    override fun trackApplicationLifecycleEvent(event: ApplicationLifecycleEvent) {
        logger.log(
            LogLevel.Debug,
            "Tracking application lifecycle event ${event.type}",
        )
        sessionController.storeEvent(event.toEvent())
    }

    override fun trackColdLaunch(event: ColdLaunchEvent) {
        logger.log(LogLevel.Debug, "Tracking cold launch")
        sessionController.storeEvent(event.toEvent())
    }

    override fun trackWarmLaunchEvent(event: WarmLaunchEvent) {
        logger.log(LogLevel.Debug, "Tracking warm launch")
        sessionController.storeEvent(event.toEvent())
    }

    override fun trackHotLaunchEvent(event: HotLaunchEvent) {
        logger.log(LogLevel.Debug, "Tracking hot launch")
        sessionController.storeEvent(event.toEvent())
    }

    override fun trackNetworkChange(event: NetworkChangeEvent) {
        logger.log(LogLevel.Error, "Tracking network change ${event.network_type}")
    }

    override fun trackHttpEvent(event: HttpEvent) {
        logger.log(LogLevel.Debug, "Tracking HTTP event")
        sessionController.storeEvent(event.toEvent())
    }

    override fun trackMemoryUsage(memoryUsage: MemoryUsage) {
        logger.log(LogLevel.Debug, "Tracking memory usage")
        sessionController.storeEvent(memoryUsage.toEvent())
    }

    override fun trackLowMemory(lowMemory: LowMemory) {
        logger.log(LogLevel.Debug, "Tracking low memory")
        sessionController.storeEvent(
            lowMemory.toEvent(),
        )
    }

    override fun trackTrimMemory(trimMemory: TrimMemory) {
        logger.log(LogLevel.Debug, "Tracking trim memory")
        sessionController.storeEvent(trimMemory.toEvent())
    }

    override fun trackCpuUsage(cpuUsage: CpuUsage) {
        logger.log(LogLevel.Debug, "Tracking CPU usage")
        sessionController.storeEvent(cpuUsage.toEvent())
    }

    override fun storeAttachment(attachmentInfo: AttachmentInfo) {
        logger.log(LogLevel.Debug, "Storing attachment ${attachmentInfo.name}")
        sessionController.storeAttachment(attachmentInfo)
    }
}
