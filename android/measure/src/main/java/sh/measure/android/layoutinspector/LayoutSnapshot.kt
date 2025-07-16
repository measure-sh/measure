package sh.measure.android.layoutinspector

import sh.measure.android.MsrAttachment
import sh.measure.android.events.Attachment
import sh.measure.android.events.AttachmentType
import sh.measure.android.gestures.DetectedGesture
import sh.measure.android.tracing.InternalTrace

internal class LayoutSnapshot(private val nodes: List<Node>) {
    /**
     * Generates an SVG visualization of the layout snapshot as an attachment.
     *
     * The SVG includes all nodes in the layout with their positions and dimensions.
     * If a [targetNode] is provided, it will be highlighted in the visualization.
     *
     * @param targetNode Optional node to highlight in the SVG visualization
     * @param width The width of the SVG to be generated.
     * @param height The height of the SVG to be generated.
     * @return An [Attachment] containing the SVG data with MIME type set to LAYOUT_SNAPSHOT
     */
    fun generateSvgAttachment(targetNode: Node? = null, width: Int, height: Int): Attachment {
        return InternalTrace.trace(
            label = { "msr-generateSvgAttachment" },
            block = {
                val svg = nodes.generateSvg(targetNode, width, height)
                Attachment(
                    "snapshot.svg",
                    AttachmentType.LAYOUT_SNAPSHOT,
                    svg.encodeToByteArray(),
                )
            },
        )
    }

    /**
     * Generates an SVG visualization of the layout snapshot as an attachment.
     *
     * The SVG includes all nodes in the layout with their positions and dimensions.
     * If a [targetNode] is provided, it will be highlighted in the visualization.
     *
     * @param targetNode Optional node to highlight in the SVG visualization
     * @param width The width of the SVG to be generated.
     * @param height The height of the SVG to be generated.
     * @return An [Attachment] containing the SVG data with MIME type set to LAYOUT_SNAPSHOT
     */
    fun generateSvgMsrAttachment(targetNode: Node? = null, width: Int, height: Int): MsrAttachment {
        return InternalTrace.trace(
            label = { "msr-generateSvgAttachment" },
            block = {
                val svg = nodes.generateSvg(targetNode, width, height)
                MsrAttachment(
                    "snapshot.svg",
                    bytes = svg.encodeToByteArray(),
                    type = AttachmentType.LAYOUT_SNAPSHOT,
                )
            },
        )
    }

    fun findTargetNode(): Node? {
        return nodes.findLast { it.willConsumeGesture }
    }

    fun isEmpty(): Boolean {
        return nodes.isEmpty()
    }
}

internal data class Node(
    val id: String?,
    val className: String,
    val x: Int,
    val y: Int,
    val width: Int,
    val height: Int,
    val willConsumeGesture: Boolean = false,
    val gesture: DetectedGesture? = null,
    val isText: Boolean = false,
)
