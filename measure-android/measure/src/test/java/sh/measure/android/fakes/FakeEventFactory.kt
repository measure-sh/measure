package sh.measure.android.fakes

import sh.measure.android.applaunch.ColdLaunchData
import sh.measure.android.applaunch.HotLaunchData
import sh.measure.android.applaunch.WarmLaunchData
import sh.measure.android.events.Attachment
import sh.measure.android.events.Event
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.exceptions.ExceptionFactory
import sh.measure.android.exporter.AttachmentPacket
import sh.measure.android.exporter.EventPacket
import sh.measure.android.gestures.ClickData
import sh.measure.android.gestures.LongClickData
import sh.measure.android.gestures.ScrollData
import sh.measure.android.lifecycle.ActivityLifecycleData
import sh.measure.android.lifecycle.ActivityLifecycleType
import sh.measure.android.lifecycle.AppLifecycleType
import sh.measure.android.lifecycle.ApplicationLifecycleData
import sh.measure.android.lifecycle.FragmentLifecycleData
import sh.measure.android.lifecycle.FragmentLifecycleType
import sh.measure.android.navigation.NavigationData
import sh.measure.android.networkchange.NetworkChangeData
import sh.measure.android.okhttp.HttpData
import sh.measure.android.performance.CpuUsageData
import sh.measure.android.performance.LowMemoryData
import sh.measure.android.performance.MemoryUsageData
import sh.measure.android.performance.TrimMemoryData
import sh.measure.android.storage.AttachmentEntity
import sh.measure.android.storage.EventEntity

internal object FakeEventFactory {

    fun getExceptionData(
        exception: Exception = IllegalArgumentException("Test exception"),
        handled: Boolean = true,
        thread: Thread = Thread.currentThread(),
        foreground: Boolean = true,
    ): ExceptionData {
        return ExceptionFactory.createMeasureException(
            exception,
            handled,
            thread,
            foreground,
        )
    }

    fun getClickData(
        target: String = "target",
        targetId: String = "target-id",
        width: Int = 100,
        height: Int = 200,
        x: Float = 50F,
        y: Float = 50F,
        touchDownTime: Long = 987549876L,
        touchUpTime: Long = 234567609L,
    ): ClickData {
        return ClickData(target, targetId, width, height, x, y, touchDownTime, touchUpTime)
    }

    fun <T> T.toEvent(
        id: String = "event-id",
        timestamp: String = "2024-03-18T12:50:12.62600000Z",
        type: String,
        sessionId: String = "session-id",
        attachments: MutableList<Attachment> = mutableListOf(),
        attributes: MutableMap<String, Any?> = mutableMapOf(),
    ): Event<T> {
        return Event(
            id = id,
            timestamp = timestamp,
            data = this,
            type = type,
            sessionId = sessionId,
            attachments = attachments,
            attributes = attributes,
        )
    }

    fun getLongClickData(
        target: String = "target",
        targetId: String = "target-id",
        width: Int = 100,
        height: Int = 200,
        x: Float = 50F,
        y: Float = 50F,
        touchDownTime: Long = 987549876L,
        touchUpTime: Long = 234567609L,
    ): LongClickData {
        return LongClickData(target, targetId, width, height, x, y, touchDownTime, touchUpTime)
    }

    fun getScrollData(
        target: String = "target",
        targetId: String = "target-id",
        x: Float = 50F,
        y: Float = 50F,
        endX: Float = 10F,
        endY: Float = 10F,
        direction: String = "left",
        touchDownTime: Long = 987549876L,
        touchUpTime: Long = 234567609L,
    ): ScrollData {
        return ScrollData(
            target, targetId, x, y, endX, endY, direction, touchDownTime, touchUpTime,
        )
    }

    fun getActivityLifecycleData(
        type: String = ActivityLifecycleType.CREATED,
        className: String = "Activity",
        intent: String? = null,
        savedInstanceState: Boolean = false,
    ): ActivityLifecycleData {
        return ActivityLifecycleData(type, className, intent, savedInstanceState)
    }

    fun getFragmentLifecycleData(
        type: String = FragmentLifecycleType.ATTACHED,
        className: String = "Fragment",
        parentActivity: String = "Activity",
        tag: String? = null,
    ): FragmentLifecycleData {
        return FragmentLifecycleData(type, className, parentActivity, tag)
    }

    fun getApplicationLifecycleData(type: String = AppLifecycleType.FOREGROUND): ApplicationLifecycleData {
        return ApplicationLifecycleData(type)
    }

    fun getColdLaunchData(
        processStartUptime: Long = 100,
        processStartRequestedUptime: Long = 200,
        contentProviderAttachUptime: Long = 300,
        onNextDrawUptime: Long = 400,
        launchedActivity: String = "launched_activity",
        hasSavedState: Boolean = true,
        intentData: String = "intent_data",
    ): ColdLaunchData {
        return ColdLaunchData(
            processStartUptime,
            processStartRequestedUptime,
            contentProviderAttachUptime,
            onNextDrawUptime,
            launchedActivity,
            hasSavedState,
            intentData,
        )
    }

    fun getWarmLaunchData(
        appVisibleUptime: Long = 100,
        onNextDrawUptime: Long = 200,
        launchedActivity: String = "launched_activity",
        hasSavedState: Boolean = true,
        intentData: String = "intent_data",
    ): WarmLaunchData {
        return WarmLaunchData(
            appVisibleUptime,
            onNextDrawUptime,
            launchedActivity,
            hasSavedState,
            intentData,
        )
    }

    fun getHotLaunchData(
        appVisibleUptime: Long = 100,
        onNextDrawUptime: Long = 200,
        launchedActivity: String = "launched_activity",
        hasSavedState: Boolean = true,
        intentData: String = "intent_data",
    ): HotLaunchData {
        return HotLaunchData(
            appVisibleUptime,
            onNextDrawUptime,
            launchedActivity,
            hasSavedState,
            intentData,
        )
    }

    fun getNetworkChangeData(
        previousNetworkType: String? = "cellular",
        networkType: String = "wifi",
        previousNetworkGeneration: String? = "2g",
        networkGeneration: String? = null,
        networkProvider: String? = "t-mobile",
    ): NetworkChangeData {
        return NetworkChangeData(
            previousNetworkType,
            networkType,
            previousNetworkGeneration,
            networkGeneration,
            networkProvider,
        )
    }

    fun getHttpData(
        url: String = "url",
        method: String = "method",
        statusCode: Int = 200,
        startTime: Long = 98764567L,
        endTime: Long = 567890987L,
        failureReason: String = "failure-reason",
        failureDescription: String = "failure-description",
        requestHeaders: Map<String, String> = emptyMap(),
        responseHeaders: Map<String, String> = emptyMap(),
        requestBody: String? = "request-body",
        responseBody: String? = "response-body",
        client: String = "client",
    ): HttpData {
        return HttpData(
            url,
            method,
            statusCode,
            startTime,
            endTime,
            failureReason,
            failureDescription,
            requestHeaders,
            responseHeaders,
            requestBody,
            responseBody,
            client,
        )
    }

    fun getMemoryUsageData(
        javaMaxHeap: Long = 100,
        javaTotalHeap: Long = 200,
        javaFreeHeap: Long = 300,
        totalPss: Int = 400,
        rss: Long? = 500,
        nativeTotalHeap: Long = 600,
        nativeFreeHeap: Long = 700,
        intervalConfig: Long = 800,
    ): MemoryUsageData {
        return MemoryUsageData(
            javaMaxHeap,
            javaTotalHeap,
            javaFreeHeap,
            totalPss,
            rss,
            nativeTotalHeap,
            nativeFreeHeap,
            intervalConfig,
        )
    }

    fun getLowMemoryData(
        javaMaxHeap: Long = 100,
        javaTotalHeap: Long = 200,
        javaFreeHeap: Long = 300,
        totalPss: Int = 400,
        rss: Long? = 500,
        nativeTotalHeap: Long = 600,
        nativeFreeHeap: Long = 700,
    ): LowMemoryData {
        return LowMemoryData(
            javaMaxHeap,
            javaTotalHeap,
            javaFreeHeap,
            totalPss,
            rss,
            nativeTotalHeap,
            nativeFreeHeap,
        )
    }

    fun getTrimMemoryData(
        level: String = "TRIM_MEMORY_UI_HIDDEN",
    ): TrimMemoryData {
        return TrimMemoryData(level)
    }

    fun getNavigationData(route: String = "profile"): NavigationData {
        return NavigationData(route)
    }

    fun getCpuUsageData(
        numCores: Int = 4,
        clockSpeed: Long = 10,
        startTime: Long = 123456789L,
        uptime: Long = 987654321L,
        utime: Long = 1234L,
        cutime: Long = 9876L,
        cstime: Long = 1234L,
        stime: Long = 9876L,
        intervalConfig: Long = 1000,
    ): CpuUsageData {
        return CpuUsageData(
            numCores,
            clockSpeed,
            startTime,
            uptime,
            utime,
            cutime,
            cstime,
            stime,
            intervalConfig,
        )
    }

    fun fakeEventEntity(
        eventId: String = "event-id",
        type: String = "string",
        sessionId: String = "session-id",
        timestamp: String = "2024-03-18T12:50:12.62600000Z",
        attachmentSize: Long = 100,
        serializedData: String? = "serialized-data",
        serializedAttributes: String = "serialized-attributes",
        serializedAttachments: String = "serialized-attachments",
        filePath: String? = null,
        attachmentEntities: List<AttachmentEntity> = listOf(
            AttachmentEntity(id = "attachment-id", type = "type", path = "path", name = "name"),
        ),
    ): EventEntity {
        return EventEntity(
            id = eventId,
            type = type,
            timestamp = timestamp,
            sessionId = sessionId,
            attachmentsSize = attachmentSize,
            serializedData = serializedData,
            serializedAttributes = serializedAttributes,
            serializedAttachments = serializedAttachments,
            attachmentEntities = attachmentEntities,
            filePath = filePath,
        )
    }

    fun getEventPacket(eventEntity: EventEntity): EventPacket {
        return EventPacket(
            eventId = eventEntity.id,
            type = eventEntity.type,
            timestamp = eventEntity.timestamp,
            sessionId = eventEntity.sessionId,
            serializedData = eventEntity.serializedData,
            serializedAttributes = eventEntity.serializedAttributes ?: "",
            serializedAttachments = eventEntity.serializedAttachments,
            serializedDataFilePath = eventEntity.filePath,
        )
    }

    fun getAttachmentPackets(eventEntity: EventEntity): List<AttachmentPacket> {
        return eventEntity.attachmentEntities?.map {
            AttachmentPacket(
                id = it.id,
                filePath = it.path,
            )
        } ?: emptyList()
    }

    fun getAttachment(
        type: String = "type",
        name: String = "name",
        path: String? = "path",
        bytes: ByteArray? = null,
    ): Attachment {
        return Attachment(
            type = type,
            name = name,
            path = path,
            bytes = bytes,
        )
    }
}
