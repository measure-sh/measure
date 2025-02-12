package sh.measure.flutter

import android.util.Log
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.MethodChannel.MethodCallHandler
import sh.measure.android.Measure
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.attributes.BooleanAttr
import sh.measure.android.attributes.DoubleAttr
import sh.measure.android.attributes.FloatAttr
import sh.measure.android.attributes.IntAttr
import sh.measure.android.attributes.LongAttr
import sh.measure.android.attributes.StringAttr

class MeasurePlugin : FlutterPlugin, MethodCallHandler {
    private lateinit var channel: MethodChannel

    override fun onAttachedToEngine(flutterPluginBinding: FlutterPlugin.FlutterPluginBinding) {
        channel = MethodChannel(flutterPluginBinding.binaryMessenger, "measure_flutter")
        channel.setMethodCallHandler(this)
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        try {
            if (call.method == "trackCustomEvent") {
                val name = requireNotNull(call.argument<String>("name")) { "Name is required" }
                val timestamp =
                    requireNotNull(call.argument<Number>("timestamp")) { "Timestamp is required" }
                val attributes =
                    requireNotNull(call.argument<Map<String, Any>>("attributes")) { "Attributes is required" }
                val convertedAttributes = attributes.mapValues { (_, value) ->
                    when (value) {
                        is String -> StringAttr(value)
                        is Boolean -> BooleanAttr(value)
                        is Int -> IntAttr(value)
                        is Long -> LongAttr(value)
                        is Float -> FloatAttr(value)
                        is Double -> DoubleAttr(value)
                        else -> StringAttr("WRONG_PARSE")
                    }
                }
                Log.i("FUCK", convertedAttributes.values.joinToString(","))
                processCustomEvent(name, timestamp.toLong(), convertedAttributes)
                result.success("")
            } else {
                result.notImplemented()
            }
        } catch (e: Exception) {
            result.error("100", e.message, "Error calling ${call.method}")
        }
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
