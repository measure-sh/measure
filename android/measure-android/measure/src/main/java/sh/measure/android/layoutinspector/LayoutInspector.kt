@file:OptIn(ExperimentalSerializationApi::class)

package sh.measure.android.layoutinspector

import android.content.res.Resources.NotFoundException
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.node.RootForTest
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getAllSemanticsNodes
import androidx.compose.ui.semantics.getOrNull
import androidx.core.view.isNotEmpty
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.buildClassSerialDescriptor
import kotlinx.serialization.descriptors.element
import kotlinx.serialization.descriptors.listSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.encoding.decodeStructure
import kotlinx.serialization.encoding.encodeStructure
import kotlinx.serialization.json.encodeToStream
import kotlinx.serialization.serializer
import okio.Buffer
import okio.GzipSink
import okio.buffer
import sh.measure.android.MsrAttachment
import sh.measure.android.events.Attachment
import sh.measure.android.events.AttachmentType
import sh.measure.android.gestures.DetectedGesture
import sh.measure.android.serialization.jsonSerializer
import sh.measure.android.utils.ComposeHelper

private const val FLUTTER_VIEW_CLASS_NAME = "io.flutter.embedding.android.FlutterView"

/**
 * Compact bounds representation packed into a single Long value.
 * Stores x, y, width, height as 16-bit values each.
 */
@JvmInline
internal value class Bounds(val packed: Long) {
    constructor(x: Int, y: Int, width: Int, height: Int) : this(
        (x.toLong() and 0xFFFF) or
            ((y.toLong() and 0xFFFF) shl 16) or
            ((width.toLong() and 0xFFFF) shl 32) or
            ((height.toLong() and 0xFFFF) shl 48),
    )

    val x: Int get() = (packed and 0xFFFF).toInt()
    val y: Int get() = ((packed shr 16) and 0xFFFF).toInt()
    val width: Int get() = ((packed shr 32) and 0xFFFF).toInt()
    val height: Int get() = ((packed shr 48) and 0xFFFF).toInt()
}

/**
 * Compact flags representation packed into a single Byte.
 */
@JvmInline
internal value class ElementFlags(val value: Byte) {
    val scrollable: Boolean get() = (value.toInt() and 0x01) != 0
    val highlighted: Boolean get() = (value.toInt() and 0x02) != 0

    companion object {
        fun create(scrollable: Boolean, highlighted: Boolean): ElementFlags {
            var flags = 0
            if (scrollable) flags = flags or 0x01
            if (highlighted) flags = flags or 0x02
            return ElementFlags(flags.toByte())
        }
    }
}

@Serializable
internal enum class ElementType {
    @SerialName("container")
    Container,

    @SerialName("text")
    Text,
}

/**
 * Compact representation of layout snapshot.
 */
@Serializable(with = LayoutElementSerializer::class)
internal data class LayoutElement(
    val id: String?,
    val label: String,
    val type: ElementType,
    val bounds: Bounds,
    val flags: ElementFlags,
    private val _children: List<LayoutElement>? = null,
) {
    val children: List<LayoutElement>
        get() = _children ?: emptyList()

    val positionX: Int get() = bounds.x
    val positionY: Int get() = bounds.y
    val width: Int get() = bounds.width
    val height: Int get() = bounds.height
    val scrollable: Boolean get() = flags.scrollable
    val highlighted: Boolean get() = flags.highlighted

    /**
     * Returns total count of nodes in this subtree.
     */
    fun count(): Int = 1 + children.sumOf { it.count() }
}

/**
 * Custom serializer that maintains compatibility with the original serialization format.
 * Serializes the optimized internal representation to the same JSON structure.
 */
internal object LayoutElementSerializer : KSerializer<LayoutElement> {
    private val stringSerializer = serializer<String>()

    // Use a stub list descriptor for children to break circular static initialization.
    // element<List<LayoutElement>>("ch") would eagerly resolve LayoutElement.serializer()
    // which triggers LayoutElementSerializer.<clinit> while it's already being initialized.
    private val childrenDescriptor = listSerialDescriptor(
        buildClassSerialDescriptor("LayoutElement"),
    )

    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("LayoutElement") {
        element<String?>("id")
        element<String>("label")
        element<ElementType>("type")
        element<Int>("x")
        element<Int>("y")
        element<Int>("width")
        element<Int>("height")
        element<Boolean>("scrollable")
        element<Boolean>("highlighted")
        element("children", childrenDescriptor)
    }

    // Lazily initialized to avoid circular dependency
    private val listSerializer by lazy {
        kotlinx.serialization.builtins.ListSerializer(LayoutElementSerializer)
    }

    override fun serialize(encoder: Encoder, value: LayoutElement) {
        encoder.encodeStructure(descriptor) {
            encodeNullableSerializableElement(descriptor, 0, stringSerializer, value.id)
            encodeStringElement(descriptor, 1, value.label)
            encodeSerializableElement(descriptor, 2, ElementType.serializer(), value.type)
            encodeIntElement(descriptor, 3, value.positionX)
            encodeIntElement(descriptor, 4, value.positionY)
            encodeIntElement(descriptor, 5, value.width)
            encodeIntElement(descriptor, 6, value.height)
            encodeBooleanElement(descriptor, 7, value.scrollable)
            encodeBooleanElement(descriptor, 8, value.highlighted)
            encodeSerializableElement(descriptor, 9, listSerializer, value.children)
        }
    }

    override fun deserialize(decoder: Decoder): LayoutElement = decoder.decodeStructure(descriptor) {
        var id: String? = null
        var label: String? = null
        var type: ElementType? = null
        var px = 0
        var py = 0
        var wd = 0
        var ht = 0
        var sc = false
        var hl = false
        var children: List<LayoutElement>? = null

        while (true) {
            when (val index = decodeElementIndex(descriptor)) {
                0 -> id = decodeNullableSerializableElement(descriptor, 0, stringSerializer)
                1 -> label = decodeStringElement(descriptor, 1)
                2 -> type = decodeSerializableElement(descriptor, 2, ElementType.serializer())
                3 -> px = decodeIntElement(descriptor, 3)
                4 -> py = decodeIntElement(descriptor, 4)
                5 -> wd = decodeIntElement(descriptor, 5)
                6 -> ht = decodeIntElement(descriptor, 6)
                7 -> sc = decodeBooleanElement(descriptor, 7)
                8 -> hl = decodeBooleanElement(descriptor, 8)
                9 -> children = decodeSerializableElement(descriptor, 9, listSerializer)
                -1 -> break
                else -> error("Unexpected index: $index")
            }
        }

        LayoutElement(
            id = id,
            label = label ?: "",
            type = type ?: ElementType.Container,
            bounds = Bounds(px, py, wd, ht),
            flags = ElementFlags.create(sc, hl),
            _children = children?.takeIf { it.isNotEmpty() },
        )
    }
}

/**
 * Represents a snapshot of the layout hierarchy at a point in time.
 */
internal data class LayoutSnapshot(
    val root: LayoutElement?,
) {
    /**
     * Finds the deepest node that will consume the gesture.
     * Uses depth-first search to find the most specific (deepest) consumer.
     */
    fun findGestureConsumer(): LayoutElement? {
        fun search(node: LayoutElement): LayoutElement? {
            // Check children first (depth-first search for deepest match)
            for (child in node.children) {
                val found = search(child)
                if (found != null) return found
            }
            // Then check current node
            if (node.highlighted) return node
            return null
        }
        return root?.let { search(it) }
    }

    /**
     * Returns total count of all nodes in the hierarchy.
     */
    fun totalNodeCount(): Int = root?.count() ?: 0

    /**
     * Converts a layout snapshot to a [Attachment].
     */
    @OptIn(ExperimentalSerializationApi::class)
    fun compressToAttachment(attachmentType: String): Attachment {
        val bytes = Buffer().use { buffer ->
            GzipSink(buffer).buffer().use { gzip ->
                jsonSerializer.encodeToStream(root, gzip.outputStream())
            }
            buffer.readByteArray()
        }
        return Attachment(
            name = "snapshot.json.gz",
            bytes = bytes,
            path = null,
            type = attachmentType,
        )
    }

    /**
     * Converts a layout snapshot to a [MsrAttachment].
     */
    @OptIn(ExperimentalSerializationApi::class)
    fun compressToMsrAttachment(): MsrAttachment {
        val bytes = Buffer().use { buffer ->
            GzipSink(buffer).buffer().use { gzip ->
                jsonSerializer.encodeToStream(root, gzip.outputStream())
            }
            buffer.readByteArray()
        }
        return MsrAttachment(
            name = "snapshot.json.gz",
            bytes = bytes,
            path = null,
            type = AttachmentType.LAYOUT_SNAPSHOT,
        )
    }
}

/**
 * Inspector for Android View hierarchies.
 */
internal object LayoutInspector {
    // Thread-local pool for location
    // arrays to avoid repeated allocations
    private val locationPool = object : ThreadLocal<IntArray>() {
        override fun initialValue() = IntArray(2)
    }

    fun capture(rootView: View): LayoutSnapshot = captureInternal(rootView, null, null)

    fun capture(
        rootView: View,
        gesture: DetectedGesture,
        motionEvent: MotionEvent,
    ): LayoutSnapshot = captureInternal(rootView, gesture, motionEvent)

    private fun captureInternal(
        rootView: View,
        gesture: DetectedGesture?,
        motionEvent: MotionEvent?,
    ): LayoutSnapshot {
        val rootNode = traverseView(rootView, gesture, motionEvent)
        return LayoutSnapshot(rootNode)
    }

    private fun traverseView(
        view: View,
        gesture: DetectedGesture?,
        motionEvent: MotionEvent?,
    ): LayoutElement? {
        if (view.visibility != View.VISIBLE) {
            return null
        }

        if (view.javaClass.name == FLUTTER_VIEW_CLASS_NAME) {
            return null
        }

        return when {
            ComposeHelper.isComposeView(view) -> {
                handleComposeView(view, gesture, motionEvent)
            }

            view is ViewGroup -> {
                handleViewGroup(view, gesture, motionEvent)
            }

            else -> {
                handleLeafView(view, gesture, motionEvent)
            }
        }
    }

    private fun handleComposeView(
        view: View,
        gesture: DetectedGesture?,
        motionEvent: MotionEvent?,
    ): LayoutElement {
        val composeHierarchy = parseComposeHierarchy(view, gesture, motionEvent)
        val location = locationPool.get()!!
        view.getLocationInWindow(location)

        return LayoutElement(
            id = view.getResName(),
            label = view.javaClass.simpleName,
            type = ElementType.Container,
            bounds = Bounds(location[0], location[1], view.width, view.height),
            flags = ElementFlags.create(scrollable = false, highlighted = false),
            _children = composeHierarchy.takeIf { it.isNotEmpty() },
        )
    }

    private fun handleViewGroup(
        viewGroup: ViewGroup,
        gesture: DetectedGesture?,
        motionEvent: MotionEvent?,
    ): LayoutElement? {
        val width = viewGroup.width
        val height = viewGroup.height

        if (!viewGroup.isNotEmpty() || width <= 0 || height <= 0) {
            return null
        }

        // Pre-allocate list with exact capacity to avoid resizing
        val childCount = viewGroup.childCount
        val children = ArrayList<LayoutElement>(childCount)

        for (i in 0 until childCount) {
            val childNode = traverseView(viewGroup.getChildAt(i), gesture, motionEvent)
            if (childNode != null) {
                children.add(childNode)
            }
        }

        val location = locationPool.get()!!
        viewGroup.getLocationInWindow(location)

        val isScrollable = canScroll(viewGroup)
        val willConsumeGesture = willConsumeGesture(viewGroup, gesture, motionEvent, location)

        return LayoutElement(
            id = viewGroup.getResName(),
            label = viewGroup.javaClass.simpleName,
            type = ElementType.Container,
            bounds = Bounds(location[0], location[1], width, height),
            flags = ElementFlags.create(scrollable = isScrollable, highlighted = willConsumeGesture),
            _children = children.takeIf { it.isNotEmpty() },
        )
    }

    private fun handleLeafView(
        view: View,
        gesture: DetectedGesture?,
        motionEvent: MotionEvent?,
    ): LayoutElement? {
        val width = view.width
        val height = view.height

        if (width <= 0 || height <= 0) {
            return null
        }

        val location = locationPool.get()!!
        view.getLocationInWindow(location)

        val willConsumeGesture = willConsumeGesture(view, gesture, motionEvent, location)
        val isText = view is TextView && !view.isClickable

        return LayoutElement(
            id = view.getResName(),
            label = view.javaClass.simpleName,
            type = if (isText) ElementType.Text else ElementType.Container,
            bounds = Bounds(location[0], location[1], width, height),
            flags = ElementFlags.create(scrollable = false, highlighted = willConsumeGesture),
            _children = null,
        )
    }

    @OptIn(ExperimentalComposeUiApi::class)
    private fun parseComposeHierarchy(
        view: View,
        gesture: DetectedGesture?,
        motionEvent: MotionEvent?,
    ): List<LayoutElement> {
        val semanticsOwner = (view as? RootForTest)?.semanticsOwner ?: return emptyList()
        val allNodes = semanticsOwner.getAllSemanticsNodes(true)

        // Single-pass filter for valid nodes
        val validNodes = allNodes.filter { node ->
            val isInvisible = node.config.getOrNull(SemanticsProperties.HideFromAccessibility) != null
            val width = node.boundsInWindow.width.toInt()
            val height = node.boundsInWindow.height.toInt()
            !isInvisible && width > 0 && height > 0
        }

        // Group by parent ID for efficient hierarchy building
        val nodesByParentId = validNodes.groupBy { it.parent?.id }

        // Build hierarchy iteratively
        return buildComposeHierarchy(
            nodesByParentId = nodesByParentId,
            parentId = null,
            view = view,
            gesture = gesture,
            motionEvent = motionEvent,
        )
    }

    private fun buildComposeHierarchy(
        nodesByParentId: Map<Int?, List<SemanticsNode>>,
        parentId: Int?,
        view: View,
        gesture: DetectedGesture?,
        motionEvent: MotionEvent?,
    ): List<LayoutElement> {
        val nodes = nodesByParentId[parentId] ?: return emptyList()

        return nodes.map { semanticsNode ->
            val isText = semanticsNode.config.getOrNull(SemanticsProperties.Text) != null
            val testTag = semanticsNode.config.getOrNull(SemanticsProperties.TestTag)
            val isScrollable = semanticsNode.config.getOrNull(SemanticsActions.ScrollBy) != null

            val willConsumeGesture = checkComposeGestureConsumption(
                semanticsNode,
                gesture,
                motionEvent,
            )

            val bounds = semanticsNode.boundsInWindow
            val children = buildComposeHierarchy(
                nodesByParentId = nodesByParentId,
                parentId = semanticsNode.id,
                view = view,
                gesture = gesture,
                motionEvent = motionEvent,
            )

            LayoutElement(
                id = testTag,
                label = testTag ?: view.javaClass.simpleName,
                type = if (isText) ElementType.Text else ElementType.Container,
                bounds = Bounds(
                    x = bounds.left.toInt(),
                    y = bounds.top.toInt(),
                    width = bounds.width.toInt(),
                    height = bounds.height.toInt(),
                ),
                flags = ElementFlags.create(
                    scrollable = isScrollable,
                    highlighted = willConsumeGesture,
                ),
                _children = children.takeIf { it.isNotEmpty() },
            )
        }
    }

    private fun checkComposeGestureConsumption(
        semanticsNode: SemanticsNode,
        gesture: DetectedGesture?,
        motionEvent: MotionEvent?,
    ): Boolean {
        if (gesture == null || motionEvent == null) return false

        val point = Offset(motionEvent.x, motionEvent.y)
        if (!semanticsNode.boundsInWindow.contains(point)) return false

        val key = when (gesture) {
            is DetectedGesture.Click -> SemanticsActions.OnClick
            is DetectedGesture.LongClick -> SemanticsActions.OnLongClick
            is DetectedGesture.Scroll -> SemanticsActions.ScrollBy
        }

        return semanticsNode.config.getOrNull(key) != null
    }

    private fun willConsumeGesture(
        view: View,
        gesture: DetectedGesture?,
        motionEvent: MotionEvent?,
        location: IntArray,
    ): Boolean {
        if (gesture == null || motionEvent == null) return false

        return when (gesture) {
            is DetectedGesture.Click ->
                view.isClickable && view.hitTest(motionEvent.x, motionEvent.y, location)

            is DetectedGesture.LongClick ->
                (view.isLongClickable || view.isPressed) &&
                    view.hitTest(motionEvent.x, motionEvent.y, location)

            is DetectedGesture.Scroll ->
                canScroll(view) && view.hitTest(motionEvent.x, motionEvent.y, location)
        }
    }

    private fun canScroll(view: View): Boolean = if (view.isScrollContainer) {
        view.canScrollHorizontally(-1) || view.canScrollHorizontally(1) ||
            view.canScrollVertically(-1) || view.canScrollVertically(1)
    } else {
        false
    }

    private fun View.hitTest(x: Float, y: Float, location: IntArray): Boolean {
        val left = location[0]
        val top = location[1]
        val right = left + width
        val bottom = top + height
        return x >= left && x <= right && y >= top && y <= bottom
    }

    private fun View.getResName(): String? {
        if (id != View.NO_ID && resources != null) {
            try {
                return resources.getResourceEntryName(id)
            } catch (_: NotFoundException) {
                // Ignore
            }
        }
        return null
    }
}
