package sh.measure.android.applaunch

import sh.measure.android.attachment.AttachmentInfo
import sh.measure.android.attachment.AttachmentType
import sh.measure.android.events.EventProcessor
import sh.measure.android.methodtrace.MethodTrace
import sh.measure.android.methodtrace.MethodTraceConfig
import sh.measure.android.storage.Storage
import sh.measure.android.utils.TimeProvider

internal interface ColdLaunchTrace {
    val config: MethodTraceConfig
    fun start()
    fun stop()
}

internal class ColdLaunchTraceImpl(
    storage: Storage,
    sessionId: String,
    private val eventProcessor: EventProcessor,
    private val timeProvider: TimeProvider,
) : ColdLaunchTrace {
    override val config = MethodTraceConfig(
        path = storage.getAttachmentsDirPath(sessionId),
        name = "cold_launch",
        // 8MB
        bufferSize = 8 * 1024 * 1024,
        // 100ms
        intervalUs = 1000 * 100,
    )

    override fun start() {
        MethodTrace.getInstance().start(config)
    }

    override fun stop() {
        MethodTrace.getInstance().stop()
        eventProcessor.storeAttachment(
            AttachmentInfo(
                name = config.name,
                type = AttachmentType.METHOD_TRACE,
                extension = config.extension,
                absolutePath = config.absolutePath,
                timestamp = timeProvider.currentTimeSinceEpochInMillis,
            ),
        )
    }
}
