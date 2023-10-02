package sh.measure.android.storage

internal object Database {
    const val DATABASE_NAME = "measure.db"
    const val DATABASE_VERSION = 1
}

internal object SessionDbConstants {
    object SessionTable {
        const val TABLE_NAME = "sessions"
        const val COLUMN_SESSION_ID = "session_id"
        const val COLUMN_SESSION_START_TIME = "session_start_time"
        const val COLUMN_SYNCED = "synced"
    }

    const val CREATE_SESSION_TABLE = """
        CREATE TABLE ${SessionTable.TABLE_NAME} (
            ${SessionTable.COLUMN_SESSION_ID} TEXT PRIMARY KEY NOT NULL,
            ${SessionTable.COLUMN_SESSION_START_TIME} TEXT NOT NULL,
            ${SessionTable.COLUMN_SYNCED} INTEGER NOT NULL
        )
    """
}
