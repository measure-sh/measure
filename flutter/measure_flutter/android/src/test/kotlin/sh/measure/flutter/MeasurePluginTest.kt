package sh.measure.flutter

import io.flutter.plugin.common.MethodCall
import kotlin.test.Test

internal class MeasurePluginTest {
    @Test
    fun onMethodCall_trackCustomEvent_succeedsWithExpectedArguments() {
        val plugin = MeasurePlugin()
        val eventName = "test_event"
        val timestamp = 98765432767L
        val attributes = mapOf(
            "string_key" to "value",
            "number_key" to 123,
            "boolean_key" to true,
            "double_key" to 3.14,
        )
        val result = TestMethodResult()
        val call = MethodCall(
            MethodConstants.FUNCTION_TRACK_CUSTOM_EVENT, mapOf(
                MethodConstants.ARG_NAME to eventName,
                MethodConstants.ARG_TIMESTAMP to timestamp,
                MethodConstants.ARG_ATTRIBUTES to attributes
            )
        )

        // When
        plugin.onMethodCall(call, result)

        // Then
        result.assertSuccess(null)
    }
}
