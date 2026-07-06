package sh.measure.android.events

internal object AttachmentType {
    const val SCREENSHOT = "screenshot"
    const val LAYOUT_SNAPSHOT = "layout_snapshot"
    const val LAYOUT_SNAPSHOT_JSON = "layout_snapshot_json"
    const val PERFETTO_TRACE = "perfetto_trace"
    const val HEAP_DUMP = "heap_dump"
    const val HEAP_PROFILE = "heap_profile"

    val VALID_TYPES = listOf(SCREENSHOT, LAYOUT_SNAPSHOT, LAYOUT_SNAPSHOT_JSON)
}
