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
    const val COL_ATTRIBUTES = "attributes"
    const val COL_ATTACHMENT_SIZE = "attachments_size"
}

internal object AttachmentTable {
    const val TABLE_NAME = "attachments"
    const val COL_ID = "id"
    const val COL_EVENT_ID = "event_id"
    const val COL_TYPE = "type"
    const val COL_TIMESTAMP = "timestamp"
    const val COL_SESSION_ID = "session_id"
    const val COL_FILE_PATH = "file_path"
    const val COL_EXTENSION = "extension"
}

internal object Sql {
    const val CREATE_EVENTS_TABLE = """
        CREATE TABLE ${EventTable.TABLE_NAME} (
            ${EventTable.COL_ID} TEXT PRIMARY KEY,
            ${EventTable.COL_TYPE} TEXT NOT NULL,
            ${EventTable.COL_TIMESTAMP} INTEGER NOT NULL,
            ${EventTable.COL_SESSION_ID} TEXT NOT NULL,
            ${EventTable.COL_DATA_FILE_PATH} TEXT DEFAULT NULL,
            ${EventTable.COL_DATA_SERIALIZED} TEXT DEFAULT NULL,
            ${EventTable.COL_ATTRIBUTES} TEXT DEFAULT NULL,
            ${EventTable.COL_ATTACHMENT_SIZE} INTEGER NOT NULL
        )
    """

    const val CREATE_ATTACHMENTS_TABLE = """
        CREATE TABLE ${AttachmentTable.TABLE_NAME} (
            ${AttachmentTable.COL_ID} TEXT PRIMARY KEY,
            ${AttachmentTable.COL_EVENT_ID} TEXT NOT NULL,
            ${AttachmentTable.COL_TYPE} TEXT NOT NULL,
            ${AttachmentTable.COL_TIMESTAMP} INTEGER NOT NULL,
            ${AttachmentTable.COL_SESSION_ID} TEXT NOT NULL,
            ${AttachmentTable.COL_FILE_PATH} TEXT DEFAULT NULL,
            ${AttachmentTable.COL_EXTENSION} TEXT DEFAULT NULL,
            FOREIGN KEY (${AttachmentTable.COL_EVENT_ID}) REFERENCES ${EventTable.TABLE_NAME}(${EventTable.COL_ID}) ON DELETE CASCADE
        )
    """
}
