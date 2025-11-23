@file:Suppress("unused")

package sh.measure.rn

import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.UiThreadUtil
import sh.measure.android.Measure
import sh.measure.android.MsrAttachment
import sh.measure.android.bugreport.MsrShakeListener
import sh.measure.android.config.ClientInfo
import sh.measure.android.config.MeasureConfig
import java.io.File

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
                try {
                    Measure.init(context, measureConfig = config, clientInfo = clientInfo)
                    promise.resolve("Native Measure SDK initialized successfully")
                } catch (e: Exception) {
                    promise.reject(ErrorCode.INIT_ERROR, e)
                }
            }

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

    @ReactMethod
    fun setUserId(userId: String, promise: Promise) {
        try {
            Measure.setUserId(userId)
            promise.resolve("User ID set successfully")
        } catch (e: Exception) {
            promise.reject("SET_USER_ID_ERROR", "Failed to set userId", e)
        }
    }

    @ReactMethod
    fun clearUserId(promise: Promise) {
        try {
            Measure.clearUserId()
            promise.resolve("User ID cleared successfully")
        } catch (e: Exception) {
            promise.reject("CLEAR_USER_ID_ERROR", "Failed to clear userId", e)
        }
    }

    @ReactMethod
    fun trackHttpEvent(
        url: String,
        method: String,
        startTime: Double,
        endTime: Double,
        statusCode: Int?,
        error: String?,
        requestHeaders: ReadableMap?,
        responseHeaders: ReadableMap?,
        requestBody: String?,
        responseBody: String?,
        client: String,
        promise: Promise
    ) {
        val errObj = error?.let { Exception(it) }

        Measure.trackHttpEvent(
            url,
            method,
            startTime.toLong(),
            endTime.toLong(),
            statusCode,
            errObj,
            requestHeaders?.toHashMap()?.mapValues { it.value.toString() }?.toMutableMap(),
            responseHeaders?.toHashMap()?.mapValues { it.value.toString() }?.toMutableMap(),
            requestBody,
            responseBody,
            client
        )

        promise.resolve("ok")
    }
    
    fun launchBugReport(
        takeScreenshot: Boolean,
        bugReportConfig: ReadableMap?,
        attributes: ReadableMap?,
        promise: Promise
    ) {
        try {
            val userAttrs =
                attributes?.let { MapUtils.toAttributeValueMap(it) } ?: mutableMapOf()
            Measure.launchBugReportActivity(takeScreenshot, userAttrs)

            promise.resolve("Bug report launched successfully")
        } catch (e: Exception) {
            promise.reject("LAUNCH_BUG_REPORT_FAILED", e)
        }
    }

    @ReactMethod
    fun setShakeListener(enable: Boolean) {
        val shakeEmitter = reactApplicationContext
            .getNativeModule(MeasureOnShakeModule::class.java)

        if (enable) {
            Measure.setShakeListener(object : MsrShakeListener {
                override fun onShake() {
                    shakeEmitter?.triggerShakeEvent()
                }
            })
        } else {
            Measure.setShakeListener(null)
        }
    }

   @ReactMethod
    fun captureScreenshot(promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No current activity available")
            return
        }

        UiThreadUtil.runOnUiThread {
            try {
                Measure.captureScreenshot(
                    activity,
                    onComplete = { attachment ->

                        try {
                            val map = Arguments.createMap().apply {
                                putString("id", attachment.name) // or generate your own if needed
                                putString("name", attachment.name)
                                putString("type", attachment.type)

                                // If Android returns path
                                attachment.path?.let { filePath ->
                                    putString("path", filePath)

                                    // Add size
                                    val file = File(filePath)
                                    if (file.exists()) {
                                        putInt("size", file.length().toInt())
                                    }
                                }

                                // If Android returns bytes instead
                                attachment.bytes?.let { bytes ->
                                    val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
                                    putString("bytes", base64)
                                    putInt("size", bytes.size)
                                }
                            }

                            promise.resolve(map)
                        } catch (e: Exception) {
                            promise.reject("MAP_ERROR", "Failed building result map", e)
                        }
                    },
                    onError = {
                        promise.reject("CAPTURE_FAIL", "Failed to capture screenshot")
                    }
                )
            } catch (e: Exception) {
                promise.reject("SCREENSHOT_CAPTURE_FAILED", e)
            }
        }
    }

    @ReactMethod
    fun trackBugReport(
        description: String,
        attachments: ReadableArray?,
        attributes: ReadableMap?,
        promise: Promise
    ) {
        try {
            val attrs =
                attributes?.let { MapUtils.toAttributeValueMap(it) } ?: mutableMapOf()

            val msrAttachments = getMsrAttachments(attachments)

            Measure.trackBugReport(
                description,
                msrAttachments,
                attrs
            )

            promise.resolve("Bug report tracked successfully")
        } catch (e: Exception) {
            promise.reject("TRACK_BUG_REPORT_FAILED", e)
        }
    }

    internal fun getMsrAttachments(attachments: ReadableArray?): List<MsrAttachment> {
        if (attachments == null || attachments.size() == 0) return emptyList()

        val list = mutableListOf<MsrAttachment>()

        for (i in 0 until attachments.size()) {
            val map = attachments.getMap(i) ?: continue

            val name = map.getString("name") ?: continue
            val type = map.getString("type") ?: continue
            val path = map.getString("path")

            list.add(
                MsrAttachment(
                    name = name,
                    path = path,
                    type = type,
                )
            )
        }

        return list
    }
}