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
            ${EventTable.COL_ATTACHMENTS} TEXT DEFAULT NULL,
            FOREIGN KEY (${EventTable.COL_SESSION_ID}) REFERENCES ${SessionsTable.TABLE_NAME}(${SessionsTable.COL_SESSION_ID}) ON DELETE CASCADE
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
        eventTypeAllowList: List<String>,
    ): String {
        if (sessionId != null) {
            /**
             * ```sql
             * SELECT e.*
             * FROM events e
             * LEFT JOIN events_batch eb ON e.id = eb.event_id
             * WHERE eb.event_id IS NULL
             * AND e.session_id = '$sessionId'
             * ORDER BY e.timestamp ASC
             * LIMIT 100
             * ```
             */
            return """
                SELECT e.${EventTable.COL_ID}, e.${EventTable.COL_ATTACHMENT_SIZE} 
                FROM ${EventTable.TABLE_NAME} e
                LEFT JOIN ${EventsBatchTable.TABLE_NAME} eb ON e.${EventTable.COL_ID} = eb.${EventsBatchTable.COL_EVENT_ID}
                WHERE eb.${EventsBatchTable.COL_EVENT_ID} IS NULL
                AND e.${EventTable.COL_SESSION_ID} = '$sessionId'
                ORDER BY e.${EventTable.COL_TIMESTAMP} ${if (ascending) "ASC" else "DESC"}
                LIMIT $eventCount
            """.trimIndent()
        } else {
            /**
             * ```sql
             * SELECT e.*
             * FROM events e
             * LEFT JOIN events_batch eb ON e.id = eb.event_id
             * JOIN sessions s ON e.session_id = s.session_id
             * WHERE eb.event_id IS NULL
             * AND (
             *     e.type = 'cold_launch'
             *     OR (s.needs_reporting = 1)
             * )
             * LIMIT 100
             * ```
             */
            return """
                SELECT e.${EventTable.COL_ID}, e.${EventTable.COL_ATTACHMENT_SIZE} 
                FROM ${EventTable.TABLE_NAME} e
                LEFT JOIN ${EventsBatchTable.TABLE_NAME} eb ON e.${EventTable.COL_ID} = eb.${EventsBatchTable.COL_EVENT_ID}
                JOIN ${SessionsTable.TABLE_NAME} s ON e.${EventTable.COL_SESSION_ID} = s.${SessionsTable.COL_SESSION_ID}
                WHERE eb.${EventsBatchTable.COL_EVENT_ID} IS NULL
                AND (
                    e.${EventTable.COL_TYPE} IN (${eventTypeAllowList.joinToString(", ") { "'$it'" }})
                    OR (s.${SessionsTable.COL_NEEDS_REPORTING} = 1)
                )
                ORDER BY e.${EventTable.COL_TIMESTAMP} ${if (ascending) "ASC" else "DESC"}
                LIMIT $eventCount
            """.trimIndent()
        }
    }

    fun getBatches(maxCount: Int): String {
        return """
            WITH limited_batches AS (
                SELECT DISTINCT ${EventsBatchTable.COL_BATCH_ID}
                FROM ${EventsBatchTable.TABLE_NAME}
                ORDER BY ${EventsBatchTable.COL_CREATED_AT} ASC
                LIMIT $maxCount
            )
            SELECT 
                ${EventsBatchTable.COL_EVENT_ID},
                ${EventsBatchTable.COL_BATCH_ID}
            FROM ${EventsBatchTable.TABLE_NAME}
            WHERE ${EventsBatchTable.COL_BATCH_ID} IN (SELECT ${EventsBatchTable.COL_BATCH_ID} FROM limited_batches)
            ORDER BY ${EventsBatchTable.COL_CREATED_AT} ASC
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

    fun getEventsForSessions(sessions: List<String>): String? {
        if (sessions.isEmpty()) {
            return null
        }
        return """
            SELECT ${EventTable.COL_ID}
            FROM ${EventTable.TABLE_NAME}
            WHERE ${EventTable.COL_SESSION_ID} IN (${sessions.joinToString(", ") { "\'$it\'" }})
        """.trimIndent()
    }

    fun getAttachmentsForEvents(events: List<String>): String {
        return """
            SELECT ${AttachmentTable.COL_ID}
            FROM ${AttachmentTable.TABLE_NAME}
            WHERE ${AttachmentTable.COL_EVENT_ID} IN (${events.joinToString(", ") { "\'$it\'" }})
        """.trimIndent()
    }

    fun getSessions(needReporting: Boolean, filterSessions: List<String>, maxCount: Int): String {
        val reportingCondition =
            "${SessionsTable.COL_NEEDS_REPORTING} = ${if (needReporting) 1 else 0}"

        val filterCondition = if (filterSessions.isNotEmpty()) {
            val filteredSessionIds = filterSessions.joinToString(", ") { "'$it'" }
            "AND ${SessionsTable.COL_SESSION_ID} NOT IN ($filteredSessionIds)"
        } else {
            ""
        }

        return """
            SELECT ${SessionsTable.COL_SESSION_ID}
            FROM ${SessionsTable.TABLE_NAME}
            WHERE $reportingCondition
            $filterCondition
            LIMIT $maxCount
        """.trimIndent()
    }

    fun getOldestSession(): String {
        return """
            SELECT ${SessionsTable.COL_SESSION_ID}
            FROM ${SessionsTable.TABLE_NAME}
            ORDER BY ${SessionsTable.COL_CREATED_AT} ASC
            LIMIT 1
        """.trimIndent()
    }

    fun getEventsCount(): String {
        return """
            SELECT COUNT(${EventTable.COL_ID}) AS count
            FROM ${EventTable.TABLE_NAME}
        """.trimIndent()
    }
}
