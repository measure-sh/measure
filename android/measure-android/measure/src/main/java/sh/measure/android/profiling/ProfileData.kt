package sh.measure.android.profiling

import kotlinx.serialization.Serializable

/**
 * Data for a [sh.measure.android.events.EventType.PROFILE] event. The profile output file, a
 * Perfetto trace of some kind, is attached to the event separately, with the same [format].
 */
@Serializable
internal data class ProfileData(
    /**
     * The occasion that produced the profile, e.g. "app_fully_drawn" or "anr". For profiles captured by
     * the platform [android.os.ProfilingManager] this is derived from the trigger that fired.
     */
    val reason: String,

    /**
     * The format of the attached profile artifact, mirroring the attachment's type. One of
     * [sh.measure.android.events.AttachmentType.PERFETTO_TRACE],
     * [sh.measure.android.events.AttachmentType.PERFETTO_JAVA_HEAP_DUMP],
     * [sh.measure.android.events.AttachmentType.PERFETTO_HEAP_PROFILE], or
     * [sh.measure.android.events.AttachmentType.PERFETTO_STACK_SAMPLE].
     */
    val format: String,
)
