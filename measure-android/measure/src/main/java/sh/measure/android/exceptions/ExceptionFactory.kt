package sh.measure.android.exceptions

internal object ExceptionFactory {
    /**
     * Creates [MeasureException] from a [Throwable].
     *
     * @param throwable The [Throwable] to create the [MeasureException] from.
     * @param handled Whether the exception was handled or not.
     */
    fun createMeasureException(
        throwable: Throwable, handled: Boolean, timestamp: Long, thread: Thread
    ): MeasureException {
        val exceptions = mutableListOf<ExceptionUnit>()
        var error: Throwable? = throwable
        while (error != null) {
            val exception = ExceptionUnit(
                type = error.javaClass.name,
                message = error.message,
                frames = error.stackTrace.map {
                    Frame(
                        class_name = it.className,
                        method_name = it.methodName,
                        file_name = it.fileName,
                        line_num = it.lineNumber,
                    )
                },
            )
            exceptions.add(exception)
            error = error.cause
        }

        val threads = Thread.getAllStackTraces()
            .filter { it.key.name != thread.name && it.value.isNotEmpty() }.map {
                MeasureThread(name = it.key.name, frames = it.value.map { stackTraceElement ->
                    Frame(
                        class_name = stackTraceElement.className,
                        method_name = stackTraceElement.methodName,
                        file_name = stackTraceElement.fileName,
                        line_num = stackTraceElement.lineNumber,
                    )
                })
            }
        return MeasureException(timestamp, thread.name, exceptions, threads, handled)
    }
}
