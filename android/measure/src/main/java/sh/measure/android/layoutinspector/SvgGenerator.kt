package sh.measure.android.layoutinspector

internal fun List<Node>.generateSvg(targetNode: Node?, width: Int, height: Int): String {
    val uniqueNodes = this.distinctBy { node ->
        "${node.positionX},${node.positionY},${node.width},${node.height}"
    }

    val textNodes = uniqueNodes.filter { it.type == ElementType.TEXT }
    val nonTextNodes = uniqueNodes.filter { it.type != ElementType.TEXT }

    return buildString {
        // SVG header with viewBox
        append(
            """
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 $width $height">
            <defs>
                <pattern id="d" width="24" height="24" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                    <line y1="0" y2="24" stroke="#fef08a" stroke-width="3"/>
                </pattern>
                <linearGradient id="text-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#fef08a;stop-opacity:0.1"/>
                    <stop offset="100%" style="stop-color:#fef08a;stop-opacity:0.05"/>
                </linearGradient>
                <style>
                    .base-rect{fill:none}
                    .grey-rect{stroke:#64748b;stroke-width:5}
                    .text-rect{fill:url(#text-gradient)}
                    .target-rect{fill:url(#d);stroke:#fef08a;stroke-width:3}
                </style>
            </defs>
            """.trimIndent(),
        )

        // Background
        append(
            """
            <g>
            <rect width="100%" height="100%" fill="#262626"/>
            """.trimIndent(),
        )

        // Other nodes group
        if (nonTextNodes.isNotEmpty()) {
            append(
                """
                <g class="base-rect grey-rect">
                """.trimIndent(),
            )

            nonTextNodes.forEach { node ->
                appendRect(node, isTarget = node == targetNode)
            }

            append("</g>")
        }

        // Text nodes group
        if (textNodes.isNotEmpty()) {
            append("""<g class="text-rect">""")

            textNodes.forEach { node ->
                appendRect(node, isTarget = node == targetNode)
            }

            append("</g>")
        }

        // Close main group and SVG
        append("</g></svg>")
    }.replace(Regex("\\n\\s*"), "")
        .replace(Regex("\\s+"), " ")
        .trim()
}

private fun StringBuilder.appendRect(node: Node, isTarget: Boolean) {
    // Only include non-zero coordinates
    val coordinates = buildString {
        if (node.positionX != 0) append(""" x="${node.positionX}"""")
        if (node.positionY != 0) append(""" y="${node.positionY}"""")
    }

    val targetClass = if (isTarget) """ class="target-rect"""" else ""

    appendLine("""<rect$coordinates width="${node.width}" height="${node.height}"$targetClass/>""")
}
