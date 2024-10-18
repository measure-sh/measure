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
    val id: String,
    val createdAt: Long,
    val lastEventTime: Long = 0,
    val crashed: Boolean = false,
) {
    fun hasTrackedEvent(): Boolean {
        return lastEventTime != 0L
    }
}
