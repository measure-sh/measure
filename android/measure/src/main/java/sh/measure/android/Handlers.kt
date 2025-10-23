package sh.measure.android

import android.os.Handler
import android.os.Looper
import android.os.Message
import androidx.core.os.MessageCompat

internal fun isMainThread(): Boolean = Looper.myLooper() == Looper.getMainLooper()

internal val mainHandler by lazy {
    Handler(Looper.getMainLooper())
}

// Thx @chet and @jreck
// https://cs.android.com/androidx/platform/frameworks/support/+/androidx-main:metrics/metrics-performance/src/main/java/androidx/metrics/performance/JankStatsApi16Impl.kt;l=66;drc=523d7a11e46390281ed3f77893671730cd6edb98
internal fun Handler.postAtFrontOfQueueAsync(callback: () -> Unit) {
    sendMessageAtFrontOfQueue(
        Message.obtain(this, callback).apply {
            MessageCompat.setAsynchronous(this, true)
        },
    )
}
