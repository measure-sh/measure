package sh.measure.android.httpurl

import okio.Buffer
import okio.BufferedSource
import okio.buffer
import okio.source
import java.io.InputStream

/**
 * Tees reads into an in-memory [Buffer] (capped at [MAX_BODY_SIZE_BYTES]). When the
 * stream returns EOF or is closed, reports the captured response body back to the
 * recorder and finalises the event.
 */
internal class ResponseInputStream(
    delegate: InputStream,
    private val recorder: HttpUrlConnectionRecorder,
) : InputStream() {
    private val source: BufferedSource = delegate.source().buffer()
    private val capture = Buffer()
    private var truncated = false
    private var finished = false
    private var closed = false

    override fun read(): Int {
        if (source.exhausted()) {
            finishOnce()
            return -1
        }
        val b = source.readByte().toInt() and 0xff
        captureByte(b)
        return b
    }

    override fun read(b: ByteArray, off: Int, len: Int): Int {
        val n = source.read(b, off, len)
        if (n == -1) {
            finishOnce()
        } else if (n > 0) {
            captureBytes(b, off, n)
        }
        return n
    }

    // Bytes already pulled into okio's buffer are guaranteed non-blocking;
    // this is a legal lower bound per the InputStream contract.
    override fun available(): Int = source.buffer.size.toInt()

    override fun close() {
        if (closed) return
        closed = true
        try {
            source.close()
        } finally {
            finishOnce()
        }
    }

    private fun finishOnce() {
        if (finished) return
        finished = true
        recorder.onResponseBodyComplete(capture.readByteArray(), truncated)
        recorder.finalizeAndTrack()
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
