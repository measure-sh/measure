package sh.measure.android.fakes

import sh.measure.android.attachments.AttachmentInfo
import sh.measure.android.attachments.AttachmentStore

internal class FakeAttachmentStore(var createMethodTraceReturnValue: String? = "method-trace.trace") :
    AttachmentStore {
    val storedAttachments = mutableListOf<Pair<String, AttachmentInfo>>()

    override fun storeAttachment(path: String, attachmentInfo: AttachmentInfo) {
        storedAttachments.add(path to attachmentInfo)
    }

    override fun createMethodTraceFile(attachmentInfo: AttachmentInfo): String? {
        return createMethodTraceReturnValue
    }
}