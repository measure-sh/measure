package sh.measure.sample.logger

import android.util.Log

/**
 * A logger that logs to the Android logcat.
 */
internal class AndroidLogger : Logger {
    private val tag = "Measure"

    override fun log(level: LogLevel, message: String, throwable: Throwable?) {
        when (level) {
            LogLevel.Debug -> Log.d(tag, message, throwable)
            LogLevel.Info -> Log.i(tag, message, throwable)
            LogLevel.Warning -> Log.w(tag, message, throwable)
            LogLevel.Error -> Log.e(tag, message, throwable)
            LogLevel.Fatal -> Log.wtf(tag, message, throwable)
        }
    }
}