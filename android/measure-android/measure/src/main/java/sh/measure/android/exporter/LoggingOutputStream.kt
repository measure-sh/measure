package sh.measure.android.exporter

import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import java.io.OutputStream

internal class LoggingOutputStream(
    private val outputStream: OutputStream,
    private val logger: Logger,
) : OutputStream() {
    // Divide the logs in chunks as the output can be large, Android logcat truncates
    // strings which are longer than 500.
    private val chunkSize: Int = 500
    private val buffer = StringBuilder()

    override fun write(b: Int) {
        outputStream.write(b)
        buffer.append(b.toChar())
    }

    override fun write(b: ByteArray, off: Int, len: Int) {
        outputStream.write(b, off, len)
        buffer.append(String(b, off, len))
    }

    override fun flush() {
        outputStream.flush()
        if (buffer.isNotEmpty()) {
            val log = buffer.toString()
            log.chunked(chunkSize).forEach {
                logger.log(LogLevel.Debug, it)
            }
            buffer.clear()
        }
    }

    override fun close() {
        buffer.clear()
        outputStream.close()
    }
}
