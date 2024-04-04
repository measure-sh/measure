package sh.measure.android.attachments

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import sh.measure.android.attributes.SessionIdProvider
import sh.measure.android.storage.AttachmentEntity
import sh.measure.android.storage.Database
import sh.measure.android.storage.FileStorage
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.toJsonElement

internal interface AttachmentStore {
    fun storeAttachment(path: String, attachmentInfo: AttachmentInfo)
    fun createMethodTraceFile(attachmentInfo: AttachmentInfo): String?
}

internal class AttachmentStoreImpl(
    private val idProvider: IdProvider,
    private val database: Database,
    private val fileStorage: FileStorage,
    private val sessionIdProvider: SessionIdProvider,
) : AttachmentStore {
    override fun createMethodTraceFile(attachmentInfo: AttachmentInfo): String? {
        return fileStorage.createAttachmentFile(attachmentInfo.name)
    }

    override fun storeAttachment(path: String, attachmentInfo: AttachmentInfo) {
        database.insertAttachment(
            AttachmentEntity(
                id = idProvider.createId(),
                path = path,
                name = attachmentInfo.name,
                extension = attachmentInfo.extension,
                type = attachmentInfo.type,
                timestamp = attachmentInfo.timestamp,
                sessionId = sessionIdProvider.sessionId,
                serializedAttributes = Json.encodeToString(
                    JsonElement.serializer(),
                    attachmentInfo.attributes.toJsonElement()
                )
            )
        )
    }
}
