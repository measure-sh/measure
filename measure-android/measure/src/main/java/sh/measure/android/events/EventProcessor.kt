package sh.measure.android.events

import sh.measure.android.applaunch.ColdLaunchData
import sh.measure.android.applaunch.HotLaunchData
import sh.measure.android.applaunch.WarmLaunchData
import sh.measure.android.attachment.AttachmentInfo
import sh.measure.android.attributes.AttributeProcessor
import sh.measure.android.attributes.appendAttributes
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.gestures.ClickData
import sh.measure.android.gestures.LongClickData
import sh.measure.android.gestures.ScrollData
import sh.measure.android.lifecycle.ActivityLifecycleData
import sh.measure.android.lifecycle.ApplicationLifecycleData
import sh.measure.android.lifecycle.FragmentLifecycleData
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.navigation.NavigationData
import sh.measure.android.networkchange.NetworkChangeData
import sh.measure.android.okhttp.HttpData
import sh.measure.android.performance.CpuUsageData
import sh.measure.android.performance.LowMemoryData
import sh.measure.android.performance.MemoryUsageData
import sh.measure.android.performance.TrimMemoryData
import sh.measure.android.storage.EventStore

/**
 * An event processor is responsible for taking an input event from the Measure SDK and
 * processing it by applying [EventTransformer]s and [AttributeProcessor]s. The processed
 * event is then passed on to the [EventStore] for storage.
 *
 * All methods in this class are expected to be called from different threads. All processing is
 * done asynchronously to avoid blocking the calling thread, except for exceptions and ANRs to
 * ensure that the event is processed immediately before the system shuts down.
 */
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

internal class EventProcessorImpl(
    private val logger: Logger,
    private val executorService: MeasureExecutorService,
    private val eventStore: EventStore,
    private val attributeProcessors: List<AttributeProcessor>,
    private val transformers: List<EventTransformer>
) : EventProcessor {

    /**
     * Process an event by appending attributes, transforming it, and storing it in the event store.
     *
     * @param event The event to process.
     * @param storeEvent The function to store the event in the event store.
     * @param async Whether to process the event asynchronously or not.
     */
    private fun <T> processEvent(
        event: Event<T>, storeEvent: (Event<T>) -> Unit, async: Boolean = true
    ) {
        val block: () -> Unit = {
            event.appendAttributes(attributeProcessors)
            event.transform(transformers)?.let {
                storeEvent(it)
            }
            logger.log(LogLevel.Debug, "Event processed: $event")
        }

        if (async) {
            executorService.submit(block)
        } else {
            block()
        }
    }

    override fun trackUnhandledException(event: Event<ExceptionData>) {
        processEvent(event, eventStore::storeUnhandledException, false)
    }

    override fun trackAnr(event: Event<ExceptionData>) {
        processEvent(event, eventStore::storeAnr, false)
    }

    override fun trackClick(event: Event<ClickData>) {
        processEvent(event, eventStore::storeClick)
    }

    override fun trackLongClick(event: Event<LongClickData>) {
        processEvent(event, eventStore::storeLongClick)
    }

    override fun trackScroll(event: Event<ScrollData>) {
        processEvent(event, eventStore::storeScroll)
    }

    override fun trackActivityLifecycle(event: Event<ActivityLifecycleData>) {
        processEvent(event, eventStore::storeActivityLifecycle)
    }

    override fun trackFragmentLifecycle(event: Event<FragmentLifecycleData>) {
        processEvent(event, eventStore::storeFragmentLifecycle)
    }

    override fun trackApplicationLifecycle(event: Event<ApplicationLifecycleData>) {
        processEvent(event, eventStore::storeApplicationLifecycle)
    }

    override fun trackColdLaunch(event: Event<ColdLaunchData>) {
        processEvent(event, eventStore::storeColdLaunch)
    }

    override fun trackWarmLaunch(event: Event<WarmLaunchData>) {
        processEvent(event, eventStore::storeWarmLaunch)
    }

    override fun trackHotLaunch(event: Event<HotLaunchData>) {
        processEvent(event, eventStore::storeHotLaunch)
    }

    override fun trackNetworkChange(event: Event<NetworkChangeData>) {
        processEvent(event, eventStore::storeNetworkChange)
    }

    override fun trackHttp(event: Event<HttpData>) {
        processEvent(event, eventStore::storeHttp)
    }

    override fun trackMemoryUsage(event: Event<MemoryUsageData>) {
        processEvent(event, eventStore::storeMemoryUsage)
    }

    override fun trackLowMemory(event: Event<LowMemoryData>) {
        processEvent(event, eventStore::storeLowMemory)
    }

    override fun trackTrimMemory(event: Event<TrimMemoryData>) {
        processEvent(event, eventStore::storeTrimMemory)
    }

    override fun trackCpuUsage(event: Event<CpuUsageData>) {
        processEvent(event, eventStore::storeCpuUsage)
    }

    override fun trackNavigation(event: Event<NavigationData>) {
        processEvent(event, eventStore::storeNavigation)
    }

    override fun storeAttachment(event: AttachmentInfo) {
        // TODO: Implement attachment processing
    }
}
