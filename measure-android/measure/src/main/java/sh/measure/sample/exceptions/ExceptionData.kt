package sh.measure.sample.exceptions

import kotlinx.serialization.Serializable

/**
 * Factory for creating [ExceptionData].
 */
internal object ExceptionFactory {
    /**
     * Creates [ExceptionData] from a [Throwable].
     *
     * @param throwable The [Throwable] to create the [ExceptionData] from.
     * @param handled Whether the exception was handled or not.
     */
    fun createExceptionData(throwable: Throwable, handled: Boolean): ExceptionData {
        val exceptions = mutableListOf<MeasureException>()
        var error: Throwable? = throwable
        while (error != null) {
            val exception = MeasureException(
                type = error.javaClass.name,
                message = error.message,
                stackframes = error.stackTrace.map {
                    Stackframe(
                        class_name = it.className,
                        method_name = it.methodName,
                        file_name = it.fileName,
                        line_number = it.lineNumber,
                    )
                },
            )
            exceptions.add(exception)
            error = error.cause
        }
        return ExceptionData(exceptions, handled)
    }
}

/**
 * Represents an exception in Measure. This is used to track handled and unhandled exceptions.
 */
@Serializable
internal data class ExceptionData(
    /**
     * A list of exceptions that were thrown. Multiple exceptions represent "chained" exceptions.
     */
    val exceptions: List<MeasureException>,

    /**
     * Whether the exception was handled or not.
     */
    val handled: Boolean
)

/**
 * Represents a stacktrace in Measure.
 */
@Serializable
internal data class MeasureException(
    /**
     * The fully qualified type of the exception. For example, java.lang.Exception.
     */
    val type: String,

    /**
     * A message which describes the exception.
     */
    val message: String? = null,

    /**
     * A list of stack frames for the exception.
     */
    val stackframes: List<Stackframe>
)

/**
 * Represents a stackframe in Measure.
 */
@Serializable
internal data class Stackframe(
    /**
     * The fully qualified class name.
     */
    val class_name: String? = null,

    /**
     * The name of the method in the stacktrace.
     */
    val method_name: String? = null,

    /**
     * The name of the source file in the stacktrace.
     */
    val file_name: String? = null,

    /**
     * The line number of the method called.
     */
    val line_number: Int? = null
)
