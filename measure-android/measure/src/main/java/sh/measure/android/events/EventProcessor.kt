package sh.measure.android.events

import sh.measure.android.applaunch.ColdLaunchEvent
import sh.measure.android.applaunch.HotLaunchEvent
import sh.measure.android.applaunch.WarmLaunchEvent
import sh.measure.android.attachment.AttachmentInfo
import sh.measure.android.attributes.AttributeCollector
import sh.measure.android.exceptions.MeasureException
import sh.measure.android.gestures.ClickEvent
import sh.measure.android.gestures.LongClickEvent
import sh.measure.android.gestures.ScrollEvent
import sh.measure.android.lifecycle.ActivityLifecycleEvent
import sh.measure.android.lifecycle.ApplicationLifecycleEvent
import sh.measure.android.lifecycle.FragmentLifecycleEvent
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.navigation.NavigationEvent
import sh.measure.android.networkchange.NetworkChangeEvent
import sh.measure.android.okhttp.HttpEvent
import sh.measure.android.performance.CpuUsage
import sh.measure.android.performance.LowMemory
import sh.measure.android.performance.MemoryUsage
import sh.measure.android.performance.TrimMemory

internal interface EventProcessor {
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
    fun trackNavigationEvent(navigationEvent: NavigationEvent)
}

internal class MeasureEventProcessor(
    private val logger: Logger,
    private val attributeCollectors: List<AttributeCollector>,
) : EventProcessor {
    override fun trackUnhandledException(measureException: MeasureException) {
        logger.log(LogLevel.Debug, "Tracking unhandled exception")
        attributeCollectors.forEach {
            it.append(measureException.attributes)
        }
    }

    override fun trackAnr(measureException: MeasureException) {
        logger.log(LogLevel.Debug, "Tracking ANR")
        attributeCollectors.forEach {
            it.append(measureException.attributes)
        }
    }

    override fun trackClick(click: ClickEvent) {
        logger.log(LogLevel.Debug, "Tracking click")
        attributeCollectors.forEach {
            it.append(click.attributes)
        }
    }

    override fun trackLongClick(longClick: LongClickEvent) {
        logger.log(LogLevel.Debug, "Tracking long click")
        attributeCollectors.forEach {
            it.append(longClick.attributes)
        }
    }

    override fun trackScroll(scroll: ScrollEvent) {
        logger.log(LogLevel.Debug, "Tracking swipe")
        attributeCollectors.forEach {
            it.append(scroll.attributes)
        }
    }

    override fun trackActivityLifecycleEvent(event: ActivityLifecycleEvent) {
        logger.log(
            LogLevel.Debug,
            "Tracking activity lifecycle event ${event.type}",
        )
        attributeCollectors.forEach {
            it.append(event.attributes)
        }
    }

    override fun trackFragmentLifecycleEvent(event: FragmentLifecycleEvent) {
        logger.log(
            LogLevel.Debug,
            "Tracking fragment lifecycle event ${event.type}",
        )
        attributeCollectors.forEach {
            it.append(event.attributes)
        }
    }

    override fun trackApplicationLifecycleEvent(event: ApplicationLifecycleEvent) {
        logger.log(
            LogLevel.Debug,
            "Tracking application lifecycle event ${event.type}",
        )
        attributeCollectors.forEach {
            it.append(event.attributes)
        }
    }

    override fun trackColdLaunch(event: ColdLaunchEvent) {
        logger.log(LogLevel.Debug, "Tracking cold launch")
        attributeCollectors.forEach {
            it.append(event.attributes)
        }
    }

    override fun trackWarmLaunchEvent(event: WarmLaunchEvent) {
        logger.log(LogLevel.Debug, "Tracking warm launch")
        attributeCollectors.forEach {
            it.append(event.attributes)
        }
    }

    override fun trackHotLaunchEvent(event: HotLaunchEvent) {
        logger.log(LogLevel.Debug, "Tracking hot launch")
        attributeCollectors.forEach {
            it.append(event.attributes)
        }
    }

    override fun trackNetworkChange(event: NetworkChangeEvent) {
        logger.log(LogLevel.Error, "Tracking network change ${event.network_type}")
        attributeCollectors.forEach {
            it.append(event.attributes)
        }
    }

    override fun trackHttpEvent(event: HttpEvent) {
        logger.log(LogLevel.Debug, "Tracking HTTP event")
        attributeCollectors.forEach {
            it.append(event.attributes)
        }
    }

    override fun trackMemoryUsage(memoryUsage: MemoryUsage) {
        logger.log(LogLevel.Debug, "Tracking memory usage")
        attributeCollectors.forEach {
            it.append(memoryUsage.attributes)
        }
    }

    override fun trackLowMemory(lowMemory: LowMemory) {
        logger.log(LogLevel.Debug, "Tracking low memory")
        attributeCollectors.forEach {
            it.append(lowMemory.attributes)
        }
    }

    override fun trackTrimMemory(trimMemory: TrimMemory) {
        logger.log(LogLevel.Debug, "Tracking trim memory")
        attributeCollectors.forEach {
            it.append(trimMemory.attributes)
        }
    }

    override fun trackCpuUsage(cpuUsage: CpuUsage) {
        logger.log(LogLevel.Debug, "Tracking CPU usage")
        attributeCollectors.forEach {
            it.append(cpuUsage.attributes)
        }
    }

    override fun trackNavigationEvent(navigationEvent: NavigationEvent) {
        logger.log(LogLevel.Debug, "Tracking navigation event")
        attributeCollectors.forEach {
            it.append(navigationEvent.attributes)
        }
    }

    override fun storeAttachment(attachmentInfo: AttachmentInfo) {
        logger.log(LogLevel.Debug, "Storing attachment ${attachmentInfo.name}")
        attributeCollectors.forEach {
            it.append(attachmentInfo.attributes)
        }
    }
}
