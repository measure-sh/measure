package sh.measure.android.layoutinspector

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.util.zip.GZIPInputStream

class LayoutSnapshotTest {

    private fun leaf(
        id: String? = null,
        label: String = "Leaf",
        type: ElementType = ElementType.Container,
        highlighted: Boolean = false,
        scrollable: Boolean = false,
    ) = LayoutElement(
        id = id,
        label = label,
        type = type,
        bounds = Bounds(10, 20, 100, 50),
        flags = ElementFlags.create(scrollable = scrollable, highlighted = highlighted),
    )

    private fun node(
        label: String = "Parent",
        highlighted: Boolean = false,
        children: List<LayoutElement>,
    ) = LayoutElement(
        id = null,
        label = label,
        type = ElementType.Container,
        bounds = Bounds(0, 0, 200, 200),
        flags = ElementFlags.create(scrollable = false, highlighted = highlighted),
        _children = children.takeIf { it.isNotEmpty() },
    )

    @Test
    fun `findGestureConsumer returns deepest highlighted node`() {
        val child = leaf(highlighted = true, label = "DeepChild")
        val parent = node(highlighted = true, label = "Parent", children = listOf(child))
        val snapshot = LayoutSnapshot(root = parent)
        val consumer = snapshot.findGestureConsumer()
        assertNotNull(consumer)
        assertEquals("DeepChild", consumer!!.label)
    }

    @Test
    fun `compressToAttachment produces valid gzip JSON`() {
        val element = leaf(id = "btn", label = "Button")
        val snapshot = LayoutSnapshot(root = element)
        val attachment = snapshot.compressToAttachment("layout_snapshot")

        assertEquals("snapshot.json.gz", attachment.name)
        assertEquals("layout_snapshot", attachment.type)
        assertNotNull(attachment.bytes)

        val json = decompress(attachment.bytes!!)
        assertTrue(json.contains("\"label\":\"Button\""))
        assertTrue(json.contains("\"id\":\"btn\""))
    }

    @Test
    fun `Bounds packs and unpacks correctly`() {
        val bounds = Bounds(100, 200, 300, 400)
        assertEquals(100, bounds.x)
        assertEquals(200, bounds.y)
        assertEquals(300, bounds.width)
        assertEquals(400, bounds.height)
    }

    @Test
    fun `ElementFlags all combinations`() {
        val ff = ElementFlags.create(scrollable = false, highlighted = false)
        assertFalse(ff.scrollable)
        assertFalse(ff.highlighted)

        val tf = ElementFlags.create(scrollable = true, highlighted = false)
        assertTrue(tf.scrollable)
        assertFalse(tf.highlighted)

        val ft = ElementFlags.create(scrollable = false, highlighted = true)
        assertFalse(ft.scrollable)
        assertTrue(ft.highlighted)

        val tt = ElementFlags.create(scrollable = true, highlighted = true)
        assertTrue(tt.scrollable)
        assertTrue(tt.highlighted)
    }

    @Test
    fun `round-trip encode decode preserves all fields`() {
        val original = LayoutElement(
            id = "test_id",
            label = "TestLabel",
            type = ElementType.Text,
            bounds = Bounds(10, 20, 300, 400),
            flags = ElementFlags.create(scrollable = true, highlighted = true),
            _children = listOf(
                LayoutElement(
                    id = null,
                    label = "ChildLabel",
                    type = ElementType.Container,
                    bounds = Bounds(5, 10, 50, 60),
                    flags = ElementFlags.create(scrollable = false, highlighted = false),
                ),
            ),
        )

        val json = Json.encodeToString(LayoutElementSerializer, original)
        val decoded = Json.decodeFromString(LayoutElementSerializer, json)

        assertEquals(original.id, decoded.id)
        assertEquals(original.label, decoded.label)
        assertEquals(original.type, decoded.type)
        assertEquals(original.positionX, decoded.positionX)
        assertEquals(original.positionY, decoded.positionY)
        assertEquals(original.width, decoded.width)
        assertEquals(original.height, decoded.height)
        assertEquals(original.scrollable, decoded.scrollable)
        assertEquals(original.highlighted, decoded.highlighted)
        assertEquals(1, decoded.children.size)
        assertNull(decoded.children[0].id)
        assertEquals("ChildLabel", decoded.children[0].label)
    }

    private fun decompress(bytes: ByteArray): String = GZIPInputStream(ByteArrayInputStream(bytes)).bufferedReader().use { it.readText() }
}
