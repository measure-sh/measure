package sh.measure.flutter

import android.os.Looper
import android.util.Log
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.MethodChannel.MethodCallHandler
import sh.measure.android.Measure
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.exceptions.ExceptionUnit
import sh.measure.android.exceptions.Frame

class MeasurePlugin : FlutterPlugin, MethodCallHandler {
    private lateinit var channel: MethodChannel

    override fun onAttachedToEngine(flutterPluginBinding: FlutterPlugin.FlutterPluginBinding) {
        channel = MethodChannel(flutterPluginBinding.binaryMessenger, "measure_flutter")
        channel.setMethodCallHandler(this)
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        try {
            when (call.method) {
                MethodConstants.FUNCTION_TRACK_CUSTOM_EVENT -> handleTrackCustomEvent(call, result)
                MethodConstants.FUNCTION_TRACK_EXCEPTION -> handleTrackException(call, result)
                MethodConstants.FUNCTION_NATIVE_CRASH -> triggerNativeCrash()
                else -> result.notImplemented()
            }
        } catch (e: MethodArgumentException) {
            result.error(e.code, e.message, e.details)
        } catch (e: Exception) {
            result.error(
                MethodConstants.ERROR_UNKNOWN,
                "Unexpected method channel error when calling ${call.method}",
                "${e.message}"
            )
            Log.e("Measure", "Unexpected method channel error when calling ${call.method}", e)
        }
    }

    private fun handleTrackCustomEvent(call: MethodCall, result: MethodChannel.Result) {
        val reader = MethodCallReader(call)
        val name = reader.requireArg<String>(MethodConstants.ARG_NAME)
        val timestamp = reader.requireArg<Long>(MethodConstants.ARG_TIMESTAMP)
        val rawAttributes = reader.requireArg<Map<String, Any>>(MethodConstants.ARG_ATTRIBUTES)
        val convertedAttributes = AttributeConverter.convertAttributes(rawAttributes)
        processCustomEvent(name, timestamp, convertedAttributes)
        result.success(null)
    }

    @Suppress("UNCHECKED_CAST")
    private fun handleTrackException(call: MethodCall, result: MethodChannel.Result) {
        val reader = MethodCallReader(call)
        val serializedData = reader.requireArg<Map<String, Any>>(MethodConstants.ARG_EXCEPTION_DATA)
        val timestamp = reader.requireArg<Long>(MethodConstants.ARG_TIMESTAMP)

        // Extract exception data from serializedData
        val exceptions = (serializedData["exceptions"] as List<*>).map { exceptionMap ->
            val exception = exceptionMap as Map<String, Any>
            val frames = (exception["frames"] as List<*>).map { frameMap ->
                val frame = frameMap as Map<String, Any>
                Frame(
                    class_name = frame["class_name"] as? String,
                    method_name = frame["method_name"] as? String,
                    file_name = frame["file_name"] as? String,
                    line_num = (frame["line_num"] as? Number)?.toInt(),
                    col_num = (frame["col_num"] as? Number)?.toInt(),
                    module_name = frame["module_name"] as? String,
                    binary_addr = frame["binary_addr"] as? String,
                    instruction_addr = frame["instruction_addr"] as? String
                )
            }

            ExceptionUnit(
                type = exception["type"] as? String,
                message = exception["message"] as? String,
                frames = frames
            )
        }

        val handled = serializedData["handled"] as Boolean

        val exceptionData = ExceptionData(
            exceptions = exceptions,
            handled = handled,
            threads = listOf(),
            foreground = true,
        )

        // Process the exception data
        Measure.internalTrackException(exceptionData, timestamp)
        result.success(null)
    }

    private fun triggerNativeCrash() {
        val exception = RuntimeException("Native app crashed")
        val mainThread = Looper.getMainLooper().thread
        mainThread.uncaughtExceptionHandler?.uncaughtException(mainThread, exception)
        mainThread.join();
    }

    private fun processCustomEvent(
        name: String, timestamp: Long, attributes: Map<String, AttributeValue>
    ) {
        Measure.trackEvent(name = name, timestamp = timestamp, attributes = attributes)
    }

    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        channel.setMethodCallHandler(null)
    }
}
