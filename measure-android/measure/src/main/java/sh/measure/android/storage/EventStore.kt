package sh.measure.android.storage

import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json
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
import sh.measure.android.utils.IdProvider

internal interface EventStore {
    fun storeUnhandledException(event: Event<ExceptionData>)
    fun storeAnr(event: Event<ExceptionData>)
    fun storeClick(event: Event<ClickData>)
    fun storeLongClick(event: Event<LongClickData>)
    fun storeScroll(event: Event<ScrollData>)
    fun storeActivityLifecycle(event: Event<ActivityLifecycleData>)
    fun storeFragmentLifecycle(event: Event<FragmentLifecycleData>)
    fun storeApplicationLifecycle(event: Event<ApplicationLifecycleData>)
    fun storeColdLaunch(event: Event<ColdLaunchData>)
    fun storeWarmLaunch(event: Event<WarmLaunchData>)
    fun storeHotLaunch(event: Event<HotLaunchData>)
    fun storeNetworkChange(event: Event<NetworkChangeData>)
    fun storeHttp(event: Event<HttpData>)
    fun storeMemoryUsage(event: Event<MemoryUsageData>)
    fun storeLowMemory(event: Event<LowMemoryData>)
    fun storeTrimMemory(event: Event<TrimMemoryData>)
    fun storeCpuUsage(event: Event<CpuUsageData>)
    fun storeNavigation(event: Event<NavigationData>)
}

internal class EventStoreImpl(
    private val fileStorage: FileStorage,
    private val database: Database,
    private val idProvider: IdProvider,
) : EventStore {
    override fun storeUnhandledException(event: Event<ExceptionData>) {
        val eventId = idProvider.createId()
        fileStorage.createExceptionFile(eventId)?.let {
            fileStorage.writeException(it, event)
            database.insertEvent(
                EventEntity(
                    id = eventId,
                    type = event.type,
                    timestamp = event.timestamp,
                    sessionId = event.sessionId!!,
                    filePath = it
                )
            )
        }
    }

    override fun storeAnr(event: Event<ExceptionData>) {
        val eventId = idProvider.createId()
        fileStorage.createAnrPath(eventId)?.let {
            fileStorage.writeException(it, event)
            database.insertEvent(
                EventEntity(
                    id = eventId,
                    type = event.type,
                    timestamp = event.timestamp,
                    sessionId = event.sessionId!!,
                    filePath = it
                )
            )
        }
    }

    override fun storeClick(event: Event<ClickData>) {
        storeEvent(event, ClickData.serializer())
    }

    override fun storeLongClick(event: Event<LongClickData>) {
        storeEvent(event, LongClickData.serializer())
    }

    override fun storeScroll(event: Event<ScrollData>) {
        storeEvent(event, ScrollData.serializer())
    }

    override fun storeActivityLifecycle(event: Event<ActivityLifecycleData>) {
        storeEvent(event, ActivityLifecycleData.serializer())
    }

    override fun storeFragmentLifecycle(event: Event<FragmentLifecycleData>) {
        storeEvent(event, FragmentLifecycleData.serializer())
    }

    override fun storeApplicationLifecycle(event: Event<ApplicationLifecycleData>) {
        storeEvent(event, ApplicationLifecycleData.serializer())
    }

    override fun storeColdLaunch(event: Event<ColdLaunchData>) {
        storeEvent(event, ColdLaunchData.serializer())
    }

    override fun storeWarmLaunch(event: Event<WarmLaunchData>) {
        storeEvent(event, WarmLaunchData.serializer())
    }

    override fun storeHotLaunch(event: Event<HotLaunchData>) {
        storeEvent(event, HotLaunchData.serializer())
    }

    override fun storeNetworkChange(event: Event<NetworkChangeData>) {
        storeEvent(event, NetworkChangeData.serializer())
    }

    override fun storeHttp(event: Event<HttpData>) {
        storeEvent(event, HttpData.serializer())
    }

    override fun storeMemoryUsage(event: Event<MemoryUsageData>) {
        storeEvent(event, MemoryUsageData.serializer())
    }

    override fun storeLowMemory(event: Event<LowMemoryData>) {
        storeEvent(event, LowMemoryData.serializer())
    }

    override fun storeTrimMemory(event: Event<TrimMemoryData>) {
        storeEvent(event, TrimMemoryData.serializer())
    }

    override fun storeCpuUsage(event: Event<CpuUsageData>) {
        storeEvent(event, CpuUsageData.serializer())
    }

    override fun storeNavigation(event: Event<NavigationData>) {
        storeEvent(event, NavigationData.serializer())
    }

    private fun <T> storeEvent(event: Event<T>, serializer: KSerializer<T>) {
        val eventId = idProvider.createId()
        database.insertEvent(
            EventEntity(
                id = eventId,
                type = event.type,
                timestamp = event.timestamp,
                sessionId = event.sessionId!!,
                serializedData = Json.encodeToString(serializer, event.data)
            )
        )
    }
}
