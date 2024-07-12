package sh.measure.android.tracing

import android.os.Build
import android.os.Trace
import androidx.annotation.ChecksSdkIntAtLeast
import sh.measure.android.tracing.InternalTrace.MAX_LABEL_LENGTH

/**
 * A simple wrapper over [Trace] to allow tracing of code blocks. There is no impact on performance
 * if a trace is not being collected.
 *
 * The label for the trace is always truncated to [MAX_LABEL_LENGTH] characters as
 * [android.os.Trace.beginSection] throws IllegalArgumentException if the label is longer
 * than 127 characters. The labels must be prefixed with `msr-` to make it easy to find any trace
 * from the SDK.
 */
internal object InternalTrace {
    /**
     * [android.os.Trace.beginSection] throws IllegalArgumentException if the
     * label is longer than 127 characters.
     */
    private const val MAX_LABEL_LENGTH = 127

    /**
     * Allows tracing of a block of code.
     *
     * [label] a string producing lambda if the label is computed dynamically. If the label isn't
     * dynamic, use the [trace] which directly takes a string instead.
     */
    inline fun <T> trace(
        crossinline label: () -> String,
        crossinline block: () -> T,
    ): T {
        if (!isEnabled()) {
            return block()
        }
        try {
            Trace.beginSection(label().take(MAX_LABEL_LENGTH))
            return block()
        } finally {
            Trace.endSection()
        }
    }

    /**
     * Allows tracing of a block of code. The label is truncated to [MAX_LABEL_LENGTH] characters
     */
    inline fun <T> trace(
        label: String,
        crossinline block: () -> T,
    ): T = trace({ label }, block)

    @ChecksSdkIntAtLeast(api = Build.VERSION_CODES.Q)
    private fun isEnabled(): Boolean = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
}
