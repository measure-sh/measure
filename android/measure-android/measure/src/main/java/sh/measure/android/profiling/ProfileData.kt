package sh.measure.android.profiling

import kotlinx.serialization.Serializable

/**
 * Data for a [sh.measure.android.events.EventType.PROFILE] event. The profile output file (a
 * Perfetto trace or heap dump) is attached to the event separately, with the same [format].
 */
@Serializable
internal data class ProfileData(
    /**
     * The occasion that produced the profile, e.g. "app_launch" or "anr". For profiles captured by
     * the platform [android.os.ProfilingManager] this is derived from the trigger that fired.
     */
    val reason: String,

    /**
     * The format of the attached profile artifact, mirroring the attachment's type. One of
     * [sh.measure.android.events.AttachmentType.PERFETTO_TRACE],
     * [sh.measure.android.events.AttachmentType.HEAP_DUMP], or
     * [sh.measure.android.events.AttachmentType.HEAP_PROFILE].
     */
    val format: String,
)
