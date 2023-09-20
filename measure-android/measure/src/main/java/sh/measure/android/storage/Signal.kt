package sh.measure.android.storage

import android.content.ContentValues
import sh.measure.android.storage.SessionContract.SignalsTable

/**
 * A signal is a piece of data that is collected by the SDK.
 * This represents the local storage schema for [sh.measure.android.storage.SessionContract.SignalsTable].
 */
internal data class Signal(
    /**
     * A unique identifier for the session that this signal is part of.
     */
    val sessionId: String,

    /**
     * The timestamp at which the signal was generated.
     */
    val timestamp: String,

    /**
     * The type of signal. For example: event, metric, trace, etc.
     */
    val signalType: String,

    /**
     * The type of data that this signal contains.
     * Example an "event" signal can be of type exception, gesture, etc.
     * Or, a "metric" signal can be of type cpu, memory, etc.
     * Or, a "trace" signal can be of type network, database_query, etc.
     */
    val dataType: String,

    /**
     * The serialized data collected for the signal.
     */
    val data: String
) {
    fun toContentValues(): ContentValues {
        return ContentValues().apply {
            put(SignalsTable.COLUMN_SESSION_ID, sessionId)
            put(SignalsTable.COLUMN_TIMESTAMP, timestamp)
            put(SignalsTable.COLUMN_SIGNAL_TYPE, signalType)
            put(SignalsTable.COLUMN_DATA_TYPE, dataType)
            put(SignalsTable.COLUMN_DATA, data)
        }
    }
}

