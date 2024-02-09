package sh.measure.android.tracing

import android.os.Build
import android.os.Trace
import androidx.annotation.RequiresApi

/**
 * A simple wrapper over [Trace] to allow enabling & disabling tracing.
 */
internal object InternalTrace {
    @Volatile
    var enabled = true

    fun beginSection(name: String) {
        if (!enabled) return
        Trace.beginSection(name)
    }

    fun endSection() {
        if (!enabled) return
        Trace.endSection()
    }

    @RequiresApi(Build.VERSION_CODES.Q)
    fun beginAsyncSection(name: String, cookie: Int) {
        if (!enabled) return
        Trace.beginAsyncSection(name, cookie)
    }

    @RequiresApi(Build.VERSION_CODES.Q)
    fun endAsyncSection(name: String, cookie: Int) {
        if (!enabled) return
        Trace.endAsyncSection(name, cookie)
    }
}
