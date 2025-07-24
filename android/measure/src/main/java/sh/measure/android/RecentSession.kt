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
     * The epoch time when the session was created.
     */
    val createdAt: Long,
    /**
     * The epoch time when the last event was tracked.
     */
    val lastEventTime: Long = 0,
    /**
     * Whether this session crashed or not.
     */
    val crashed: Boolean = false,
    /**
     * The version code of the app for which this session was created.
     */
    val versionCode: String,
) {
    fun hasTrackedEvent(): Boolean = lastEventTime != 0L
}
