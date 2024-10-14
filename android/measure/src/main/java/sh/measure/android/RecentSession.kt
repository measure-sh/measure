package sh.measure.android

import kotlinx.serialization.Serializable

/**
 * Information about the last event tracked for a session.
 *
 * Note that this is serialized to shared preferences, only make backwards compatible changes
 * to this object.
 */
@Serializable
internal data class RecentSession(
    val id: String,
    val lastEventTime: Long,
)
