package sh.measure.android.fakes

import sh.measure.android.MsrAttachment
import sh.measure.android.appexit.AppExit
import sh.measure.android.applaunch.ColdLaunchData
import sh.measure.android.applaunch.HotLaunchData
import sh.measure.android.applaunch.WarmLaunchData
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.bugreport.BugReportData
import sh.measure.android.events.Attachment
import sh.measure.android.events.AttachmentType
import sh.measure.android.events.Event
import sh.measure.android.events.EventType
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.exceptions.ExceptionFactory
import sh.measure.android.exporter.AttachmentPacket
import sh.measure.android.exporter.EventPacket
import sh.measure.android.exporter.SpanPacket
import sh.measure.android.gestures.ClickData
import sh.measure.android.gestures.LongClickData
import sh.measure.android.gestures.ScrollData
import sh.measure.android.lifecycle.ActivityLifecycleData
import sh.measure.android.lifecycle.ActivityLifecycleType
import sh.measure.android.lifecycle.AppLifecycleType
import sh.measure.android.lifecycle.ApplicationLifecycleData
import sh.measure.android.lifecycle.FragmentLifecycleData
import sh.measure.android.lifecycle.FragmentLifecycleType
import sh.measure.android.logger.Logger
import sh.measure.android.navigation.ScreenViewData
import sh.measure.android.networkchange.NetworkChangeData
import sh.measure.android.networkchange.NetworkGeneration
import sh.measure.android.okhttp.HttpData
import sh.measure.android.performance.CpuUsageData
import sh.measure.android.performance.MemoryUsageData
import sh.measure.android.performance.TrimMemoryData
import sh.measure.android.storage.AttachmentEntity
import sh.measure.android.storage.BatchEntity
import sh.measure.android.storage.EventEntity
import sh.measure.android.storage.SessionEntity
import sh.measure.android.storage.SpanEntity
import sh.measure.android.storage.toSpanEntity
import sh.measure.android.tracing.Checkpoint
import sh.measure.android.tracing.MsrSpan
import sh.measure.android.tracing.SpanData
import sh.measure.android.tracing.SpanProcessor
import sh.measure.android.tracing.SpanStatus
import sh.measure.android.utils.TimeProvider
import sh.measure.android.utils.iso8601Timestamp

internal object TestData {

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
        type: EventType,
        sessionId: String = "session-id",
        attachments: MutableList<Attachment> = mutableListOf(),
        attributes: MutableMap<String, Any?> = mutableMapOf(),
        userTriggered: Boolean = false,
        userDefinedAttributes: Map<String, AttributeValue> = emptyMap(),
    ): Event<T> {
        return Event(
            id = id,
            timestamp = timestamp,
            data = this,
            type = type,
            sessionId = sessionId,
            attachments = attachments,
            attributes = attributes,
            userTriggered = userTriggered,
            userDefinedAttributes = userDefinedAttributes,
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
        processStartUptime: Long = 100,
        processStartRequestedUptime: Long = 200,
        contentProviderAttachUptime: Long = 300,
        appVisibleUptime: Long = 100,
        onNextDrawUptime: Long = 200,
        launchedActivity: String = "launched_activity",
        hasSavedState: Boolean = true,
        intentData: String = "intent_data",
        isLukewarm: Boolean = false,
    ): WarmLaunchData {
        return WarmLaunchData(
            processStartUptime,
            processStartRequestedUptime,
            contentProviderAttachUptime,
            appVisibleUptime,
            onNextDrawUptime,
            launchedActivity,
            hasSavedState,
            intentData,
            isLukewarm,
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
        previousNetworkType: String = "cellular",
        networkType: String = "wifi",
        previousNetworkGeneration: String = "2g",
        networkGeneration: String = NetworkGeneration.UNKNOWN,
        networkProvider: String = "t-mobile",
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
        interval: Long = 800,
    ): MemoryUsageData {
        return MemoryUsageData(
            javaMaxHeap,
            javaTotalHeap,
            javaFreeHeap,
            totalPss,
            rss,
            nativeTotalHeap,
            nativeFreeHeap,
            interval,
        )
    }

    fun getTrimMemoryData(
        level: String = "TRIM_MEMORY_UI_HIDDEN",
    ): TrimMemoryData {
        return TrimMemoryData(level)
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
        interval: Long = 1000,
        percentageUsage: Double = 0.0,
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
            interval,
            percentageUsage,
        )
    }

    fun getEventPacket(eventEntity: EventEntity): EventPacket {
        return EventPacket(
            eventId = eventEntity.id,
            type = eventEntity.type,
            timestamp = eventEntity.timestamp,
            sessionId = eventEntity.sessionId,
            userTriggered = eventEntity.userTriggered,
            serializedData = eventEntity.serializedData,
            serializedAttributes = eventEntity.serializedAttributes ?: "",
            serializedAttachments = eventEntity.serializedAttachments,
            serializedDataFilePath = eventEntity.filePath,
            serializedUserDefinedAttributes = eventEntity.serializedUserDefAttributes,
        )
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

    fun getAttachmentEntity(
        id: String = "attachment-id",
        type: String = "type",
        name: String = "name",
    ): AttachmentEntity {
        return AttachmentEntity(
            id = id,
            type = type,
            name = name,
        )
    }

    fun getEventEntity(
        eventId: String = "event-id",
        type: EventType = EventType.STRING,
        sessionId: String = "session-id",
        userTriggered: Boolean = false,
        timestamp: String = "2024-03-18T12:50:12.62600000Z",
        attachmentSize: Long = 0,
        serializedData: String? = "serialized-data",
        serializedAttributes: String = "serialized-attributes",
        serializedAttachments: String = "serialized-attachments",
        filePath: String? = null,
        attachmentEntities: List<AttachmentEntity> = emptyList(),
        serializedUserDefAttributes: String? = null,
    ): EventEntity {
        return EventEntity(
            id = eventId,
            type = type,
            timestamp = timestamp,
            sessionId = sessionId,
            userTriggered = userTriggered,
            attachmentsSize = attachmentSize,
            serializedData = serializedData,
            serializedAttributes = serializedAttributes,
            serializedAttachments = serializedAttachments,
            attachmentEntities = attachmentEntities,
            filePath = filePath,
            serializedUserDefAttributes = serializedUserDefAttributes,
        )
    }

    fun getSessionEntity(
        id: String = "session-id",
        pid: Int = 100,
        createdAt: Long = 987654321L,
        needsReporting: Boolean = false,
        crashed: Boolean = false,
        supportsAppExit: Boolean = false,
        appVersion: String? = "1.0.0",
        appBuild: String? = "100",
    ): SessionEntity {
        return SessionEntity(
            sessionId = id,
            pid = pid,
            createdAt = createdAt,
            needsReporting = needsReporting,
            crashed = crashed,
            supportsAppExit = supportsAppExit,
            appVersion = appVersion,
            appBuild = appBuild,
        )
    }

    fun getEventBatchEntity(
        batchId: String = "batch-id",
        eventIds: List<String> = emptyList(),
        spanIds: List<String> = emptyList(),
        createdAt: Long = 987654321L,
    ): BatchEntity {
        return BatchEntity(
            batchId = batchId,
            eventIds = eventIds,
            spanIds = spanIds,
            createdAt = createdAt,
        )
    }

    fun getAttachmentPacket(
        id: String = "attachment-id",
        filePath: String = "/path/to/attachment.png",
    ): AttachmentPacket {
        return AttachmentPacket(id = id, filePath = filePath)
    }

    fun getAppExit(
        reasonId: Int = 1,
        reason: String = "reason",
        importance: String = "importance",
        trace: String? = "trace",
        processName: String = "process-name",
        appExitTimeMs: Long = 987654321L,
        pid: String = "123",
    ): AppExit {
        return AppExit(
            reasonId = reasonId,
            reason = reason,
            importance = importance,
            trace = trace,
            process_name = processName,
            app_exit_time_ms = appExitTimeMs,
            pid = pid,
        )
    }

    fun getScreenViewData(): ScreenViewData {
        return ScreenViewData(name = "screen-name")
    }

    fun getSpanData(
        name: String = "span-name",
        traceId: String = "trace-id",
        spanId: String = "span-id",
        parentId: String? = "parent-id",
        sessionId: String = "session-id",
        startTime: Long = 1000L,
        endTime: Long = 2000L,
        duration: Long = 1000L,
        status: SpanStatus = SpanStatus.Ok,
        hasEnded: Boolean = true,
        attributes: Map<String, Any?> = emptyMap(),
        userDefinedAttrs: Map<String, Any?> = emptyMap(),
        checkpoints: MutableList<Checkpoint> = mutableListOf(),
        isSampled: Boolean = true,
    ): SpanData {
        return SpanData(
            name = name,
            traceId = traceId,
            spanId = spanId,
            parentId = parentId,
            sessionId = sessionId,
            startTime = startTime,
            endTime = endTime,
            duration = duration,
            status = status,
            hasEnded = hasEnded,
            attributes = attributes,
            userDefinedAttrs = userDefinedAttrs,
            checkpoints = checkpoints,
            isSampled = isSampled,
        )
    }

    fun getSpan(
        logger: Logger,
        timeProvider: TimeProvider,
        spanProcessor: SpanProcessor,
        name: String = "span-name",
        spanId: String = "span-id",
        traceId: String = "trace-id",
        parentId: String? = null,
        sessionId: String = "session-id",
        startTime: Long = 987654321L,
        isSampled: Boolean = true,
    ): MsrSpan {
        return MsrSpan(
            logger,
            timeProvider,
            spanProcessor,
            isSampled,
            name,
            spanId,
            traceId,
            parentId,
            sessionId,
            startTime,
        )
    }

    fun getSpanEntity(
        name: String = "span-name",
        traceId: String = "trace-id",
        spanId: String = "span-id",
        parentId: String? = "parent-id",
        sessionId: String = "session-id",
        startTime: Long = 1000L,
        endTime: Long = 2000L,
        duration: Long = 1000L,
        status: SpanStatus = SpanStatus.Ok,
        hasEnded: Boolean = true,
        attributes: Map<String, Any?> = emptyMap(),
        userDefinedAttrs: Map<String, Any?> = emptyMap(),
        checkpoints: MutableList<Checkpoint> = mutableListOf(),
    ): SpanEntity {
        return getSpanData(
            name = name,
            traceId = traceId,
            spanId = spanId,
            parentId = parentId,
            sessionId = sessionId,
            startTime = startTime,
            endTime = endTime,
            duration = duration,
            status = status,
            hasEnded = hasEnded,
            attributes = attributes,
            userDefinedAttrs = userDefinedAttrs,
            checkpoints = checkpoints,
        ).toSpanEntity()
    }

    fun getSpanPacket(spanEntity: SpanEntity): SpanPacket {
        return SpanPacket(
            name = spanEntity.name,
            traceId = spanEntity.traceId,
            spanId = spanEntity.spanId,
            parentId = spanEntity.parentId,
            sessionId = spanEntity.sessionId,
            startTime = spanEntity.startTime.iso8601Timestamp(),
            endTime = spanEntity.endTime.iso8601Timestamp(),
            duration = spanEntity.duration,
            status = spanEntity.status.value,
            serializedAttributes = spanEntity.serializedAttributes,
            serializedCheckpoints = spanEntity.serializedCheckpoints,
            serializedUserDefAttrs = spanEntity.serializedUserDefinedAttrs,
        )
    }

    fun getCheckpoint(): Checkpoint {
        return Checkpoint(
            name = "name",
            timestamp = 98765432L,
        )
    }

    fun getBugReportData(): BugReportData {
        return BugReportData("Bug report description")
    }

    fun getMsrAttachment(
        name: String = "attachment",
        content: ByteArray = "content".toByteArray(),
        type: String = AttachmentType.SCREENSHOT,
    ): MsrAttachment {
        return MsrAttachment(name, content, type = type)
    }
}
