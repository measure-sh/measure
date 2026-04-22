package sh.measure.android.exceptions

internal object ExceptionFactory {
    /**
     * Creates [ExceptionData] from a [Throwable].
     *
     * @param throwable The [Throwable] to create the [ExceptionData] from.
     * @param handled Whether the exception was handled or not.
     */
    fun createMeasureException(
        throwable: Throwable,
        handled: Boolean,
        thread: Thread,
        foreground: Boolean,
        framework: String? = ExceptionFramework.JVM,
    ): ExceptionData {
        val exceptions = mutableListOf<ExceptionUnit>()
        var error: Throwable? = throwable
        while (error != null) {
            val exception = ExceptionUnit(
                type = error.javaClass.name,
                message = error.message,
                frames = error.stackTrace.trimStackTrace().map {
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

        // Get stack trace for all threads.
        val allStackTraces = Thread.getAllStackTraces()
        val threads = mutableListOf<MeasureThread>()
        var count = 0
        for ((t, stackTrace) in allStackTraces) {
            if (t.name != thread.name && stackTrace.isNotEmpty() && count <= MAX_THREADS_IN_EXCEPTION) {
                val measureThread = MeasureThread(
                    name = t.name,
                    frames = stackTrace.trimStackTrace().map { stackTraceElement ->
                        Frame(
                            class_name = stackTraceElement.className,
                            method_name = stackTraceElement.methodName,
                            file_name = stackTraceElement.fileName,
                            line_num = stackTraceElement.lineNumber,
                        )
                    },
                )
                threads.add(measureThread)
            }
            count++
        }
        return ExceptionData(
            exceptions,
            threads = threads,
            handled = handled,
            foreground = foreground,
            framework = framework,
        )
    }
}
