@file:Suppress("unused")

package sh.measure.rn

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.UiThreadUtil
import sh.measure.android.Measure
import sh.measure.android.MsrAttachment
import sh.measure.android.config.ClientInfo
import sh.measure.android.config.MeasureConfig

class MeasureModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = ModuleConstants.MODULE_NAME

    @ReactMethod
    fun initialize(clientMap: ReadableMap, configMap: ReadableMap, promise: Promise) {
        try {
            val context = reactContext.applicationContext

            val clientJson = MapUtils.toStringMap(clientMap)
            val configJson = MapUtils.toMap(configMap)

            val clientInfo = ClientInfo.fromJson(clientJson)
            val config = MeasureConfig.fromJson(configJson)

            UiThreadUtil.runOnUiThread {
                Measure.init(context, measureConfig = config, clientInfo = clientInfo)
            }

            promise.resolve("Native Measure SDK initialized successfully")
        } catch (e: Exception) {
            promise.reject(ErrorCode.INIT_ERROR, "Failed to initialize Measure SDK", e)
        }
    }

    @ReactMethod
    fun start(promise: Promise) {
        Measure.start()
        promise.resolve("Measure SDK started successfully")
    }

    @ReactMethod
    fun stop(promise: Promise) {
        Measure.stop()
        promise.resolve("Measure SDK stopped successfully")
    }

    @ReactMethod
    fun trackEvent(
        data: ReadableMap,
        type: String,
        timestamp: Double,
        attributes: ReadableMap?,
        userDefinedAttrs: ReadableMap?,
        userTriggered: Boolean,
        sessionId: String?,
        threadName: String?,
        @Suppress("unused") attachments: ReadableArray?,
        promise: Promise
    ) {
        try {
            val dataMap = MapUtils.toMutableMap(data)
            val attributesMap =
                if (attributes != null) MapUtils.toMutableMap(attributes) else mutableMapOf()
            val userAttrs =
                userDefinedAttrs?.let { MapUtils.toAttributeValueMap(it) } ?: mutableMapOf()
            // TODO: parse attachments when they are supported in RN
            val attachmentsList = mutableListOf<MsrAttachment>()
            val tsLong = timestamp.toLong()

            Measure.internalTrackEvent(
                data = dataMap,
                type = type,
                timestamp = tsLong,
                attributes = attributesMap,
                userDefinedAttrs = userAttrs,
                attachments = attachmentsList,
                userTriggered = userTriggered,
                sessionId = sessionId,
                threadName = threadName
            )

            promise.resolve("Event tracked successfully")
        } catch (e: Exception) {
            promise.reject(ErrorCode.TRACK_EVENT_ERROR, "Failed to track event", e)
        }
    }

    @ReactMethod
    fun trackSpan(
        name: String,
        traceId: String,
        spanId: String,
        parentId: String?,
        startTime: Double,
        endTime: Double,
        duration: Double,
        status: Int,
        attributes: ReadableMap?,
        userDefinedAttrs: ReadableMap?,
        checkpoints: ReadableMap?,
        hasEnded: Boolean,
        isSampled: Boolean,
        promise: Promise
    ) {
        try {
            val attributesMap =
                if (attributes != null) MapUtils.toMutableMap(attributes) else mutableMapOf<String, Any?>()

            val userAttrs =
                userDefinedAttrs?.let { MapUtils.toAttributeValueMap(it) } ?: mutableMapOf<String, Any>()

            // val checkpointsMap =
            //     checkpoints?.let { MapUtils.toAttributeValueMap(it) } ?: mutableMapOf<String, Any>()

            val checkpointsMap = mutableMapOf<String, Long>()

            checkpoints?.let { nonNullCheckpoints ->
                val raw = MapUtils.toMap(nonNullCheckpoints)
                raw.forEach { (key, value) ->
                    val ts = when (value) {
                        is Double -> value.toLong()
                        is Int -> value.toLong()
                        is Long -> value
                        else -> System.currentTimeMillis()
                    }
                    checkpointsMap[key] = ts
                }
            }

            Measure.internalTrackSpan(
                name = name,
                traceId = traceId,
                spanId = spanId,
                parentId = parentId,
                startTime = startTime.toLong(),
                endTime = endTime.toLong(),
                duration = duration.toLong(),
                status = status,
                attributes = attributesMap,
                userDefinedAttrs = userAttrs,
                checkpoints = checkpointsMap,
                hasEnded = hasEnded,
                isSampled = isSampled
            )

            promise.resolve("Span tracked successfully")
        } catch (e: Exception) {
            promise.reject(ErrorCode.TRACK_EVENT_ERROR, "Failed to track span", e)
        }
    }
}