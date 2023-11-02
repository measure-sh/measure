package sh.measure.android.cold_launch

import sh.measure.android.method_trace.MethodTraceConfig

internal class FakeColdLaunchTrace: ColdLaunchTrace {
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