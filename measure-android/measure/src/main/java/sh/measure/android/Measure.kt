package sh.measure.android

import android.content.Context
import sh.measure.android.logger.AndroidLogger
import sh.measure.android.logger.LogLevel

class Measure {
    companion object {
        fun init(context: Context) {
            // TODO(abhay): Refactor this. This is a temporary entry point for initializing the
            //   Measure SDK.
            val logger = AndroidLogger().apply { log(LogLevel.Debug, "Initializing Measure") }
            MeasureClient(logger, context).apply { init() }
        }
    }
}