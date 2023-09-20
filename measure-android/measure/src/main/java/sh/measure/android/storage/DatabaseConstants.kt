package sh.measure.android.storage

import sh.measure.android.storage.SessionContract.SignalsTable
import sh.measure.android.storage.SessionContract.SessionTable

internal object Database {
    const val DATABASE_NAME = "measure.db"
    const val DATABASE_VERSION = 1
}

internal object SessionContract {
    object SignalsTable {
        const val TABLE_NAME = "signals"
        const val COLUMN_SESSION_ID = "session_id"
        const val COLUMN_TIMESTAMP = "timestamp"
        const val COLUMN_SIGNAL_TYPE = "signal_type"
        const val COLUMN_DATA_TYPE = "data_type"
        const val COLUMN_DATA = "data"
    }

    object SessionTable {
        const val TABLE_NAME = "sessions"
        const val COLUMN_SESSION_ID = "session_id"
        const val COLUMN_SESSION_START_TIME = "session_start_time"
        const val COLUMN_RESOURCE = "resource"
        const val COLUMN_SYNCED = "synced"
        const val COLUMN_CRASHED = "crashed"
    }
}

internal object Sql {
    const val CREATE_SESSION_TABLE = """
        CREATE TABLE ${SessionTable.TABLE_NAME} (
            ${SessionTable.COLUMN_SESSION_ID} TEXT PRIMARY KEY NOT NULL,
            ${SessionTable.COLUMN_SESSION_START_TIME} TEXT NOT NULL,
            ${SessionTable.COLUMN_RESOURCE} TEXT NOT NULL,
            ${SessionTable.COLUMN_SYNCED} INTEGER NOT NULL,
            ${SessionTable.COLUMN_CRASHED} INTEGER NOT NULL
        )
    """

    const val CREATE_SIGNALS_TABLE = """
        CREATE TABLE ${SignalsTable.TABLE_NAME} (
            ${SignalsTable.COLUMN_SESSION_ID} TEXT PRIMARY KEY NOT NULL,
            ${SignalsTable.COLUMN_TIMESTAMP} TEXT NOT NULL,
            ${SignalsTable.COLUMN_SIGNAL_TYPE} TEXT NOT NULL,
            ${SignalsTable.COLUMN_DATA_TYPE} TEXT NOT NULL,
            ${SignalsTable.COLUMN_DATA} TEXT NOT NULL
        )
    """
}