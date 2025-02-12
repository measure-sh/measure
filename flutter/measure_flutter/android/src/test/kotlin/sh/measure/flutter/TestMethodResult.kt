package sh.measure.flutter

import io.flutter.plugin.common.MethodChannel

/**
 * A test implementation of MethodChannel.Result that captures all interactions
 * and provides helper methods for assertions.
 */
class TestMethodResult : MethodChannel.Result {
    private sealed class ResultState {
        data class Success(val result: Any?) : ResultState()
        data class Error(
            val code: String,
            val message: String?,
            val details: Any?
        ) : ResultState()
        data object NotImplemented : ResultState()
        data object Initial : ResultState()
    }

    private var state: ResultState = ResultState.Initial

    override fun success(result: Any?) {
        require(state is ResultState.Initial) { "Result was already set: $state" }
        state = ResultState.Success(result)
    }

    override fun error(code: String, message: String?, details: Any?) {
        require(state is ResultState.Initial) { "Result was already set: $state" }
        state = ResultState.Error(code, message, details)
    }

    override fun notImplemented() {
        require(state is ResultState.Initial) { "Result was already set: $state" }
        state = ResultState.NotImplemented
    }

    // Assertion helpers
    fun assertSuccess() {
        check(state is ResultState.Success) { "Expected success but was $state" }
    }

    fun assertSuccess(expectedResult: Any?) {
        val success = checkNotNull(state as? ResultState.Success) { 
            "Expected success with $expectedResult but was $state" 
        }
        check(success.result == expectedResult) {
            "Expected success with $expectedResult but was ${success.result}"
        }
    }

    fun assertError(
        expectedCode: String? = null,
        expectedMessage: String? = null,
        expectedDetails: Any? = null
    ) {
        val error = checkNotNull(state as? ResultState.Error) { 
            "Expected error but was $state" 
        }
        
        expectedCode?.let { code ->
            check(error.code == code) { 
                "Expected error code $code but was ${error.code}" 
            }
        }
        expectedMessage?.let { message ->
            check(error.message == message) { 
                "Expected error message $message but was ${error.message}" 
            }
        }
        expectedDetails?.let { details ->
            check(error.details == details) { 
                "Expected error details $details but was ${error.details}" 
            }
        }
    }

    fun assertNotImplemented() {
        check(state is ResultState.NotImplemented) { 
            "Expected notImplemented but was $state" 
        }
    }

    fun assertNoResult() {
        check(state is ResultState.Initial) { 
            "Expected no result but was $state" 
        }
    }

    // Getters for detailed inspection if needed
    fun getSuccessResult(): Any? {
        return (state as? ResultState.Success)?.result
    }

    fun getErrorCode(): String? {
        return (state as? ResultState.Error)?.code
    }

    fun getErrorMessage(): String? {
        return (state as? ResultState.Error)?.message
    }

    fun getErrorDetails(): Any? {
        return (state as? ResultState.Error)?.details
    }
}