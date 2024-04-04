package sh.measure.android.attachments

import sh.measure.android.attributes.AttributeProcessor
import sh.measure.android.attributes.appendAttributes
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger

internal interface AttachmentProcessor {
    /**
     * Stores the [attachmentInfo] in storage and returns the path of the file to store the method
     * trace at.
     */
    fun createMethodTrace(attachmentInfo: AttachmentInfo): String?
}

internal class AttachmentProcessorImpl(
    private val logger: Logger,
    private val executorService: MeasureExecutorService,
    private val attachmentStore: AttachmentStore,
    private val attributeProcessors: List<AttributeProcessor>,
) : AttachmentProcessor {

    override fun createMethodTrace(attachmentInfo: AttachmentInfo) : String? {
        val path = attachmentStore.createMethodTraceFile(attachmentInfo)
        if (path != null) {
            executorService.submit {
                attachmentInfo.appendAttributes(attributeProcessors)
                attachmentStore.storeAttachment(path, attachmentInfo)
                logger.log(LogLevel.Debug, "Attachment created = ${attachmentInfo.type}")
            }
        }
        return path
    }
}
