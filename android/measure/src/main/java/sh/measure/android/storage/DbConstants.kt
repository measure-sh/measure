package sh.measure.android.storage

internal object DbConstants {
    const val DATABASE_NAME = "measure.db"
    const val DATABASE_VERSION = DbVersion.V3
}

internal object DbVersion {
    const val V1 = 1
    const val V2 = 2
    const val V3 = 3
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

internal object BatchesTable {
    const val TABLE_NAME = "batches"
    const val COL_BATCH_ID = "batch_id"
    const val COL_CREATED_AT = "created_at"
}

internal object EventsBatchTable {
    const val TABLE_NAME = "events_batch"
    const val COL_EVENT_ID = "event_id"
    const val COL_BATCH_ID = "batch_id"
    const val COL_CREATED_AT = "created_at"
}

internal object SpansBatchTable {
    const val TABLE_NAME = "spans_batch"
    const val COL_SPAN_ID = "span_id"
    const val COL_BATCH_ID = "batch_id"
    const val COL_CREATED_AT = "created_at"
}

internal object SessionsTable {
    const val TABLE_NAME = "sessions"
    const val COL_SESSION_ID = "session_id"

    @Deprecated("Use AppExitTable instead")
    const val COL_PID = "pid"
    const val COL_CREATED_AT = "created_at"

    @Deprecated("Use AppExitTable instead")
    const val COL_APP_EXIT_TRACKED = "app_exit_tracked"
    const val COL_NEEDS_REPORTING = "needs_reporting"
    const val COL_CRASHED = "crashed"
}

internal object AppExitTable {
    const val TABLE_NAME = "app_exit"
    const val COL_SESSION_ID = "session_id"
    const val COL_PID = "pid"
    const val COL_CREATED_AT = "created_at"
}

internal object SpansTable {
    const val TABLE_NAME = "spans"
    const val COL_NAME = "name"
    const val COL_SESSION_ID = "session_id"
    const val COL_SPAN_ID = "span_id"
    const val COL_TRACE_ID = "trace_id"
    const val COL_PARENT_ID = "parent_id"
    const val COL_START_TIME = "start_time"
    const val COL_END_TIME = "end_time"
    const val COL_DURATION = "duration"
    const val COL_STATUS = "status"
    const val COL_SERIALIZED_ATTRS = "serialized_attrs"
    const val COL_SERIALIZED_USER_DEFINED_ATTRS = "user_defined_attributes"
    const val COL_SERIALIZED_SPAN_EVENTS = "serialized_span_events"
    const val COL_SAMPLED = "sampled"
}

internal object Sql {
    const val CREATE_EVENTS_TABLE = """
        CREATE TABLE IF NOT EXISTS ${EventTable.TABLE_NAME} (
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

    const val CREATE_EVENTS_TIMESTAMP_INDEX = """
        CREATE INDEX IF NOT EXISTS events_timestamp_index ON ${EventTable.TABLE_NAME} (${EventTable.COL_TIMESTAMP})
    """

    const val CREATE_EVENTS_SESSION_ID_INDEX = """
        CREATE INDEX IF NOT EXISTS events_session_id_index ON ${EventTable.TABLE_NAME} (${EventTable.COL_SESSION_ID})
    """

    const val CREATE_ATTACHMENTS_TABLE = """
        CREATE TABLE IF NOT EXISTS ${AttachmentTable.TABLE_NAME} (
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

    const val CREATE_BATCHES_TABLE = """
        CREATE TABLE IF NOT EXISTS ${BatchesTable.TABLE_NAME} (
            ${BatchesTable.COL_BATCH_ID} TEXT PRIMARY KEY,
            ${BatchesTable.COL_CREATED_AT} INTEGER NOT NULL
        )
    """

    const val CREATE_EVENTS_BATCH_TABLE = """
        CREATE TABLE IF NOT EXISTS ${EventsBatchTable.TABLE_NAME} (
            ${EventsBatchTable.COL_EVENT_ID} TEXT NOT NULL,
            ${EventsBatchTable.COL_BATCH_ID} TEXT NOT NULL,
            ${EventsBatchTable.COL_CREATED_AT} INTEGER NOT NULL,
            PRIMARY KEY (${EventsBatchTable.COL_EVENT_ID}, ${EventsBatchTable.COL_BATCH_ID}),
            FOREIGN KEY (${EventsBatchTable.COL_EVENT_ID}) REFERENCES ${EventTable.TABLE_NAME}(${EventTable.COL_ID}) ON DELETE CASCADE
        )
    """

    const val CREATE_EVENTS_BATCH_EVENT_ID_INDEX = """
        CREATE INDEX IF NOT EXISTS events_batch_event_id_index ON ${EventsBatchTable.TABLE_NAME} (${EventsBatchTable.COL_EVENT_ID})
    """

    const val CREATE_SPANS_BATCH_TABLE = """
        CREATE TABLE IF NOT EXISTS ${SpansBatchTable.TABLE_NAME} (
            ${SpansBatchTable.COL_SPAN_ID} TEXT NOT NULL,
            ${SpansBatchTable.COL_BATCH_ID} TEXT NOT NULL,
            ${SpansBatchTable.COL_CREATED_AT} INTEGER NOT NULL,
            PRIMARY KEY (${SpansBatchTable.COL_SPAN_ID}, ${SpansBatchTable.COL_BATCH_ID}),
            FOREIGN KEY (${SpansBatchTable.COL_SPAN_ID}) REFERENCES ${SpansTable.TABLE_NAME}(${SpansTable.COL_SPAN_ID}) ON DELETE CASCADE
        )
    """

    const val CREATE_SESSIONS_TABLE = """
        CREATE TABLE IF NOT EXISTS ${SessionsTable.TABLE_NAME} (
            ${SessionsTable.COL_SESSION_ID} TEXT PRIMARY KEY,
            ${SessionsTable.COL_PID} INTEGER NOT NULL,
            ${SessionsTable.COL_CREATED_AT} INTEGER NOT NULL,
            ${SessionsTable.COL_APP_EXIT_TRACKED} INTEGER DEFAULT 0,
            ${SessionsTable.COL_NEEDS_REPORTING} INTEGER DEFAULT 0,
            ${SessionsTable.COL_CRASHED} INTEGER DEFAULT 0
        )
    """

    const val CREATE_APP_EXIT_TABLE = """
        CREATE TABLE IF NOT EXISTS ${AppExitTable.TABLE_NAME} (
            ${AppExitTable.COL_SESSION_ID} TEXT NOT NULL,
            ${AppExitTable.COL_PID} INTEGER NOT NULL,
            ${AppExitTable.COL_CREATED_AT} INTEGER NOT NULL,
            PRIMARY KEY (${AppExitTable.COL_SESSION_ID}, ${AppExitTable.COL_PID})
        )
    """

    const val CREATE_SPANS_TABLE = """
        CREATE TABLE IF NOT EXISTS ${SpansTable.TABLE_NAME} (
            ${SpansTable.COL_SPAN_ID} TEXT NOT NULL PRIMARY KEY,
            ${SpansTable.COL_NAME} TEXT NOT NULL,
            ${SpansTable.COL_SESSION_ID} TEXT NOT NULL,
            ${SpansTable.COL_TRACE_ID} TEXT NOT NULL,
            ${SpansTable.COL_PARENT_ID} TEXT,
            ${SpansTable.COL_START_TIME} INTEGER NOT NULL,
            ${SpansTable.COL_END_TIME} INTEGER NOT NULL,
            ${SpansTable.COL_DURATION} INTEGER NOT NULL,
            ${SpansTable.COL_STATUS} TEXT NOT NULL,
            ${SpansTable.COL_SERIALIZED_ATTRS} TEXT,
            ${SpansTable.COL_SERIALIZED_USER_DEFINED_ATTRS} TEXT,
            ${SpansTable.COL_SERIALIZED_SPAN_EVENTS} TEXT,
            ${SpansTable.COL_SAMPLED} INTEGER DEFAULT 0,
            FOREIGN KEY (${SpansTable.COL_SESSION_ID}) REFERENCES ${SessionsTable.TABLE_NAME}(${SessionsTable.COL_SESSION_ID}) ON DELETE CASCADE
        )
    """

    const val CREATE_SESSIONS_CREATED_AT_INDEX = """
        CREATE INDEX IF NOT EXISTS sessions_created_at_index ON ${SessionsTable.TABLE_NAME} (${SessionsTable.COL_CREATED_AT})
    """

    const val CREATE_SESSIONS_NEEDS_REPORTING_INDEX = """
        CREATE INDEX IF NOT EXISTS sessions_needs_reporting_index ON ${SessionsTable.TABLE_NAME} (${SessionsTable.COL_NEEDS_REPORTING})
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

    fun getSpansBatchQuery(spanCount: Int, ascending: Boolean): String {
        return """
            SELECT sp.${SpansTable.COL_SPAN_ID} 
            FROM ${SpansTable.TABLE_NAME} sp
            LEFT JOIN ${SpansBatchTable.TABLE_NAME} sb ON sp.${SpansTable.COL_SPAN_ID} = sb.${SpansBatchTable.COL_SPAN_ID}
            JOIN ${SessionsTable.TABLE_NAME} s ON sp.${SpansTable.COL_SESSION_ID} = s.${SessionsTable.COL_SESSION_ID}
            WHERE sb.${SpansBatchTable.COL_SPAN_ID} IS NULL
            AND sp.${SpansTable.COL_SAMPLED} = 1
            ORDER BY sp.${SpansTable.COL_END_TIME} ${if (ascending) "ASC" else "DESC"}
            LIMIT $spanCount
        """.trimIndent()
    }

    fun getBatches(maxCount: Int): String {
        return """
            SELECT DISTINCT ${BatchesTable.COL_BATCH_ID}
            FROM ${BatchesTable.TABLE_NAME}
            ORDER BY ${BatchesTable.COL_CREATED_AT} ASC
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

    fun getSpansForIds(spanIds: List<String>): String {
        return """
            SELECT 
                ${SpansTable.COL_NAME},
                ${SpansTable.COL_SESSION_ID},
                ${SpansTable.COL_SPAN_ID},
                ${SpansTable.COL_TRACE_ID},
                ${SpansTable.COL_PARENT_ID},
                ${SpansTable.COL_START_TIME},
                ${SpansTable.COL_END_TIME},
                ${SpansTable.COL_DURATION},
                ${SpansTable.COL_STATUS},
                ${SpansTable.COL_SERIALIZED_ATTRS},
                ${SpansTable.COL_SERIALIZED_SPAN_EVENTS},
                ${SpansTable.COL_SERIALIZED_USER_DEFINED_ATTRS}
            FROM ${SpansTable.TABLE_NAME}
            WHERE ${SpansTable.COL_SPAN_ID} IN (${spanIds.joinToString(", ") { "\'$it\'" }})
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

    fun markSessionCrashed(sessionId: String): String {
        return """
            UPDATE ${SessionsTable.TABLE_NAME}
            SET ${SessionsTable.COL_CRASHED} = 1, ${SessionsTable.COL_NEEDS_REPORTING} = 1
            WHERE ${SessionsTable.COL_SESSION_ID} = '$sessionId'
        """.trimIndent()
    }

    fun markSessionWithBugReport(sessionId: String): String {
        return """
            UPDATE ${SessionsTable.TABLE_NAME}
            SET ${SessionsTable.COL_NEEDS_REPORTING} = 1
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

    fun getEventsForSessions(sessions: List<String>): String {
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

    fun getSpansCount(): String {
        return """
            SELECT COUNT(${SpansTable.COL_SPAN_ID}) AS count
            FROM ${SpansTable.TABLE_NAME}
        """.trimIndent()
    }

    fun getSessionForAppExit(pid: Int): String {
        return """
            SELECT
                ${AppExitTable.COL_SESSION_ID},
                ${AppExitTable.COL_CREATED_AT}
            FROM ${AppExitTable.TABLE_NAME}
            WHERE ${AppExitTable.COL_PID} = $pid 
            ORDER BY ${AppExitTable.COL_CREATED_AT} DESC
            LIMIT 1
        """.trimIndent()
    }

    fun getBatchedEventIds(batchIds: List<String>): String {
        return """
            SELECT
                ${EventsBatchTable.COL_EVENT_ID},
                ${EventsBatchTable.COL_BATCH_ID}
            FROM
                ${EventsBatchTable.TABLE_NAME}
            WHERE
                ${EventsBatchTable.COL_BATCH_ID} 
                IN (${batchIds.joinToString(", ") { "'$it'" }})
        """.trimIndent()
    }

    fun getBatchedSpanIds(batchIds: List<String>): String {
        return """
            SELECT
                ${SpansBatchTable.COL_SPAN_ID},
                ${SpansBatchTable.COL_BATCH_ID}
            FROM
                ${SpansBatchTable.TABLE_NAME}
            WHERE
                ${SpansBatchTable.COL_BATCH_ID} 
                IN (${batchIds.joinToString(", ") { "'$it'" }})
        """.trimIndent()
    }
}
