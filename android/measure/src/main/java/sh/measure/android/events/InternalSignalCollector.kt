package sh.measure.android.events

import sh.measure.android.MsrAttachment
import sh.measure.android.SessionManager
import sh.measure.android.attributes.AttributeProcessor
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.bugreport.BugReportData
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.navigation.ScreenViewData
import sh.measure.android.okhttp.HttpData
import sh.measure.android.serialization.jsonSerializer
import sh.measure.android.toEventAttachment
import sh.measure.android.tracing.Checkpoint
import sh.measure.android.tracing.SpanData
import sh.measure.android.tracing.SpanStatus
import sh.measure.android.utils.ProcessInfoProvider
import sh.measure.android.utils.toJsonElement

/**
 * Processes and tracks events or spans received from cross platform sources like Flutter/RN.
 */
internal class InternalSignalCollector(
    private val logger: Logger,
    private val signalProcessor: SignalProcessor,
    private val processInfoProvider: ProcessInfoProvider,
    private val sessionManager: SessionManager,
    private val spanAttributeProcessors: List<AttributeProcessor>,
) {
    fun trackEvent(
        data: MutableMap<String, Any?>,
        type: String,
        timestamp: Long,
        attributes: MutableMap<String, Any?>,
        userDefinedAttrs: MutableMap<String, AttributeValue>,
        attachments: MutableList<MsrAttachment>,
        userTriggered: Boolean,
        sessionId: String?,
        threadName: String?,
    ) {
        try {
            val eventAttachments = mutableListOf<Attachment>()
            attachments.mapTo(eventAttachments) { it.toEventAttachment(it.type) }
            val eventType = EventType.fromValue(type)
            if (eventType == null) {
                logger.log(LogLevel.Error, "Unknown event type: $type")
                return
            }
            when (eventType) {
                EventType.CUSTOM -> {
                    val extractedData = extractCustomEventData(data)
                    signalProcessor.track(
                        data = extractedData,
                        timestamp = timestamp,
                        type = eventType,
                        attributes = attributes,
                        userDefinedAttributes = userDefinedAttrs,
                        attachments = eventAttachments,
                        threadName = threadName,
                        sessionId = sessionId,
                        userTriggered = userTriggered,
                    )
                }

                EventType.EXCEPTION -> {
                    // adding foreground property to the exception data here
                    // as we don't want to add duplicate logic in Flutter/RN
                    // to find out whether the app is in foreground or not.
                    if (data.containsKey("foreground")) {
                        data["foreground"] = processInfoProvider.isForegroundProcess()
                    } else {
                        logger.log(
                            LogLevel.Debug,
                            "invalid exception event, missing foreground property",
                        )
                    }
                    val extractedData = extractExceptionEventData(data)
                    if (!extractedData.handled) {
                        // ignoring session ID and user triggered properties
                        // this should be safe as handled exceptions are not tracked in
                        // a separate session and are not user triggered.
                        signalProcessor.trackCrash(
                            data = extractedData,
                            timestamp = timestamp,
                            type = eventType,
                            attributes = attributes,
                            userDefinedAttributes = userDefinedAttrs,
                            attachments = eventAttachments,
                            threadName = threadName,
                        )
                    } else {
                        signalProcessor.track(
                            data = extractedData,
                            timestamp = timestamp,
                            type = eventType,
                            attributes = attributes,
                            userDefinedAttributes = userDefinedAttrs,
                            attachments = eventAttachments,
                            threadName = threadName,
                            sessionId = sessionId,
                            userTriggered = userTriggered,
                        )
                    }
                }

                EventType.SCREEN_VIEW -> {
                    val extractedData = extractScreenViewData(data)
                    signalProcessor.track(
                        data = extractedData,
                        timestamp = timestamp,
                        type = eventType,
                        attributes = attributes,
                        userDefinedAttributes = userDefinedAttrs,
                        userTriggered = userTriggered,
                    )
                }

                EventType.HTTP -> {
                    val extractedData = extractHttpData(data)
                    signalProcessor.track(
                        data = extractedData,
                        timestamp = timestamp,
                        type = eventType,
                        attributes = attributes,
                        userDefinedAttributes = userDefinedAttrs,
                        userTriggered = userTriggered,
                    )
                }

                EventType.BUG_REPORT -> {
                    val extractedData = extractBugReportData(data)
                    signalProcessor.track(
                        data = extractedData,
                        timestamp = timestamp,
                        type = eventType,
                        attributes = attributes,
                        userDefinedAttributes = userDefinedAttrs,
                        attachments = eventAttachments,
                        userTriggered = userTriggered,
                    )
                }

                else -> {
                    logger.log(LogLevel.Error, "Unknown event type: $type")
                }
            }
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "Failed to decode event $type", e)
        }
    }

    fun trackSpan(
        name: String,
        traceId: String,
        spanId: String,
        parentId: String?,
        startTime: Long,
        endTime: Long,
        duration: Long,
        status: Int,
        attributes: MutableMap<String, Any?>,
        userDefinedAttrs: Map<String, Any>,
        checkpoints: Map<String, Long>,
        hasEnded: Boolean,
        isSampled: Boolean,
    ) {
        val sessionId = sessionManager.getSessionId()

        spanAttributeProcessors.forEach {
            it.appendAttributes(attributes)
        }

        try {
            val spanData = SpanData(
                name = name,
                traceId = traceId,
                spanId = spanId,
                parentId = parentId,
                sessionId = sessionId,
                startTime = startTime,
                endTime = endTime,
                duration = duration,
                status = SpanStatus.fromValue(status),
                attributes = attributes,
                userDefinedAttrs = userDefinedAttrs,
                checkpoints = checkpoints.map { Checkpoint(it.key, it.value) }.toMutableList(),
                hasEnded = hasEnded,
                isSampled = isSampled,
            )
            signalProcessor.trackSpan(spanData)
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "Failed to decode span", e)
        }
    }

    private fun extractHttpData(map: MutableMap<String, Any?>): HttpData {
        return jsonSerializer.decodeFromJsonElement(HttpData.serializer(), map.toJsonElement())
    }

    private fun extractScreenViewData(map: MutableMap<String, Any?>): ScreenViewData {
        return jsonSerializer.decodeFromJsonElement(
            ScreenViewData.serializer(),
            map.toJsonElement(),
        )
    }

    private fun extractExceptionEventData(map: Map<String, Any?>): ExceptionData {
        return jsonSerializer.decodeFromJsonElement(ExceptionData.serializer(), map.toJsonElement())
    }

    private fun extractCustomEventData(data: Map<String, Any?>): CustomEventData {
        return jsonSerializer.decodeFromJsonElement(
            CustomEventData.serializer(),
            data.toJsonElement(),
        )
    }

    private fun extractBugReportData(map: MutableMap<String, Any?>): BugReportData {
        return jsonSerializer.decodeFromJsonElement(
            BugReportData.serializer(),
            map.toJsonElement(),
        )
    }
}
