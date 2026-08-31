package sh.measure.android.bugreport

import android.graphics.Bitmap
import java.util.concurrent.Future
import java.util.concurrent.TimeUnit

/**
 * A screenshot shown in the bug report screen while its full size bitmap is still being encoded.
 */
internal class PendingScreenshot(preview: Bitmap) {
    private enum class State { ENCODING, ENCODED, DISCARDED }

    var preview: Bitmap? = preview
        private set

    @Volatile
    var encoding: Future<ParcelableAttachment?>? = null

    @Volatile
    private var encoded: ParcelableAttachment? = null

    private var state = State.ENCODING
    private var listener: ((ParcelableAttachment?) -> Unit)? = null

    fun isEncoding(): Boolean = state == State.ENCODING

    fun setListener(listener: ((ParcelableAttachment?) -> Unit)?) {
        this.listener = listener
    }

    fun finishEncoding(attachment: ParcelableAttachment?) {
        if (state != State.ENCODING) {
            return
        }
        state = State.ENCODED
        val listener = this.listener
        this.listener = null
        listener?.invoke(attachment)
    }

    fun discard() {
        if (state == State.DISCARDED) {
            return
        }
        val wasEncoding = state == State.ENCODING
        state = State.DISCARDED
        preview = null
        val listener = this.listener
        this.listener = null
        if (wasEncoding) {
            listener?.invoke(null)
        }
    }

    fun recordEncoded(attachment: ParcelableAttachment?) {
        encoded = attachment
    }

    /**
     * Blocks until the encode finishes. The encode is always queued before the task that tracks
     * the report, so on the single threaded IO executor it has already run by the time this is
     * called.
     */
    fun awaitEncoded(): ParcelableAttachment? = try {
        encoding?.get(AWAIT_ENCODE_TIMEOUT_MS, TimeUnit.MILLISECONDS) ?: encoded
    } catch (_: Exception) {
        encoded
    }

    private companion object {
        const val AWAIT_ENCODE_TIMEOUT_MS = 2_000L
    }
}
