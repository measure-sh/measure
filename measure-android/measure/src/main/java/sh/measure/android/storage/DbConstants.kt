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
    const val COL_DATA_SERIALIZED = "serialized_data"
    const val COL_ATTRIBUTES = "attributes"
    const val COL_ATTACHMENTS = "attachments"
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
    const val COL_NAME = "name"
}

internal object EventsBatchTable {
    const val TABLE_NAME = "events_batch"
    const val COL_EVENT_ID = "event_id"
    const val COL_BATCH_ID = "batch_id"
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
            ${EventTable.COL_ATTACHMENT_SIZE} INTEGER NOT NULL,
            ${EventTable.COL_ATTACHMENTS} TEXT DEFAULT NULL
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
            ${AttachmentTable.COL_NAME} TEXT DEFAULT NULL,
            FOREIGN KEY (${AttachmentTable.COL_EVENT_ID}) REFERENCES ${EventTable.TABLE_NAME}(${EventTable.COL_ID}) ON DELETE CASCADE
        )
    """

    const val CREATE_EVENTS_BATCH_TABLE = """
        CREATE TABLE ${EventsBatchTable.TABLE_NAME} (
            ${EventsBatchTable.COL_EVENT_ID} TEXT NOT NULL,
            ${EventsBatchTable.COL_BATCH_ID} TEXT NOT NULL,
            PRIMARY KEY (${EventsBatchTable.COL_EVENT_ID}, ${EventsBatchTable.COL_BATCH_ID}),
            FOREIGN KEY (${EventsBatchTable.COL_EVENT_ID}) REFERENCES ${EventTable.TABLE_NAME}(${EventTable.COL_ID}) ON DELETE CASCADE
        )
    """

    /**
     * Query to get a batch of events that are not yet batched.
     *
     * @param eventCount The number of events to fetch.
     * @param ascending Whether to fetch the oldest events first or the newest.
     */
    fun getEventsBatchQuery(eventCount: Int, ascending: Boolean): String {
        return """
            SELECT ${EventTable.COL_ID}, ${EventTable.COL_ATTACHMENT_SIZE} 
            FROM ${EventTable.TABLE_NAME}
            WHERE ${EventTable.COL_ID} NOT IN (
                SELECT ${EventsBatchTable.COL_EVENT_ID} FROM ${EventsBatchTable.TABLE_NAME}
            )
            ORDER BY ${EventTable.COL_TIMESTAMP} ${if (ascending) "ASC" else "DESC"}
            LIMIT $eventCount
        """
    }

    fun getEventsForIds(eventIds: List<String>): String {
        return """
            SELECT 
                ${EventTable.COL_ID},
                ${EventTable.COL_SESSION_ID},
                ${EventTable.COL_TIMESTAMP},
                ${EventTable.COL_TYPE},
                ${EventTable.COL_DATA_SERIALIZED},
                ${EventTable.COL_DATA_FILE_PATH},
                ${EventTable.COL_ATTACHMENTS},
                ${EventTable.COL_ATTRIBUTES}
            FROM ${EventTable.TABLE_NAME}
            WHERE ${EventTable.COL_ID} IN (${eventIds.joinToString(", ") { "\'$it\'" }})
        """.trimIndent()
    }

    fun getAttachmentsForEventIds(eventIds: List<String>): String {
        return """
            SELECT 
                ${AttachmentTable.COL_ID}, 
                ${AttachmentTable.COL_EVENT_ID},
                ${AttachmentTable.COL_TIMESTAMP},
                ${AttachmentTable.COL_TYPE},
                ${AttachmentTable.COL_FILE_PATH},
                ${AttachmentTable.COL_NAME}
            FROM ${AttachmentTable.TABLE_NAME}
            WHERE ${AttachmentTable.COL_EVENT_ID} IN (${eventIds.joinToString(", ") { "\'$it\'" }})
        """
    }
}
