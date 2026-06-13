package sh.measure.android.logs

import android.util.Log
import sh.measure.android.Measure

/**
 * Receives `android.util.Log` calls redirected by the Measure gradle plugin's bytecode
 * instrumentation. Each method must keep the exact signature of the [Log] method it
 * replaces, as the instrumentation swaps the call owner without touching arguments.
 *
 * Calls are forwarded to [Log] unchanged and additionally tracked as log events once the
 * SDK is initialized. The minimum severity collected is governed by the SDK config.
 */
object MsrLog {
    @JvmStatic
    fun v(tag: String?, msg: String): Int {
        val result = Log.v(tag, msg)
        track(Log.VERBOSE, tag, msg, null)
        return result
    }

    @JvmStatic
    fun v(tag: String?, msg: String?, tr: Throwable?): Int {
        val result = Log.v(tag, msg, tr)
        track(Log.VERBOSE, tag, msg, tr)
        return result
    }

    @JvmStatic
    fun d(tag: String?, msg: String): Int {
        val result = Log.d(tag, msg)
        track(Log.DEBUG, tag, msg, null)
        return result
    }

    @JvmStatic
    fun d(tag: String?, msg: String?, tr: Throwable?): Int {
        val result = Log.d(tag, msg, tr)
        track(Log.DEBUG, tag, msg, tr)
        return result
    }

    @JvmStatic
    fun i(tag: String?, msg: String): Int {
        val result = Log.i(tag, msg)
        track(Log.INFO, tag, msg, null)
        return result
    }

    @JvmStatic
    fun i(tag: String?, msg: String?, tr: Throwable?): Int {
        val result = Log.i(tag, msg, tr)
        track(Log.INFO, tag, msg, tr)
        return result
    }

    @JvmStatic
    fun w(tag: String?, msg: String): Int {
        val result = Log.w(tag, msg)
        track(Log.WARN, tag, msg, null)
        return result
    }

    @JvmStatic
    fun w(tag: String?, msg: String?, tr: Throwable?): Int {
        val result = Log.w(tag, msg, tr)
        track(Log.WARN, tag, msg, tr)
        return result
    }

    @JvmStatic
    fun w(tag: String?, tr: Throwable?): Int {
        val result = Log.w(tag, tr)
        track(Log.WARN, tag, null, tr)
        return result
    }

    @JvmStatic
    fun e(tag: String?, msg: String): Int {
        val result = Log.e(tag, msg)
        track(Log.ERROR, tag, msg, null)
        return result
    }

    @JvmStatic
    fun e(tag: String?, msg: String?, tr: Throwable?): Int {
        val result = Log.e(tag, msg, tr)
        track(Log.ERROR, tag, msg, tr)
        return result
    }

    @JvmStatic
    fun wtf(tag: String?, msg: String?): Int {
        val result = Log.wtf(tag, msg)
        track(Log.ASSERT, tag, msg, null)
        return result
    }

    @JvmStatic
    fun wtf(tag: String?, tr: Throwable): Int {
        val result = Log.wtf(tag, tr)
        track(Log.ASSERT, tag, null, tr)
        return result
    }

    @JvmStatic
    fun wtf(tag: String?, msg: String?, tr: Throwable?): Int {
        val result = Log.wtf(tag, msg, tr)
        track(Log.ASSERT, tag, msg, tr)
        return result
    }

    @JvmStatic
    fun println(priority: Int, tag: String?, msg: String): Int {
        val result = Log.println(priority, tag, msg)
        track(priority, tag, msg, null)
        return result
    }

    private fun track(priority: Int, tag: String?, msg: String?, tr: Throwable?) {
        val collector = Measure.getLogEventCollector() ?: return
        track(collector, priority, tag, msg, tr)
    }

    internal fun track(
        collector: LogEventCollector,
        priority: Int,
        tag: String?,
        msg: String?,
        tr: Throwable?,
    ) {
        val body = buildMessage(tag, msg, tr) ?: return
        collector.trackLog(
            body = body,
            severity = severityForPriority(priority),
            userTriggered = false,
        )
    }

    internal fun severityForPriority(priority: Int): LogSeverity = when {
        priority >= Log.ASSERT -> LogSeverity.Fatal
        priority >= Log.ERROR -> LogSeverity.Error
        priority >= Log.WARN -> LogSeverity.Warning
        priority >= Log.INFO -> LogSeverity.Info
        else -> LogSeverity.Debug
    }

    internal fun buildMessage(tag: String?, msg: String?, tr: Throwable?): String? {
        val stackTrace = if (tr != null) Log.getStackTraceString(tr).trimEnd() else ""
        val body = when {
            msg.isNullOrEmpty() && stackTrace.isEmpty() -> return null
            msg.isNullOrEmpty() -> stackTrace
            stackTrace.isEmpty() -> msg
            else -> "$msg\n$stackTrace"
        }
        return if (tag.isNullOrEmpty()) body else "$tag: $body"
    }
}
