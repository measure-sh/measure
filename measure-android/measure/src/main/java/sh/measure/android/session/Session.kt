package sh.measure.android.session

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
     * The resource associated with the session.
     */
    val resource: Resource,

    /**
     * Whether the session has been synced or not.
     */
    val synced: Boolean = false,
)