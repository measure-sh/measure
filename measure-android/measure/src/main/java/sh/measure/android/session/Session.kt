package sh.measure.android.session

import kotlinx.serialization.Serializable

@Serializable
internal data class Session(
    /**
     * A unique identifier for the session.
     */
    val id: String,

    /**
     * The time at with the SDK was initialized.
     */
    val startTime: Long,

    /**
     * The process id of the session.
     */
    val pid: Int = 0,
)
