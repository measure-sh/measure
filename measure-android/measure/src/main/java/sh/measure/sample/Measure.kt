package sh.measure.sample

import android.content.Context
import sh.measure.sample.logger.AndroidLogger
import sh.measure.sample.logger.LogLevel

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