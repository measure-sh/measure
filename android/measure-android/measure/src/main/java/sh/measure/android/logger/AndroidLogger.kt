package sh.measure.android.logger

import android.util.Log

/**
 * A logger that logs to the Android logcat.
 */
internal class AndroidLogger(override val enabled: Boolean) : Logger {
    private val tag = "Measure"
    private var logCallback: ((LogLevel, String, Throwable?) -> Unit)? = null

    override fun log(level: LogLevel, message: String, throwable: Throwable?) {
        logCallback?.invoke(level, message, throwable)
        if (!enabled) return
        when (level) {
            LogLevel.Debug -> Log.d(tag, message, throwable)
            LogLevel.Error -> Log.e(tag, message, throwable)
        }
    }

    override fun setLogCallback(callback: ((LogLevel, String, Throwable?) -> Unit)?) {
        logCallback = callback
    }
}
