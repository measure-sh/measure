package sh.measure.android.layoutinspector

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.encodeToStream
import okio.Buffer
import sh.measure.android.MsrAttachment
import sh.measure.android.events.Attachment
import sh.measure.android.events.AttachmentType
import sh.measure.android.serialization.jsonSerializer

internal class LayoutSnapshot(private val rootNode: Node?) {
    @OptIn(ExperimentalSerializationApi::class)
    fun toJsonAttachment(): Attachment {
        Buffer().use {
            jsonSerializer.encodeToStream(rootNode, it.outputStream())
            return Attachment(
                name = "snapshot.json",
                type = AttachmentType.LAYOUT_SNAPSHOT,
                bytes = it.readByteArray(),
            )
        }
    }

    @OptIn(ExperimentalSerializationApi::class)
    fun toJsonMsrAttachment(): MsrAttachment {
        Buffer().use {
            jsonSerializer.encodeToStream(rootNode, it.outputStream())
            return MsrAttachment(
                name = "snapshot.json",
                bytes = it.readByteArray(),
                type = AttachmentType.LAYOUT_SNAPSHOT,
            )
        }
    }

    fun toJson(): String {
        return jsonSerializer.encodeToString(rootNode)
    }

    fun findTargetNode(): Node? {
        return findTargetNodeRecursive(rootNode)
    }

    fun isEmpty(): Boolean {
        return rootNode == null
    }

    private fun findTargetNodeRecursive(node: Node?): Node? {
        if (node == null) return null

        // Search children first (depth-first, post-order to match previous behavior of findLast)
        for (child in node.children.reversed()) {
            findTargetNodeRecursive(child)?.let { return it }
        }

        // Check current node
        if (node.highlighted) return node

        return null
    }
}
