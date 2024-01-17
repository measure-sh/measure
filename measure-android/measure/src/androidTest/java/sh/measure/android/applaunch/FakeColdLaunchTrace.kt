package sh.measure.android.applaunch

import sh.measure.android.methodtrace.MethodTraceConfig

internal class FakeColdLaunchTrace : ColdLaunchTrace {
    override val config: MethodTraceConfig
        get() = MethodTraceConfig(
            path = "",
            name = "",
            bufferSize = 0,
            intervalUs = 0,
        )

    var traceRunning = false

    override fun start() {
        traceRunning = true
    }

    override fun stop() {
        traceRunning = false
    }
}
