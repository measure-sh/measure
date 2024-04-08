package sh.measure.android.storage

import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import sh.measure.android.applaunch.ColdLaunchData
import sh.measure.android.applaunch.HotLaunchData
import sh.measure.android.applaunch.WarmLaunchData
import sh.measure.android.events.Attachment
import sh.measure.android.events.Event
import sh.measure.android.events.EventType
import sh.measure.android.exceptions.ExceptionData
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
import sh.measure.android.tracing.InternalTrace
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.SessionIdProvider
import sh.measure.android.utils.toJsonElement

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
    private val logger: Logger,
    private val fileStorage: FileStorage,
    private val database: Database,
    private val idProvider: IdProvider,
    private val sessionIdProvider: SessionIdProvider,
) : EventStore {
    override fun storeUnhandledException(event: Event<ExceptionData>) {
        storeExceptionEvent(event)
    }

    override fun storeAnr(event: Event<ExceptionData>) {
        storeExceptionEvent(event)
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

    private fun storeExceptionEvent(event: Event<ExceptionData>) {
        val eventId = idProvider.createId()
        val path = when (event.type) {
            EventType.EXCEPTION -> fileStorage.writeException(eventId, event)
            EventType.ANR -> fileStorage.writeAnr(eventId, event)
            else -> {
                logger.log(LogLevel.Error, "${event.type} cannot be stored as an exception.")
                return
            }
        } ?: return

        val attachmentEntities = writeAttachments(event)
        val serializedAttributes = serializeAttributes(event)
        database.insertEvent(
            EventEntity(
                id = eventId,
                type = event.type,
                timestamp = event.timestamp,
                filePath = path,
                sessionId = sessionIdProvider.sessionId,
                attachmentEntities = attachmentEntities,
                serializedAttributes = serializedAttributes,
            ),
        )
    }

    private fun <T> serializeAttributes(event: Event<T>): String? {
        InternalTrace.beginSection("EventStore.serializeAttributes")
        if (event.attributes.isEmpty()) {
            return null
        }
        val result = Json.encodeToString(
            JsonElement.serializer(),
            event.attributes.toJsonElement(),
        )
        InternalTrace.endSection()
        return result
    }

    private fun <T> storeEvent(event: Event<T>, serializer: KSerializer<T>) {
        InternalTrace.beginSection("EventStore.storeEvent")
        val eventId = idProvider.createId()
        val attachmentEntities = writeAttachments(event)
        val serializedData = Json.encodeToString(serializer, event.data)
        val serializedAttributes = serializeAttributes(event)
        database.insertEvent(
            EventEntity(
                id = eventId,
                type = event.type,
                timestamp = event.timestamp,
                serializedData = serializedData,
                sessionId = sessionIdProvider.sessionId,
                attachmentEntities = attachmentEntities,
                serializedAttributes = serializedAttributes,
            ),
        )
        InternalTrace.endSection()
    }

    private fun <T> writeAttachments(event: Event<T>): List<AttachmentEntity>? {
        if (event.attachments.isEmpty()) {
            return null
        }
        InternalTrace.beginSection("EventStore.writeAttachments")
        val attachmentEntities = event.attachments.mapNotNull {
            createAttachment(it)?.let { path ->
                AttachmentEntity(
                    id = idProvider.createId(),
                    type = it.type,
                    extension = it.extension,
                    path = path,
                )
            }
        }
        InternalTrace.endSection()
        return attachmentEntities
    }

    private fun createAttachment(attachment: Attachment): String? {
        return when {
            attachment.path != null -> {
                attachment.path
            }

            attachment.bytes != null -> {
                fileStorage.writeAttachment(idProvider.createId(), attachment.bytes)
            }

            else -> {
                logger.log(LogLevel.Error, "Attachment(${attachment.type}) has no data")
                return null
            }
        }
    }
}
