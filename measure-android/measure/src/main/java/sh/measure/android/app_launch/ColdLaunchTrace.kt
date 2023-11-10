package sh.measure.android.app_launch

import sh.measure.android.attachment.AttachmentInfo
import sh.measure.android.attachment.AttachmentType
import sh.measure.android.events.EventTracker
import sh.measure.android.method_trace.MethodTrace
import sh.measure.android.method_trace.MethodTraceConfig
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
    private val eventTracker: EventTracker,
    private val timeProvider: TimeProvider
) : ColdLaunchTrace {
    override val config = MethodTraceConfig(
        path = storage.getAttachmentsDirPath(sessionId),
        name = "cold_launch",
        bufferSize = 8 * 1024 * 1024, // 8MB
        intervalUs = 1000 * 100, // 100ms
    )

    override fun start() {
        MethodTrace.getInstance().start(config)
    }

    override fun stop() {
        MethodTrace.getInstance().stop()
        eventTracker.storeAttachment(
            AttachmentInfo(
                name = config.name,
                type = AttachmentType.METHOD_TRACE,
                extension = config.extension,
                absolutePath = config.absolutePath,
                timestamp = timeProvider.currentTimeSinceEpochInMillis
            )
        )
    }
}