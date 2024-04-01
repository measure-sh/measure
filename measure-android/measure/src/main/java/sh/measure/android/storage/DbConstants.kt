package sh.measure.android.storage

internal object DbConstants {
    const val DATABASE_NAME = "measure.db"
    const val DATABASE_VERSION = 1
}

internal object EventTable {
    const val TABLE_NAME = "events"
    const val COL_ID = "id"
    const val COL_TYPE = "type"
    const val COL_TIMESTAMP = "timestamp"
    const val COL_SESSION_ID = "session_id"
    const val COL_DATA_FILE_PATH = "file_path"
    const val COL_DATA_SERIALIZED = "serialized"
}

internal object Sql {
    const val CREATE_EVENTS_TABLE = """
        CREATE TABLE ${EventTable.TABLE_NAME} (
            ${EventTable.COL_ID} TEXT PRIMARY KEY,
            ${EventTable.COL_TYPE} TEXT NOT NULL,
            ${EventTable.COL_TIMESTAMP} INTEGER NOT NULL,
            ${EventTable.COL_SESSION_ID} TEXT NOT NULL,
            ${EventTable.COL_DATA_FILE_PATH} TEXT DEFAULT NULL,
            ${EventTable.COL_DATA_SERIALIZED} TEXT DEFAULT NULL
        )
    """
}