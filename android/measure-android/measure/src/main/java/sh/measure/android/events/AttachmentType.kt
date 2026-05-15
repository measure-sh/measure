package sh.measure.android.events

internal object AttachmentType {
    const val SCREENSHOT = "screenshot"
    const val LAYOUT_SNAPSHOT = "layout_snapshot"
    const val LAYOUT_SNAPSHOT_JSON = "layout_snapshot_json"

    val VALID_TYPES = listOf(SCREENSHOT, LAYOUT_SNAPSHOT, LAYOUT_SNAPSHOT_JSON)
}
