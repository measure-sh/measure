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
    const val COL_USER_TRIGGERED = "user_triggered"
    const val COL_DATA_FILE_PATH = "file_path"
    const val COL_DATA_SERIALIZED = "serialized_data"
    const val COL_ATTRIBUTES = "attributes"
    const val COL_USER_DEFINED_ATTRIBUTES = "user_defined_attributes"
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
    const val COL_CREATED_AT = "created_at"
}

internal object SessionsTable {
    const val TABLE_NAME = "sessions"
    const val COL_SESSION_ID = "session_id"
    const val COL_PID = "pid"
    const val COL_CREATED_AT = "created_at"
    const val COL_APP_EXIT_TRACKED = "app_exit_tracked"
    const val COL_NEEDS_REPORTING = "needs_reporting"
    const val COL_CRASHED = "crashed"
}

internal object UserDefinedAttributesTable {
    const val TABLE_NAME = "user_defined_attributes"
    const val COL_KEY = "key"
    const val COL_VALUE = "value"
    const val COL_TYPE = "type"
}

internal object Sql {
    const val CREATE_EVENTS_TABLE = """
        CREATE TABLE ${EventTable.TABLE_NAME} (
            ${EventTable.COL_ID} TEXT PRIMARY KEY,
            ${EventTable.COL_TYPE} TEXT NOT NULL,
            ${EventTable.COL_TIMESTAMP} TEXT NOT NULL,
            ${EventTable.COL_SESSION_ID} TEXT NOT NULL,
            ${EventTable.COL_USER_TRIGGERED} INTEGER NOT NULL DEFAULT 0,
            ${EventTable.COL_DATA_FILE_PATH} TEXT DEFAULT NULL,
            ${EventTable.COL_DATA_SERIALIZED} TEXT DEFAULT NULL,
            ${EventTable.COL_ATTRIBUTES} TEXT DEFAULT NULL,
            ${EventTable.COL_USER_DEFINED_ATTRIBUTES} TEXT DEFAULT NULL,
            ${EventTable.COL_ATTACHMENT_SIZE} INTEGER NOT NULL,
            ${EventTable.COL_ATTACHMENTS} TEXT DEFAULT NULL
        )
    """

    const val CREATE_ATTACHMENTS_TABLE = """
        CREATE TABLE ${AttachmentTable.TABLE_NAME} (
            ${AttachmentTable.COL_ID} TEXT PRIMARY KEY,
            ${AttachmentTable.COL_EVENT_ID} TEXT NOT NULL,
            ${AttachmentTable.COL_TYPE} TEXT NOT NULL,
            ${AttachmentTable.COL_TIMESTAMP} TEXT NOT NULL,
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
            ${EventsBatchTable.COL_CREATED_AT} INTEGER NOT NULL,
            PRIMARY KEY (${EventsBatchTable.COL_EVENT_ID}, ${EventsBatchTable.COL_BATCH_ID}),
            FOREIGN KEY (${EventsBatchTable.COL_EVENT_ID}) REFERENCES ${EventTable.TABLE_NAME}(${EventTable.COL_ID}) ON DELETE CASCADE
        )
    """

    const val CREATE_SESSIONS_TABLE = """
        CREATE TABLE ${SessionsTable.TABLE_NAME} (
            ${SessionsTable.COL_SESSION_ID} TEXT PRIMARY KEY,
            ${SessionsTable.COL_PID} INTEGER NOT NULL,
            ${SessionsTable.COL_CREATED_AT} INTEGER NOT NULL,
            ${SessionsTable.COL_APP_EXIT_TRACKED} INTEGER DEFAULT 0,
            ${SessionsTable.COL_NEEDS_REPORTING} INTEGER DEFAULT 0,
            ${SessionsTable.COL_CRASHED} INTEGER DEFAULT 0
        )
    """

    const val CREATE_USER_DEFINED_ATTRIBUTES_TABLE = """
        CREATE TABLE ${UserDefinedAttributesTable.TABLE_NAME} (
            ${UserDefinedAttributesTable.COL_KEY} TEXT PRIMARY KEY,
            ${UserDefinedAttributesTable.COL_VALUE} TEXT,
            ${UserDefinedAttributesTable.COL_TYPE} TEXT NOT NULL
        )
    """

    /**
     * Query to get a batch of events that are not yet batched.
     *
     * @param eventCount The number of events to fetch.
     * @param ascending Whether to fetch the oldest events first or the newest.
     * @param sessionId The session ID for which the events should be returned, if not null. If null,
     * the sessions which need to be reported are considered.
     * @param eventTypeAllowList The list of event types to allow in the batch.
     */
    fun getEventsBatchQuery(
        eventCount: Int,
        ascending: Boolean,
        sessionId: String?,
        eventTypeAllowList: List<String>
    ): String {
        val sessionCondition = if (sessionId != null) {
            "AND ${EventTable.COL_SESSION_ID} = '$sessionId'"
        } else {
            """
            AND ${EventTable.COL_SESSION_ID} = (
                SELECT ${SessionsTable.COL_SESSION_ID} 
                FROM ${SessionsTable.TABLE_NAME} 
                WHERE ${SessionsTable.COL_NEEDS_REPORTING} = 1 
            )
        """.trimIndent()
        }

        val eventTypesAllowListCondition = if (eventTypeAllowList.isNotEmpty()) {
            eventTypeAllowList.joinToString(" OR ") {
                "${EventTable.COL_TYPE} = '$it'"
            }
        } else {
            null
        }

        return """
        SELECT 
            ${EventTable.COL_ID}, 
            ${EventTable.COL_ATTACHMENT_SIZE} 
        FROM 
            ${EventTable.TABLE_NAME}
        WHERE 
            (
                ${EventTable.COL_ID} NOT IN (
                    SELECT ${EventsBatchTable.COL_EVENT_ID} 
                    FROM ${EventsBatchTable.TABLE_NAME}
                )
                $sessionCondition
            )
            OR 
            (
                $eventTypesAllowListCondition
            )
        ORDER BY 
            datetime(${EventTable.COL_TIMESTAMP}) ${if (ascending) "ASC" else "DESC"}
        LIMIT 
            $eventCount
    """.trimIndent()
    }
    fun getBatches(maxCount: Int): String {
        return """
            SELECT 
                ${EventsBatchTable.COL_EVENT_ID},
                ${EventsBatchTable.COL_BATCH_ID}
            FROM ${EventsBatchTable.TABLE_NAME}
            ORDER BY ${EventsBatchTable.COL_CREATED_AT} ASC
            LIMIT $maxCount
        """.trimIndent()
    }

    fun getEventsForIds(eventIds: List<String>): String {
        return """
            SELECT 
                ${EventTable.COL_ID},
                ${EventTable.COL_SESSION_ID},
                ${EventTable.COL_TIMESTAMP},
                ${EventTable.COL_TYPE},
                ${EventTable.COL_USER_TRIGGERED},
                ${EventTable.COL_DATA_SERIALIZED},
                ${EventTable.COL_DATA_FILE_PATH},
                ${EventTable.COL_ATTACHMENTS},
                ${EventTable.COL_ATTRIBUTES},
                ${EventTable.COL_USER_DEFINED_ATTRIBUTES},
                ${EventTable.COL_ATTACHMENT_SIZE},
                ${EventTable.COL_ATTACHMENTS}
            FROM ${EventTable.TABLE_NAME}
            WHERE ${EventTable.COL_ID} IN (${eventIds.joinToString(", ") { "\'$it\'" }})
        """.trimIndent()
    }

    fun getEventForId(eventId: String): String {
        return """
            SELECT 
                ${EventTable.COL_ID},
                ${EventTable.COL_SESSION_ID},
                ${EventTable.COL_TIMESTAMP},
                ${EventTable.COL_TYPE},
                ${EventTable.COL_USER_TRIGGERED},
                ${EventTable.COL_DATA_SERIALIZED},
                ${EventTable.COL_DATA_FILE_PATH},
                ${EventTable.COL_ATTACHMENTS},
                ${EventTable.COL_ATTRIBUTES},
                ${EventTable.COL_USER_DEFINED_ATTRIBUTES}
            FROM ${EventTable.TABLE_NAME}
            WHERE ${EventTable.COL_ID} = '$eventId'
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

    fun getAttachmentsForEventId(eventId: String): String {
        return """
            SELECT 
                ${AttachmentTable.COL_ID}, 
                ${AttachmentTable.COL_EVENT_ID},
                ${AttachmentTable.COL_TIMESTAMP},
                ${AttachmentTable.COL_TYPE},
                ${AttachmentTable.COL_FILE_PATH},
                ${AttachmentTable.COL_NAME}
            FROM ${AttachmentTable.TABLE_NAME}
            WHERE ${AttachmentTable.COL_EVENT_ID} = '$eventId'
        """
    }

    fun getSessionsWithUntrackedAppExit(): String {
        return """
            SELECT
                ${SessionsTable.COL_SESSION_ID},
                ${SessionsTable.COL_PID}
            FROM ${SessionsTable.TABLE_NAME}
            WHERE ${SessionsTable.COL_APP_EXIT_TRACKED} = 0
            ORDER BY ${SessionsTable.COL_CREATED_AT} ASC
        """.trimIndent()
    }

    fun updateAppExitTracked(pid: Int): String {
        return """
            UPDATE ${SessionsTable.TABLE_NAME}
            SET ${SessionsTable.COL_APP_EXIT_TRACKED} = 1
            WHERE ${SessionsTable.COL_PID} = $pid
        """.trimIndent()
    }

    fun getUserDefinedAttributes(): String {
        return """
            SELECT 
                ${UserDefinedAttributesTable.COL_KEY}, 
                ${UserDefinedAttributesTable.COL_VALUE}, 
                ${UserDefinedAttributesTable.COL_TYPE}
            FROM ${UserDefinedAttributesTable.TABLE_NAME}
        """.trimIndent()
    }

    fun markSessionCrashed(sessionId: String): String {
        return """
            UPDATE ${SessionsTable.TABLE_NAME}
            SET ${SessionsTable.COL_CRASHED} = 1, ${SessionsTable.COL_NEEDS_REPORTING} = 1
            WHERE ${SessionsTable.COL_SESSION_ID} = '$sessionId'
        """.trimIndent()
    }

    fun markSessionsCrashed(sessionIds: List<String>): String {
        return """
            UPDATE ${SessionsTable.TABLE_NAME}
            SET ${SessionsTable.COL_CRASHED} = 1, ${SessionsTable.COL_NEEDS_REPORTING} = 1
            WHERE ${SessionsTable.COL_SESSION_ID} IN (${sessionIds.joinToString(", ") { "\'$it\'" }})
        """.trimIndent()
    }

    fun getEvents(): String {
        return """
            SELECT 
                ${EventTable.COL_ID},
                ${EventTable.COL_SESSION_ID},
                ${EventTable.COL_TIMESTAMP},
                ${EventTable.COL_TYPE},
                ${EventTable.COL_USER_TRIGGERED},
                ${EventTable.COL_DATA_SERIALIZED},
                ${EventTable.COL_DATA_FILE_PATH},
                ${EventTable.COL_ATTACHMENTS},
                ${EventTable.COL_ATTACHMENT_SIZE},
                ${EventTable.COL_ATTRIBUTES},
                ${EventTable.COL_USER_DEFINED_ATTRIBUTES}
            FROM ${EventTable.TABLE_NAME}
        """.trimIndent()
    }
}
