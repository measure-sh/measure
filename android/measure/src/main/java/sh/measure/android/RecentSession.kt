package sh.measure.android

import kotlinx.serialization.Serializable

/**
 * Information about the most recent session.
 *
 * Note that this is serialized & deserialized to shared preferences, only make backwards
 * compatible changes to this object.
 */
@Serializable
internal data class RecentSession(
    /**
     * The session id.
     */
    val id: String,
    /**
     * The time since boot when the session was created at.
     */
    val createdAt: Long,
    /**
     * The time since boot when the last event was tracked.
     */
    val lastEventTime: Long = 0,
    /**
     * Whether this session crashed or not.
     */
    val crashed: Boolean = false,
) {
    fun hasTrackedEvent(): Boolean {
        return lastEventTime != 0L
    }
}
