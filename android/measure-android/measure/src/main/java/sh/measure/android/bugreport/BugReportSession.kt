package sh.measure.android.bugreport

import android.graphics.Bitmap
import sh.measure.android.attributes.AttributeValue
import java.util.concurrent.Future
import java.util.concurrent.TimeUnit

internal class EncodedScreenshot(val name: String, val path: String)

internal class BugReportSession(
    val attributes: MutableMap<String, AttributeValue>,
    val screenshot: ScreenshotSlot?,
)

internal class ScreenshotSlot(preview: Bitmap) {
    private enum class State { PREPARING, ENCODED, FAILED, DISCARDED, CONSUMED }

    var preview: Bitmap? = preview
        private set

    var encoded: EncodedScreenshot? = null
        private set

    @Volatile
    var encodeFuture: Future<EncodedScreenshot?>? = null

    @Volatile
    private var encodeResult: EncodedScreenshot? = null

    private var state: State = State.PREPARING
    private var listener: ((EncodedScreenshot?) -> Unit)? = null

    fun isPreparing(): Boolean = state == State.PREPARING

    fun setListener(listener: ((EncodedScreenshot?) -> Unit)?) {
        this.listener = listener
    }

    fun deliver(encoded: EncodedScreenshot?) {
        if (state != State.PREPARING) {
            return
        }
        state = if (encoded != null) State.ENCODED else State.FAILED
        this.encoded = encoded
        val listener = this.listener
        this.listener = null
        listener?.invoke(encoded)
    }

    fun discard(): Boolean {
        if (state == State.DISCARDED || state == State.CONSUMED) {
            return false
        }
        val wasPreparing = state == State.PREPARING
        state = State.DISCARDED
        preview = null
        encoded = null
        encodeFuture?.cancel(false)
        val listener = this.listener
        this.listener = null
        if (wasPreparing) {
            listener?.invoke(null)
        }
        return true
    }

    fun markConsumed() {
        if (state == State.DISCARDED) {
            return
        }
        state = State.CONSUMED
        preview = null
        listener = null
    }

    fun onEncoded(encoded: EncodedScreenshot?) {
        encodeResult = encoded
    }

    fun awaitEncoded(): EncodedScreenshot? = try {
        encodeFuture?.get(AWAIT_ENCODE_TIMEOUT_MS, TimeUnit.MILLISECONDS) ?: encodeResult
    } catch (_: Exception) {
        encodeResult
    }

    private companion object {
        const val AWAIT_ENCODE_TIMEOUT_MS = 2_000L
    }
}
