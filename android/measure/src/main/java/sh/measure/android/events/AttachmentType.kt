package sh.measure.android.events

internal object AttachmentType {
    const val SCREENSHOT = "screenshot"
    const val LAYOUT_SNAPSHOT = "layout_snapshot"

    val VALID_TYPES = listOf<String>(SCREENSHOT, LAYOUT_SNAPSHOT)
}
