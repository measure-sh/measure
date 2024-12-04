package sh.measure.android.layoutinspector

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SvgGeneratorKtTest {
    @Test
    fun `empty list generates basic SVG structure`() {
        val svg = emptyList<Node>().generateSvg(null, 100, 100)

        assertTrue(svg.startsWith("<svg xmlns=\"http://www.w3.org/2000/svg\""))
        assertTrue(svg.contains("viewBox=\"0 0 100 100\""))
        assertTrue(svg.contains("<rect width=\"100%\" height=\"100%\" fill=\"#262626\""))
        assertTrue(svg.endsWith("</g></svg>"))
    }

    @Test
    fun `non text nodes are properly grouped and styled`() {
        val childNode = Node(
            id = "node1",
            className = "FrameLayout",
            x = 15,
            y = 25,
            width = 35,
            height = 45,
        )
        val svg = listOf(childNode).generateSvg(null, 100, 100)

        assertTrue(svg.contains("<g class=\"base-rect grey-rect\">"))
        assertTrue(svg.contains("<rect x=\"15\" y=\"25\" width=\"35\" height=\"45\"/>"))
    }

    @Test
    fun `text nodes are properly grouped and styled`() {
        val textNode = Node(
            id = "text1",
            className = "TextView",
            x = 5,
            y = 15,
            width = 25,
            height = 35,
            isText = true,
        )
        val svg = listOf(textNode).generateSvg(null, 100, 100)

        assertTrue(svg.contains("<g class=\"text-rect\">"))
        assertTrue(svg.contains("<rect x=\"5\" y=\"15\" width=\"25\" height=\"35\"/>"))
    }

    @Test
    fun `target node is properly highlighted`() {
        val targetNode = Node(
            id = "target1",
            className = "TargetView",
            x = 10,
            y = 20,
            width = 30,
            height = 40,
        )
        val svg = listOf(targetNode).generateSvg(targetNode, 100, 100)

        assertTrue(svg.contains("<rect x=\"10\" y=\"20\" width=\"30\" height=\"40\" class=\"target-rect\"/>"))
    }

    @Test
    fun `duplicate nodes are filtered out`() {
        val node1 = Node(
            id = "node1",
            className = "DuplicateView",
            x = 10,
            y = 20,
            width = 30,
            height = 40,
        )
        val node2 = Node(
            id = "node2",
            className = "DuplicateView",
            x = 10,
            y = 20,
            width = 30,
            height = 40,
        )
        val node3 = Node(
            id = "node3",
            className = "UniqueView",
            x = 15,
            y = 25,
            width = 35,
            height = 45,
        )

        val svg = listOf(node1, node2, node3).generateSvg(null, 100, 100)

        // Count occurrences of rect elements
        // Subtract 1 for background rect
        val rectCount = "(?s)<rect.*?/>".toRegex().findAll(svg).count() - 1
        assertEquals(2, rectCount)
    }

    @Test
    fun `zero coordinates are omitted`() {
        val node = Node(
            id = "zero1",
            className = "ZeroView",
            x = 0,
            y = 0,
            width = 30,
            height = 40,
        )
        val svg = listOf(node).generateSvg(null, 100, 100)

        assertTrue(svg.contains("<rect width=\"30\" height=\"40\"/>"))
        assertTrue(!svg.contains("x=\"0\""))
        assertTrue(!svg.contains("y=\"0\""))
    }

    @Test
    fun `mixed node types are properly grouped`() {
        val nodes = listOf(
            Node(
                id = "node1",
                className = "FrameLayout",
                x = 10,
                y = 20,
                width = 30,
                height = 40,
            ),
            Node(
                id = "node2",
                className = "ImageView",
                x = 15,
                y = 25,
                width = 35,
                height = 45,
            ),
            Node(
                id = "text1",
                className = "TextView",
                x = 5,
                y = 15,
                width = 25,
                height = 35,
                isText = true,
            ),
        )

        val svg = nodes.generateSvg(null, 100, 100)

        assertTrue(svg.contains("<g class=\"base-rect grey-rect\">"))
        assertTrue(svg.contains("<g class=\"text-rect\">"))

        // Verify each node is in correct position
        assertTrue(svg.contains("<rect x=\"10\" y=\"20\" width=\"30\" height=\"40\"/>"))
        assertTrue(svg.contains("<rect x=\"15\" y=\"25\" width=\"35\" height=\"45\"/>"))
        assertTrue(svg.contains("<rect x=\"5\" y=\"15\" width=\"25\" height=\"35\"/>"))
    }
}
