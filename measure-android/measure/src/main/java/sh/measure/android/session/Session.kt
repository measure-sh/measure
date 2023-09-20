package sh.measure.android.session

import android.content.ContentValues
import kotlinx.serialization.json.Json
import sh.measure.android.storage.SessionContract

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
    val resource: Resource
) {
    fun toContentValues(synced: Boolean = false, crashed: Boolean = false): ContentValues {
        return ContentValues().apply {
            put(SessionContract.SessionTable.COLUMN_SESSION_ID, id)
            put(SessionContract.SessionTable.COLUMN_SESSION_START_TIME, startTime)
            put(SessionContract.SessionTable.COLUMN_RESOURCE, Json.encodeToString(Resource.serializer(), resource))
            put(SessionContract.SessionTable.COLUMN_SYNCED, synced)
            put(SessionContract.SessionTable.COLUMN_CRASHED, crashed)
        }
    }
}