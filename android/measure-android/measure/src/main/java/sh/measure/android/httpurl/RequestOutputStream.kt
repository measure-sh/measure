package sh.measure.android.httpurl

import okio.Buffer
import okio.BufferedSink
import okio.buffer
import okio.sink
import java.io.OutputStream

/**
 * Tees writes into an in-memory [Buffer] (capped at [MAX_BODY_SIZE_BYTES]) so the
 * request body can be reported via [HttpUrlConnectionRecorder.onRequestBodyComplete]
 * when the stream is closed.
 */
internal class RequestOutputStream(
    delegate: OutputStream,
    private val recorder: HttpUrlConnectionRecorder,
) : OutputStream() {
    private val sink: BufferedSink = delegate.sink().buffer()
    private val capture = Buffer()
    private var truncated = false
    private var closed = false

    override fun write(b: Int) {
        sink.writeByte(b)
        captureByte(b)
    }

    override fun write(b: ByteArray, off: Int, len: Int) {
        sink.write(b, off, len)
        captureBytes(b, off, len)
    }

    override fun flush() {
        sink.flush()
    }

    override fun close() {
        if (closed) return
        closed = true
        try {
            sink.close()
        } finally {
            recorder.onRequestBodyComplete(capture.readByteArray(), truncated)
        }
    }

    private fun captureByte(b: Int) {
        if (truncated) return
        if (capture.size >= MAX_BODY_SIZE_BYTES) {
            truncated = true
            return
        }
        capture.writeByte(b)
    }

    private fun captureBytes(b: ByteArray, off: Int, len: Int) {
        if (truncated) return
        val remaining = MAX_BODY_SIZE_BYTES - capture.size
        if (remaining <= 0) {
            truncated = true
            return
        }
        val toCopy = minOf(len.toLong(), remaining).toInt()
        capture.write(b, off, toCopy)
        if (toCopy < len) truncated = true
    }
}
