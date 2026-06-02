package sh.measure.android.layoutinspector

import org.junit.Assert
import org.junit.Test

class LayoutLabelTest {

    private fun element(
        text: String? = null,
        semanticLabel: String? = null,
        children: List<LayoutElement>? = null,
    ) = LayoutElement(
        id = null,
        label = "View",
        type = ElementType.Container,
        bounds = Bounds(0, 0, 10, 10),
        flags = ElementFlags.create(scrollable = false, highlighted = false),
        _children = children,
        text = text,
        semanticLabel = semanticLabel,
    )

    @Test
    fun `collectLabel returns own text`() {
        Assert.assertEquals("Buy now", element(text = "Buy now").collectLabel())
    }

    @Test
    fun `collectLabel returns first descendant text in order`() {
        val container = element(
            children = listOf(
                element(text = "Nike Air Max"),
                element(text = "$120"),
                element(text = "In stock"),
            ),
        )
        Assert.assertEquals("Nike Air Max", container.collectLabel())
    }

    @Test
    fun `collectLabel truncates to 32 chars with ellipsis`() {
        val container = element(text = "In stock now and forever across all stores")
        val label = container.collectLabel()!!
        Assert.assertTrue(label.length <= 32)
        Assert.assertTrue(label.endsWith("…"))
    }

    @Test
    fun `collectLabel normalizes whitespace`() {
        Assert.assertEquals("a b", element(text = "  a\n\t b  ").collectLabel())
    }

    @Test
    fun `collectLabel returns null when no text present`() {
        Assert.assertNull(element(children = listOf(element(), element())).collectLabel())
    }

    @Test
    fun `collectLabel returns null for icon glyph only text`() {
        Assert.assertNull(element(text = "").collectLabel())
    }

    @Test
    fun `collectSemanticLabel truncates`() {
        val label = element(semanticLabel = "a".repeat(40)).collectSemanticLabel()!!
        Assert.assertTrue(label.length <= 32)
        Assert.assertTrue(label.endsWith("…"))
    }

    @Test
    fun `collectSemanticLabel returns null when blank`() {
        Assert.assertNull(element(semanticLabel = "   ").collectSemanticLabel())
    }
}
