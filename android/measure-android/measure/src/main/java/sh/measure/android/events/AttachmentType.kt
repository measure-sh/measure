package sh.measure.android.events

internal object AttachmentType {
    const val SCREENSHOT = "screenshot"
    const val LAYOUT_SNAPSHOT = "layout_snapshot"
    const val LAYOUT_SNAPSHOT_JSON = "layout_snapshot_json"
    const val PERFETTO_TRACE = "perfetto_trace"
    const val PERFETTO_JAVA_HEAP_DUMP = "perfetto_java_heap_dump"
    const val PERFETTO_HEAP_PROFILE = "perfetto_heap_profile"
    const val PERFETTO_STACK_SAMPLE = "perfetto_stack_sample"

    val VALID_TYPES = listOf(SCREENSHOT, LAYOUT_SNAPSHOT, LAYOUT_SNAPSHOT_JSON)
}
