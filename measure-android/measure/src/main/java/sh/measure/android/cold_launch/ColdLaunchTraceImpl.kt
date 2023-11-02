package sh.measure.android.cold_launch

import sh.measure.android.method_trace.MethodTrace
import sh.measure.android.method_trace.MethodTraceConfig
import sh.measure.android.storage.Storage

internal interface ColdLaunchTrace {
    val config: MethodTraceConfig
    fun start()
    fun stop()
}

internal class ColdLaunchTraceImpl(storage: Storage, sessionId: String) : ColdLaunchTrace {
    override val config = MethodTraceConfig(
        path = storage.getAttachmentsDirPath(sessionId),
        name = "cold_launch",
        bufferSize = 8 * 1024 * 1024, // 8MB
        intervalUs = 1000 * 10, // 10ms
    )

    override fun start() {
        MethodTrace.getInstance().start(config)
    }

    override fun stop() {
        MethodTrace.getInstance().stop()
    }
}