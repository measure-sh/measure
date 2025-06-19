package sh.measure.flutter

import android.content.Context
import android.os.Looper
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.MethodChannel.MethodCallHandler
import sh.measure.android.Measure
import sh.measure.android.MsrAttachment
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.config.ClientInfo
import sh.measure.android.config.MeasureConfig

class MeasurePlugin : FlutterPlugin, MethodCallHandler {
    private lateinit var channel: MethodChannel
    private var applicationContext: Context? = null

    override fun onAttachedToEngine(flutterPluginBinding: FlutterPlugin.FlutterPluginBinding) {
        channel = MethodChannel(flutterPluginBinding.binaryMessenger, "measure_flutter")
        channel.setMethodCallHandler(this)
        applicationContext = flutterPluginBinding.applicationContext
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        try {
            when (call.method) {
                MethodConstants.FUNCTION_TRACK_EVENT -> handleTrackEvent(call, result)
                MethodConstants.FUNCTION_TRIGGER_NATIVE_CRASH -> triggerNativeCrash()
                MethodConstants.FUNCTION_INITIALIZE_NATIVE_SDK -> initializeNativeSdk(call, result)
                MethodConstants.FUNCTION_START -> start(call, result)
                MethodConstants.FUNCTION_STOP -> stop(call, result)
                MethodConstants.FUNCTION_GET_SESSION_ID -> getSessionId(result)
                MethodConstants.FUNCTION_TRACK_SPAN -> trackSpan(call, result)
                else -> result.notImplemented()
            }
        } catch (e: MethodArgumentException) {
            result.error(e.code, e.message, e.details)
        } catch (e: Exception) {
            result.error(
                ErrorCode.ERROR_UNKNOWN,
                "Unexpected method channel error when calling ${call.method}",
                "${e.message}"
            )
        }
    }

    private fun getSessionId(result: MethodChannel.Result) {
        val sessionId = Measure.getSessionId()
        return result.success(sessionId)
    }

    private fun triggerNativeCrash() {
        val exception = RuntimeException("Native app crashed")
        val mainThread = Looper.getMainLooper().thread
        mainThread.uncaughtExceptionHandler?.uncaughtException(mainThread, exception)
        mainThread.join()
    }

    private fun handleTrackEvent(call: MethodCall, result: MethodChannel.Result) {
        val reader = MethodCallReader(call)
        val eventType = reader.requireArg<String>(MethodConstants.ARG_EVENT_TYPE)
        val eventData = reader.requireArg<MutableMap<String, Any?>>(MethodConstants.ARG_EVENT_DATA)
        val timestamp = reader.requireArg<Long>(MethodConstants.ARG_TIMESTAMP)
        val rawAttributes =
            reader.requireArg<Map<String, Any>>(MethodConstants.ARG_USER_DEFINED_ATTRS)
        val convertedAttributes = AttributeConverter.convertAttributes(rawAttributes)
        val userTriggered = reader.requireArg<Boolean>(MethodConstants.ARG_USER_TRIGGERED)
        val threadName = reader.optionalArg<String>(MethodConstants.ARG_THREAD_NAME)
        trackEvent(
            data = eventData,
            type = eventType,
            timestamp = timestamp,
            userDefinedAttrs = convertedAttributes,
            userTriggered = userTriggered,
            threadName = threadName,
        )
        result.success(null)
    }

    private fun trackEvent(
        data: MutableMap<String, Any?>,
        type: String,
        timestamp: Long,
        userDefinedAttrs: MutableMap<String, AttributeValue> = mutableMapOf<String, AttributeValue>(),
        attachments: MutableList<MsrAttachment> = mutableListOf<MsrAttachment>(),
        userTriggered: Boolean,
        sessionId: String? = null,
        threadName: String? = null,
    ) {
        Measure.internalTrackEvent(
            data = data,
            type = type,
            timestamp = timestamp,
            userDefinedAttrs = userDefinedAttrs,
            attachments = attachments,
            userTriggered = userTriggered,
            sessionId = sessionId,
            threadName = threadName,
        )
    }

    private fun initializeNativeSdk(call: MethodCall, result: MethodChannel.Result) {
        val context = applicationContext
        if (context == null) {
            result.error(
                ErrorCode.ERROR_UNKNOWN,
                "Unexpected method channel error when calling ${call.method}",
                "Failed to initialize native SDK. Application context is null."
            )
            return
        }
        val reader = MethodCallReader(call)
        val configJson = reader.requireArg<Map<String, Any?>>(MethodConstants.ARG_CONFIG)
        val clientInfoJson = reader.requireArg<Map<String, String>>(MethodConstants.ARG_CLIENT_INFO)
        val config = MeasureConfig.fromJson(configJson)
        val clientInfo = ClientInfo.fromJson(clientInfoJson)
        Measure.init(context, measureConfig = config, clientInfo = clientInfo)
        result.success(null)
    }

    private fun trackSpan(call: MethodCall, result: MethodChannel.Result) {
        val reader = MethodCallReader(call)
        val name: String = reader.requireArg(MethodConstants.ARG_SPAN_NAME)
        val traceId: String = reader.requireArg(MethodConstants.ARG_SPAN_TRACE_ID)
        val spanId: String = reader.requireArg(MethodConstants.ARG_SPAN_SPAN_ID)
        val parentId: String? = reader.optionalArg(MethodConstants.ARG_SPAN_PARENT_ID)
        val startTime: Long = reader.requireArg(MethodConstants.ARG_SPAN_START_TIME)
        val endTime: Long = reader.requireArg(MethodConstants.ARG_SPAN_END_TIME)
        val duration: Long = reader.requireArg(MethodConstants.ARG_SPAN_DURATION)
        val status: Int = reader.requireArg(MethodConstants.ARG_SPAN_STATUS)
        val attributes: MutableMap<String, Any?>? = reader.optionalArg(MethodConstants.ARG_SPAN_ATTRIBUTES)
        val userDefinedAttrs: Map<String, Any> = reader.requireArg(MethodConstants.ARG_SPAN_USER_DEFINED_ATTRS)
        val checkpoints: Map<String, Long> = reader.requireArg(MethodConstants.ARG_SPAN_CHECKPOINTS)
        val hasEnded: Boolean = reader.requireArg(MethodConstants.ARG_SPAN_HAS_ENDED)
        val isSampled: Boolean = reader.requireArg(MethodConstants.ARG_SPAN_IS_SAMPLED)
        Measure.internalTrackSpan(
            name = name,
            traceId = traceId,
            spanId = spanId,
            parentId = parentId,
            startTime = startTime,
            endTime = endTime,
            duration = duration,
            status = status,
            attributes = attributes ?: mutableMapOf(),
            userDefinedAttrs = userDefinedAttrs,
            checkpoints = checkpoints,
            hasEnded = hasEnded,
            isSampled = isSampled
        )
        result.success(null)
    }

    private fun start(call: MethodCall, result: MethodChannel.Result) {
        Measure.start()
        result.success(null)
    }

    private fun stop(call: MethodCall, result: MethodChannel.Result) {
        Measure.stop()
        result.success(null)
    }

    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        channel.setMethodCallHandler(null)
        applicationContext = null
    }
}
