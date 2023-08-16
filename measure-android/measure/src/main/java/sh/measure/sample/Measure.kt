package sh.measure.sample

import sh.measure.sample.exceptions.UnhandledExceptionCollector
import sh.measure.sample.logger.AndroidLogger
import sh.measure.sample.logger.LogLevel

class Measure {
    companion object {
        fun init() {
            // TODO(abhay): Refactor this. This is a temporary entry point for initializing the
            //   Measure SDK.
            val logger = AndroidLogger()
            logger.log(LogLevel.Debug, "Initializing Measure")
            val client = MeasureClient(logger)

            UnhandledExceptionCollector(client).register()
        }
    }
}