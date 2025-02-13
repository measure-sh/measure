package sh.measure.flutter

import io.flutter.plugin.common.MethodCall

class MethodCallReader(private val call: MethodCall) {
    fun <T> requireArg(name: String): T {
        return call.argument<T>(name) 
            ?: throw MethodArgumentException(
                code = MethodConstants.ERROR_ARGUMENT_MISSING,
                message = "Required argument '$name' was not provided",
                details = "Method: ${call.method}"
            )
    }
    
    fun <T> optionalArg(name: String): T? {
        return call.argument<T>(name)
    }
}