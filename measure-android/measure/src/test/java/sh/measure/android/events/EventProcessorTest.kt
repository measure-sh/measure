package sh.measure.android.events

import androidx.concurrent.futures.ResolvableFuture
import org.junit.Assert
import org.junit.Test
import sh.measure.android.attributes.AttributeProcessor
import sh.measure.android.fakes.FakeEventFactory
import sh.measure.android.fakes.FakeEventFactory.toEvent
import sh.measure.android.fakes.FakeEventStore
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger

internal class EventProcessorTest {
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val eventStore = FakeEventStore()

    @Test
    fun `stores unhandled exception event to event store`() {
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = emptyList(),
            transformers = emptyList()
        )
        val event = FakeEventFactory.getExceptionData().toEvent(type = EventType.EXCEPTION)

        // When
        eventProcessor.trackUnhandledException(event)

        // Then
        Assert.assertEquals(event, eventStore.trackedUnhandledExceptions.first())
    }

    @Test
    fun `stores ANR event to event store`() {
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = emptyList(),
            transformers = emptyList()
        )
        val event = FakeEventFactory.getExceptionData().toEvent(type = EventType.ANR)

        // When
        eventProcessor.trackAnr(event)

        // Then
        Assert.assertEquals(event, eventStore.trackedAnrs.first())
    }

    @Test
    fun `stores click event to event store`() {
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = emptyList(),
            transformers = emptyList()
        )
        val event = FakeEventFactory.getClickData().toEvent(type = EventType.CLICK)

        // When
        eventProcessor.trackClick(event)

        // Then
        Assert.assertEquals(event, eventStore.trackedClicks.first())
    }

    @Test
    fun `stores long click event to event store`() {
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = emptyList(),
            transformers = emptyList()
        )
        val event = FakeEventFactory.getLongClickData().toEvent(type = EventType.LONG_CLICK)

        // When
        eventProcessor.trackLongClick(event)

        // Then
        Assert.assertEquals(event, eventStore.trackedLongClicks.first())
    }

    @Test
    fun `stores scroll event to event store`() {
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = emptyList(),
            transformers = emptyList()
        )
        val event = FakeEventFactory.getScrollData().toEvent(type = EventType.SCROLL)

        // When
        eventProcessor.trackScroll(event)

        // Then
        Assert.assertEquals(event, eventStore.trackedScrolls.first())
    }

    @Test
    fun `stores activity lifecycle event to event store`() {
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = emptyList(),
            transformers = emptyList()
        )
        val event =
            FakeEventFactory.getActivityLifecycleData().toEvent(type = EventType.LIFECYCLE_ACTIVITY)

        // When
        eventProcessor.trackActivityLifecycle(event)

        // Then
        Assert.assertEquals(event, eventStore.trackedActivityLifecycleData.first())
    }

    @Test
    fun `stores fragment lifecycle event to event store`() {
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = emptyList(),
            transformers = emptyList()
        )
        val event =
            FakeEventFactory.getFragmentLifecycleData().toEvent(type = EventType.LIFECYCLE_FRAGMENT)

        // When
        eventProcessor.trackFragmentLifecycle(event)

        // Then
        Assert.assertEquals(event, eventStore.trackedFragmentLifecycleData.first())
    }

    @Test
    fun `stores application lifecycle event to event store`() {
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = emptyList(),
            transformers = emptyList()
        )
        val event =
            FakeEventFactory.getApplicationLifecycleData().toEvent(type = EventType.LIFECYCLE_APP)

        // When
        eventProcessor.trackApplicationLifecycle(event)

        // Then
        Assert.assertEquals(event, eventStore.trackedApplicationLifecycleData.first())
    }

    @Test
    fun `stores cold launch event to event store`() {
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = emptyList(),
            transformers = emptyList()
        )
        val event = FakeEventFactory.getColdLaunchData().toEvent(type = EventType.COLD_LAUNCH)

        // When
        eventProcessor.trackColdLaunch(event)

        // Then
        Assert.assertEquals(event, eventStore.trackedColdLaunchData.first())
    }

    @Test
    fun `stores warm launch event to event store`() {
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = emptyList(),
            transformers = emptyList()
        )
        val event = FakeEventFactory.getWarmLaunchData().toEvent(type = EventType.WARM_LAUNCH)

        // When
        eventProcessor.trackWarmLaunch(event)

        // Then
        Assert.assertEquals(event, eventStore.trackedWarmLaunchData.first())
    }

    @Test
    fun `stores hot launch event to event store`() {
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = emptyList(),
            transformers = emptyList()
        )
        val event = FakeEventFactory.getHotLaunchData().toEvent(type = EventType.HOT_LAUNCH)

        // When
        eventProcessor.trackHotLaunch(event)

        // Then
        Assert.assertEquals(event, eventStore.trackedHotLaunchData.first())
    }

    @Test
    fun `stores network change event to event store`() {
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = emptyList(),
            transformers = emptyList()
        )
        val event = FakeEventFactory.getNetworkChangeData().toEvent(type = EventType.NETWORK_CHANGE)

        // When
        eventProcessor.trackNetworkChange(event)

        // Then
        Assert.assertEquals(event, eventStore.trackedNetworkChangeData.first())
    }

    @Test
    fun `stores http event to event store`() {
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = emptyList(),
            transformers = emptyList()
        )
        val event = FakeEventFactory.getHttpData().toEvent(type = EventType.HTTP)

        // When
        eventProcessor.trackHttp(event)

        // Then
        Assert.assertEquals(event, eventStore.trackedHttpData.first())
    }

    @Test
    fun `stores memory usage event to event store`() {
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = emptyList(),
            transformers = emptyList()
        )
        val event = FakeEventFactory.getMemoryUsageData().toEvent(type = EventType.MEMORY_USAGE)

        // When
        eventProcessor.trackMemoryUsage(event)

        // Then
        Assert.assertEquals(event, eventStore.trackedMemoryUsageDataEvents.first())
    }

    @Test
    fun `stores low memory event to event store`() {
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = emptyList(),
            transformers = emptyList()
        )
        val event = FakeEventFactory.getLowMemoryData().toEvent(type = EventType.LOW_MEMORY)

        // When
        eventProcessor.trackLowMemory(event)

        // Then
        Assert.assertEquals(event, eventStore.trackedLowMemoryDataEvents.first())
    }

    @Test
    fun `stores trim memory event to event store`() {
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = emptyList(),
            transformers = emptyList()
        )
        val event = FakeEventFactory.getTrimMemoryData().toEvent(type = EventType.TRIM_MEMORY)

        // When
        eventProcessor.trackTrimMemory(event)

        // Then
        Assert.assertEquals(event, eventStore.trackedTrimMemoryDataEvents.first())
    }

    @Test
    fun `stores cpu usage event to event store`() {
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = emptyList(),
            transformers = emptyList()
        )
        val event = FakeEventFactory.getCpuUsageData().toEvent(type = EventType.CPU_USAGE)

        // When
        eventProcessor.trackCpuUsage(event)

        // Then
        Assert.assertEquals(event, eventStore.trackedCPUUsageDataEvents.first())
    }

    @Test
    fun `store navigation event to event store`() {
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = emptyList(),
            transformers = emptyList()
        )
        val event = FakeEventFactory.getNavigationData().toEvent(type = EventType.NAVIGATION)

        // When
        eventProcessor.trackNavigation(event)

        // Then
        Assert.assertEquals(event, eventStore.trackedNavigationDataEvents.first())
    }

    @Test
    fun `applies attributes and transformations to exception event`() {
        var attributeProcessorCalledCount = 0
        val attributeProcessor = object : AttributeProcessor {
            override fun appendAttributes(event: Event<*>) {
                attributeProcessorCalledCount++
            }
        }
        var transformerCalledCount = 0
        val transformer = object : EventTransformer {
            override fun <T> transform(event: Event<T>): Event<T> {
                transformerCalledCount++
                return event
            }
        }
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = listOf(attributeProcessor),
            transformers = listOf(transformer)
        )
        val event = FakeEventFactory.getExceptionData().toEvent(type = EventType.EXCEPTION)

        // When
        eventProcessor.trackUnhandledException(event)
        Assert.assertEquals(1, attributeProcessorCalledCount)
        Assert.assertEquals(1, transformerCalledCount)
    }

    @Test
    fun `applies attributes and transformations to ANR event`() {
        var attributeProcessorCalledCount = 0
        val attributeProcessor = object : AttributeProcessor {
            override fun appendAttributes(event: Event<*>) {
                attributeProcessorCalledCount++
            }
        }
        var transformerCalledCount = 0
        val transformer = object : EventTransformer {
            override fun <T> transform(event: Event<T>): Event<T> {
                transformerCalledCount++
                return event
            }
        }
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = listOf(attributeProcessor),
            transformers = listOf(transformer)
        )
        val event = FakeEventFactory.getExceptionData().toEvent(type = EventType.ANR)

        // When
        eventProcessor.trackAnr(event)
        Assert.assertEquals(1, attributeProcessorCalledCount)
        Assert.assertEquals(1, transformerCalledCount)
    }

    @Test
    fun `applies attributes and transformations to click event`() {
        var attributeProcessorCalledCount = 0
        val attributeProcessor = object : AttributeProcessor {
            override fun appendAttributes(event: Event<*>) {
                attributeProcessorCalledCount++
            }
        }
        var transformerCalledCount = 0
        val transformer = object : EventTransformer {
            override fun <T> transform(event: Event<T>): Event<T> {
                transformerCalledCount++
                return event
            }
        }
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = listOf(attributeProcessor),
            transformers = listOf(transformer)
        )
        val event = FakeEventFactory.getClickData().toEvent(type = EventType.CLICK)

        // When
        eventProcessor.trackClick(event)
        Assert.assertEquals(1, attributeProcessorCalledCount)
        Assert.assertEquals(1, transformerCalledCount)
    }

    @Test
    fun `applies attributes and transformations to long click event`() {
        var attributeProcessorCalledCount = 0
        val attributeProcessor = object : AttributeProcessor {
            override fun appendAttributes(event: Event<*>) {
                attributeProcessorCalledCount++
            }
        }
        var transformerCalledCount = 0
        val transformer = object : EventTransformer {
            override fun <T> transform(event: Event<T>): Event<T> {
                transformerCalledCount++
                return event
            }
        }
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = listOf(attributeProcessor),
            transformers = listOf(transformer)
        )
        val event = FakeEventFactory.getLongClickData().toEvent(type = EventType.LONG_CLICK)

        // When
        eventProcessor.trackLongClick(event)
        Assert.assertEquals(1, attributeProcessorCalledCount)
        Assert.assertEquals(1, transformerCalledCount)
    }

    @Test
    fun `applies attributes and transformations to scroll event`() {
        var attributeProcessorCalledCount = 0
        val attributeProcessor = object : AttributeProcessor {
            override fun appendAttributes(event: Event<*>) {
                attributeProcessorCalledCount++
            }
        }
        var transformerCalledCount = 0
        val transformer = object : EventTransformer {
            override fun <T> transform(event: Event<T>): Event<T> {
                transformerCalledCount++
                return event
            }
        }
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = listOf(attributeProcessor),
            transformers = listOf(transformer)
        )
        val event = FakeEventFactory.getScrollData().toEvent(type = EventType.SCROLL)

        // When
        eventProcessor.trackScroll(event)
        Assert.assertEquals(1, attributeProcessorCalledCount)
        Assert.assertEquals(1, transformerCalledCount)
    }

    @Test
    fun `applies attributes and transformations to activity lifecycle event`() {
        var attributeProcessorCalledCount = 0
        val attributeProcessor = object : AttributeProcessor {
            override fun appendAttributes(event: Event<*>) {
                attributeProcessorCalledCount++
            }
        }
        var transformerCalledCount = 0
        val transformer = object : EventTransformer {
            override fun <T> transform(event: Event<T>): Event<T> {
                transformerCalledCount++
                return event
            }
        }
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = listOf(attributeProcessor),
            transformers = listOf(transformer)
        )
        val event =
            FakeEventFactory.getActivityLifecycleData().toEvent(type = EventType.LIFECYCLE_ACTIVITY)

        // When
        eventProcessor.trackActivityLifecycle(event)
        Assert.assertEquals(1, attributeProcessorCalledCount)
        Assert.assertEquals(1, transformerCalledCount)
    }

    @Test
    fun `applies attributes and transformations to fragment lifecycle event`() {
        var attributeProcessorCalledCount = 0
        val attributeProcessor = object : AttributeProcessor {
            override fun appendAttributes(event: Event<*>) {
                attributeProcessorCalledCount++
            }
        }
        var transformerCalledCount = 0
        val transformer = object : EventTransformer {
            override fun <T> transform(event: Event<T>): Event<T> {
                transformerCalledCount++
                return event
            }
        }
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = listOf(attributeProcessor),
            transformers = listOf(transformer)
        )
        val event =
            FakeEventFactory.getFragmentLifecycleData().toEvent(type = EventType.LIFECYCLE_FRAGMENT)

        // When
        eventProcessor.trackFragmentLifecycle(event)
        Assert.assertEquals(1, attributeProcessorCalledCount)
        Assert.assertEquals(1, transformerCalledCount)
    }

    @Test
    fun `applies attributes and transformations to application lifecycle event`() {
        var attributeProcessorCalledCount = 0
        val attributeProcessor = object : AttributeProcessor {
            override fun appendAttributes(event: Event<*>) {
                attributeProcessorCalledCount++
            }
        }
        var transformerCalledCount = 0
        val transformer = object : EventTransformer {
            override fun <T> transform(event: Event<T>): Event<T> {
                transformerCalledCount++
                return event
            }
        }
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = listOf(attributeProcessor),
            transformers = listOf(transformer)
        )
        val event =
            FakeEventFactory.getApplicationLifecycleData().toEvent(type = EventType.LIFECYCLE_APP)

        // When
        eventProcessor.trackApplicationLifecycle(event)
        Assert.assertEquals(1, attributeProcessorCalledCount)
        Assert.assertEquals(1, transformerCalledCount)
    }

    @Test
    fun `applies attributes and transformations to cold launch event`() {
        var attributeProcessorCalledCount = 0
        val attributeProcessor = object : AttributeProcessor {
            override fun appendAttributes(event: Event<*>) {
                attributeProcessorCalledCount++
            }
        }
        var transformerCalledCount = 0
        val transformer = object : EventTransformer {
            override fun <T> transform(event: Event<T>): Event<T> {
                transformerCalledCount++
                return event
            }
        }
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = listOf(attributeProcessor),
            transformers = listOf(transformer)
        )
        val event = FakeEventFactory.getColdLaunchData().toEvent(type = EventType.COLD_LAUNCH)

        // When
        eventProcessor.trackColdLaunch(event)
        Assert.assertEquals(1, attributeProcessorCalledCount)
        Assert.assertEquals(1, transformerCalledCount)
    }

    @Test
    fun `applies attributes and transformations to warm launch event`() {
        var attributeProcessorCalledCount = 0
        val attributeProcessor = object : AttributeProcessor {
            override fun appendAttributes(event: Event<*>) {
                attributeProcessorCalledCount++
            }
        }
        var transformerCalledCount = 0
        val transformer = object : EventTransformer {
            override fun <T> transform(event: Event<T>): Event<T> {
                transformerCalledCount++
                return event
            }
        }
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = listOf(attributeProcessor),
            transformers = listOf(transformer)
        )
        val event = FakeEventFactory.getWarmLaunchData().toEvent(type = EventType.WARM_LAUNCH)

        // When
        eventProcessor.trackWarmLaunch(event)
        Assert.assertEquals(1, attributeProcessorCalledCount)
        Assert.assertEquals(1, transformerCalledCount)
    }

    @Test
    fun `applies attributes and transformations to hot launch event`() {
        var attributeProcessorCalledCount = 0
        val attributeProcessor = object : AttributeProcessor {
            override fun appendAttributes(event: Event<*>) {
                attributeProcessorCalledCount++
            }
        }
        var transformerCalledCount = 0
        val transformer = object : EventTransformer {
            override fun <T> transform(event: Event<T>): Event<T> {
                transformerCalledCount++
                return event
            }
        }
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = listOf(attributeProcessor),
            transformers = listOf(transformer)
        )
        val event = FakeEventFactory.getHotLaunchData().toEvent(type = EventType.HOT_LAUNCH)

        // When
        eventProcessor.trackHotLaunch(event)
        Assert.assertEquals(1, attributeProcessorCalledCount)
        Assert.assertEquals(1, transformerCalledCount)
    }

    @Test
    fun `applies attributes and transformations to network change event`() {
        var attributeProcessorCalledCount = 0
        val attributeProcessor = object : AttributeProcessor {
            override fun appendAttributes(event: Event<*>) {
                attributeProcessorCalledCount++
            }
        }
        var transformerCalledCount = 0
        val transformer = object : EventTransformer {
            override fun <T> transform(event: Event<T>): Event<T> {
                transformerCalledCount++
                return event
            }
        }
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = listOf(attributeProcessor),
            transformers = listOf(transformer)
        )
        val event = FakeEventFactory.getNetworkChangeData().toEvent(type = EventType.NETWORK_CHANGE)

        // When
        eventProcessor.trackNetworkChange(event)
        Assert.assertEquals(1, attributeProcessorCalledCount)
        Assert.assertEquals(1, transformerCalledCount)
    }

    @Test
    fun `applies attributes and transformations to http event`() {
        var attributeProcessorCalledCount = 0
        val attributeProcessor = object : AttributeProcessor {
            override fun appendAttributes(event: Event<*>) {
                attributeProcessorCalledCount++
            }
        }
        var transformerCalledCount = 0
        val transformer = object : EventTransformer {
            override fun <T> transform(event: Event<T>): Event<T> {
                transformerCalledCount++
                return event
            }
        }
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = listOf(attributeProcessor),
            transformers = listOf(transformer)
        )
        val event = FakeEventFactory.getHttpData().toEvent(type = EventType.HTTP)

        // When
        eventProcessor.trackHttp(event)
        Assert.assertEquals(1, attributeProcessorCalledCount)
        Assert.assertEquals(1, transformerCalledCount)
    }

    @Test
    fun `applies attributes and transformations to memory usage event`() {
        var attributeProcessorCalledCount = 0
        val attributeProcessor = object : AttributeProcessor {
            override fun appendAttributes(event: Event<*>) {
                attributeProcessorCalledCount++
            }
        }
        var transformerCalledCount = 0
        val transformer = object : EventTransformer {
            override fun <T> transform(event: Event<T>): Event<T> {
                transformerCalledCount++
                return event
            }
        }
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = listOf(attributeProcessor),
            transformers = listOf(transformer)
        )
        val event = FakeEventFactory.getMemoryUsageData().toEvent(type = EventType.MEMORY_USAGE)

        // When
        eventProcessor.trackMemoryUsage(event)
        Assert.assertEquals(1, attributeProcessorCalledCount)
        Assert.assertEquals(1, transformerCalledCount)
    }

    @Test
    fun `applies attributes and transformations to low memory event`() {
        var attributeProcessorCalledCount = 0
        val attributeProcessor = object : AttributeProcessor {
            override fun appendAttributes(event: Event<*>) {
                attributeProcessorCalledCount++
            }
        }
        var transformerCalledCount = 0
        val transformer = object : EventTransformer {
            override fun <T> transform(event: Event<T>): Event<T> {
                transformerCalledCount++
                return event
            }
        }
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = listOf(attributeProcessor),
            transformers = listOf(transformer)
        )
        val event = FakeEventFactory.getLowMemoryData().toEvent(type = EventType.LOW_MEMORY)

        // When
        eventProcessor.trackLowMemory(event)
        Assert.assertEquals(1, attributeProcessorCalledCount)
        Assert.assertEquals(1, transformerCalledCount)
    }

    @Test
    fun `applies attributes and transformations to trim memory event`() {
        var attributeProcessorCalledCount = 0
        val attributeProcessor = object : AttributeProcessor {
            override fun appendAttributes(event: Event<*>) {
                attributeProcessorCalledCount++
            }
        }
        var transformerCalledCount = 0
        val transformer = object : EventTransformer {
            override fun <T> transform(event: Event<T>): Event<T> {
                transformerCalledCount++
                return event
            }
        }
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = listOf(attributeProcessor),
            transformers = listOf(transformer)
        )
        val event = FakeEventFactory.getTrimMemoryData().toEvent(type = EventType.TRIM_MEMORY)

        // When
        eventProcessor.trackTrimMemory(event)
        Assert.assertEquals(1, attributeProcessorCalledCount)
        Assert.assertEquals(1, transformerCalledCount)
    }

    @Test
    fun `applies attributes and transformations to cpu usage event`() {
        var attributeProcessorCalledCount = 0
        val attributeProcessor = object : AttributeProcessor {
            override fun appendAttributes(event: Event<*>) {
                attributeProcessorCalledCount++
            }
        }
        var transformerCalledCount = 0
        val transformer = object : EventTransformer {
            override fun <T> transform(event: Event<T>): Event<T> {
                transformerCalledCount++
                return event
            }
        }
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = listOf(attributeProcessor),
            transformers = listOf(transformer)
        )
        val event = FakeEventFactory.getCpuUsageData().toEvent(type = EventType.CPU_USAGE)

        // When
        eventProcessor.trackCpuUsage(event)
        Assert.assertEquals(1, attributeProcessorCalledCount)
        Assert.assertEquals(1, transformerCalledCount)
    }

    @Test
    fun `applies attributes and transformations to navigation event`() {
        var attributeProcessorCalledCount = 0
        val attributeProcessor = object : AttributeProcessor {
            override fun appendAttributes(event: Event<*>) {
                attributeProcessorCalledCount++
            }
        }
        var transformerCalledCount = 0
        val transformer = object : EventTransformer {
            override fun <T> transform(event: Event<T>): Event<T> {
                transformerCalledCount++
                return event
            }
        }
        val eventProcessor: EventProcessor = EventProcessorImpl(
            logger = NoopLogger(),
            executorService = executorService,
            eventStore = eventStore,
            attributeProcessors = listOf(attributeProcessor),
            transformers = listOf(transformer)
        )
        val event = FakeEventFactory.getNavigationData().toEvent(type = EventType.NAVIGATION)

        // When
        eventProcessor.trackNavigation(event)
        Assert.assertEquals(1, attributeProcessorCalledCount)
        Assert.assertEquals(1, transformerCalledCount)
    }
}