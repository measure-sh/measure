package sh.measure.android.logger

import okio.BufferedSink
import okio.buffer
import okio.sink
import sh.measure.android.executors.MeasureExecutorService
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * Writes SDK debug logs to a file. Logs are buffered in memory and flushed to disk every 3 seconds
 * on the IO executor thread. The file sink is kept open for the lifetime of the writer.
 *
 * Thread safety: [writeLog] can be called from any thread. The buffer is guarded by [lock].
 * All file I/O (including [sink] access) runs exclusively on the single-threaded [ioExecutor].
 */
internal class SdkDebugLogWriter(
    private val logsDir: File,
    private val sdkVersion: String,
    private val fileName: String,
    private val timestamp: String,
    private val ioExecutor: MeasureExecutorService,
) {
    private val buffer = mutableListOf<LogEntry>()
    private val lock = Any()

    // Only accessed from ioExecutor thread
    private var sink: BufferedSink? = null

    fun start() {
        ioExecutor.submit {
            try {
                val file = File(logsDir, fileName)
                sink = file.sink().buffer()
                sink?.writeUtf8("$sdkVersion $timestamp\n")?.flush()
            } catch (_: Exception) {
                // No-op
            }
        }
        ioExecutor.scheduleAtFixedRate(
            { flush() },
            initialDelay = 3000L,
            delayMillis = 3000L,
            delayUnit = TimeUnit.MILLISECONDS,
        )
    }

    fun writeLog(level: LogLevel, message: String, throwable: Throwable?) {
        synchronized(lock) {
            buffer.add(LogEntry(level, message, throwable))
        }
    }

    private fun flush() {
        val entries: List<LogEntry>
        synchronized(lock) {
            if (buffer.isEmpty()) return
            entries = buffer.toList()
            buffer.clear()
        }
        try {
            val s = sink ?: return
            entries.forEach { entry ->
                s.writeUtf8("${entry.level.name} ${entry.message}")
                if (entry.throwable != null) {
                    s.writeUtf8(" ${entry.throwable.stackTraceToString()}")
                }
                s.writeUtf8("\n")
            }
            s.flush()
        } catch (_: Exception) {
            // No-op
        }
    }

    private data class LogEntry(
        val level: LogLevel,
        val message: String,
        val throwable: Throwable?,
    )
}
