package sh.measure.flutter

import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.MethodChannel.MethodCallHandler
import sh.measure.android.Measure
import sh.measure.android.attributes.AttributeValue

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

    private fun processCustomEvent(
        name: String, timestamp: Long, attributes: Map<String, AttributeValue>
    ) {
        Measure.trackEvent(name = name, timestamp = timestamp, attributes = attributes)
    }

    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        channel.setMethodCallHandler(null)
    }
}
