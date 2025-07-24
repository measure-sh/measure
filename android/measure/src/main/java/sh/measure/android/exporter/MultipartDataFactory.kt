package sh.measure.android.exporter

import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.serialization.jsonSerializer
import sh.measure.android.storage.FileStorage
import java.io.InputStream

internal interface MultipartDataFactory {
    /**
     * Creates a [MultipartData] object from an [EventPacket].
     *
     * If the [EventPacket] contains serialized data, the [MultipartData] object will be created
     * as a form field. If the [EventPacket] contains a file path, the [MultipartData] object will be
     * created as a file data in the multipart request.
     *
     * @param eventPacket the [EventPacket] to create the [MultipartData] object from
     * @return [MultipartData] object or null if the [EventPacket] does not contain serialized data
     * or file path
     */
    fun createFromEventPacket(eventPacket: EventPacket): MultipartData?

    /**
     * Creates a [MultipartData] object from an [AttachmentPacket].
     *
     * The [MultipartData] object will be created as a file data in the multipart request.
     *
     * @param attachmentPacket the [AttachmentPacket] to create the [MultipartData] object from
     * @return [MultipartData] object or null if the file at the [AttachmentPacket]'s file path
     */
    fun createFromAttachmentPacket(attachmentPacket: AttachmentPacket): MultipartData?

    /**
     * Creates a [MultipartData] object from a [SpanPacket].
     *
     * @param spanPacket the [SpanPacket] to create the [MultipartData] object from.
     */
    fun createFromSpanPacket(spanPacket: SpanPacket): MultipartData
}

internal class MultipartDataFactoryImpl(
    private val logger: Logger,
    private val fileStorage: FileStorage,
) : MultipartDataFactory {

    internal companion object {
        const val ATTACHMENT_NAME_PREFIX = "blob-"
        const val EVENT_FORM_NAME = "event"
        const val SPAN_FORM_NAME = "span"
    }

    override fun createFromEventPacket(eventPacket: EventPacket): MultipartData? = when {
        eventPacket.serializedData != null -> {
            eventPacket.getFromSerializedData()?.let {
                MultipartData.FormField(
                    name = EVENT_FORM_NAME,
                    value = it,
                )
            }
        }

        eventPacket.serializedDataFilePath != null -> {
            eventPacket.getFromFileData()?.let {
                MultipartData.FormField(
                    name = EVENT_FORM_NAME,
                    value = it,
                )
            }
        }

        else -> {
            logger.log(
                LogLevel.Debug,
                "Event packet (id=${eventPacket.eventId}) does not contain serialized data or file path",
            )
            null
        }
    }

    override fun createFromAttachmentPacket(attachmentPacket: AttachmentPacket): MultipartData? {
        val name = getAttachmentFormDataName(attachmentPacket)
        val fileInputStream = getFileInputStream(attachmentPacket.filePath)
        return if (fileInputStream != null) {
            MultipartData.FileData(
                name = name,
                filename = name,
                inputStream = fileInputStream,
            )
        } else {
            null
        }
    }

    override fun createFromSpanPacket(spanPacket: SpanPacket): MultipartData = spanPacket.getSerializedData().let {
        MultipartData.FormField(
            name = SPAN_FORM_NAME,
            value = it,
        )
    }

    private fun getFileInputStream(filePath: String): InputStream? = fileStorage.getFile(filePath)?.inputStream().also { fileInputStream ->
        if (fileInputStream == null) {
            logger.log(LogLevel.Debug, "No file found at path: $filePath")
        }
    }

    private fun getAttachmentFormDataName(attachmentPacket: AttachmentPacket): String = "$ATTACHMENT_NAME_PREFIX${attachmentPacket.id}"

    private fun EventPacket.getFromSerializedData(): String? {
        if (serializedData.isNullOrEmpty()) {
            return null
        }
        return "{\"id\":\"$eventId\",\"session_id\":\"$sessionId\",\"user_triggered\":$userTriggered,\"timestamp\":\"$timestamp\",\"type\":\"${type.value}\",\"${type.value}\":$serializedData,\"attachments\":$serializedAttachments,\"attribute\":$serializedAttributes,\"user_defined_attribute\":$serializedUserDefinedAttributes}"
    }

    private fun EventPacket.getFromFileData(): String? {
        if (serializedDataFilePath.isNullOrEmpty()) {
            return null
        }
        val data = fileStorage.getFile(serializedDataFilePath)?.readText()
        if (data.isNullOrEmpty()) {
            return null
        }
        return "{\"id\":\"$eventId\",\"session_id\":\"$sessionId\",\"user_triggered\":$userTriggered,\"timestamp\":\"$timestamp\",\"type\":\"${type.value}\",\"${type.value}\":$data,\"attachments\":$serializedAttachments,\"attribute\":$serializedAttributes,\"user_defined_attribute\":$serializedUserDefinedAttributes}"
    }

    private fun SpanPacket.getSerializedData(): String = jsonSerializer.encodeToString(SpanPacket.serializer(), this)
}
