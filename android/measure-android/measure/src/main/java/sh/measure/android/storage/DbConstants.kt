package sh.measure.android.storage

import sh.measure.android.events.AttachmentType

internal object DbConstants {
    const val DATABASE_NAME = "measure.db"
    const val DATABASE_VERSION = DbVersion.V9
}

internal object DbVersion {
    const val V1 = 1
    const val V2 = 2
    const val V3 = 3
    const val V4 = 4
    const val V5 = 5
    const val V6 = 6
    const val V7 = 7
    const val V8 = 8
    const val V9 = 9
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
    const val COL_SAMPLED = "sampled"
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

internal object AttachmentV1Table {
    const val TABLE_NAME = "attachments_v1"
    const val COL_ID = "id"
    const val COL_EVENT_ID = "event_id"
    const val COL_TYPE = "type"
    const val COL_TIMESTAMP = "timestamp"
    const val COL_SESSION_ID = "session_id"
    const val COL_FILE_PATH = "file_path"
    const val COL_UPLOAD_URL = "url"
    const val COL_URL_EXPIRES_AT = "url_expires_at"
    const val COL_URL_HEADERS = "headers"
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
    const val COL_PID = "pid"
    const val COL_CREATED_AT = "created_at"
    const val COL_APP_EXIT_TRACKED = "app_exit_tracked"
    const val COL_PRIORITY_SESSION = "needs_reporting"
    const val COL_APP_VERSION = "app_version"
    const val COL_APP_BUILD = "app_build"
    const val COL_LAST_ANR_TIME = "last_anr_time"

    @Deprecated("No longer used")
    const val COL_CRASHED = "crashed"

    @Deprecated("No longer used")
    const val COL_TRACK_JOURNEY = "track_journey"
}

/**
 * Dropped in [DbVersion.V8]; referenced only by migrations.
 */
internal object AppExitTable {
    const val TABLE_NAME = "app_exit"
    const val COL_SESSION_ID = "session_id"
    const val COL_PID = "pid"
    const val COL_CREATED_AT = "created_at"
    const val COL_APP_BUILD = "app_build"
    const val COL_APP_VERSION = "app_version"
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
            ${EventTable.COL_SAMPLED} INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (${EventTable.COL_SESSION_ID}) REFERENCES ${SessionsTable.TABLE_NAME}(${SessionsTable.COL_SESSION_ID}) ON DELETE CASCADE
        )
    """

    const val CREATE_ATTACHMENTS_V1_TABLE = """
        CREATE TABLE IF NOT EXISTS ${AttachmentV1Table.TABLE_NAME} (
            ${AttachmentV1Table.COL_ID} TEXT PRIMARY KEY,
            ${AttachmentV1Table.COL_SESSION_ID} TEXT NOT NULL,
            ${AttachmentV1Table.COL_EVENT_ID} TEXT NOT NULL,
            ${AttachmentV1Table.COL_TYPE} TEXT NOT NULL,
            ${AttachmentV1Table.COL_TIMESTAMP} TEXT NOT NULL,
            ${AttachmentV1Table.COL_FILE_PATH} TEXT DEFAULT NULL,
            ${AttachmentV1Table.COL_NAME} TEXT DEFAULT NULL,
            ${AttachmentV1Table.COL_UPLOAD_URL} TEXT DEFAULT NULL,
            ${AttachmentV1Table.COL_URL_EXPIRES_AT} TEXT DEFAULT NULL,
            ${AttachmentV1Table.COL_URL_HEADERS} TEXT DEFAULT NULL,
            FOREIGN KEY (${AttachmentV1Table.COL_SESSION_ID}) REFERENCES ${SessionsTable.TABLE_NAME}(${SessionsTable.COL_SESSION_ID}) ON DELETE CASCADE
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
            ${SessionsTable.COL_PRIORITY_SESSION} INTEGER DEFAULT 0,
            ${SessionsTable.COL_CRASHED} INTEGER DEFAULT 0,
            ${SessionsTable.COL_TRACK_JOURNEY} INTEGER DEFAULT 0,
            ${SessionsTable.COL_APP_VERSION} TEXT DEFAULT NULL,
            ${SessionsTable.COL_APP_BUILD} TEXT DEFAULT NULL,
            ${SessionsTable.COL_LAST_ANR_TIME} INTEGER DEFAULT NULL
        )
    """

    const val CREATE_APP_EXIT_TABLE = """
        CREATE TABLE IF NOT EXISTS ${AppExitTable.TABLE_NAME} (
            ${AppExitTable.COL_SESSION_ID} TEXT NOT NULL,
            ${AppExitTable.COL_PID} INTEGER NOT NULL,
            ${AppExitTable.COL_CREATED_AT} INTEGER NOT NULL,
            ${AppExitTable.COL_APP_BUILD} TEXT,
            ${AppExitTable.COL_APP_VERSION} TEXT,
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

    const val CREATE_EVENTS_TIMESTAMP_INDEX = """
        CREATE INDEX IF NOT EXISTS events_timestamp_index ON ${EventTable.TABLE_NAME} (${EventTable.COL_TIMESTAMP})
    """

    const val CREATE_EVENTS_SESSION_ID_INDEX = """
        CREATE INDEX IF NOT EXISTS events_session_id_index ON ${EventTable.TABLE_NAME} (${EventTable.COL_SESSION_ID})
    """

    const val CREATE_EVENTS_BATCH_EVENT_ID_INDEX = """
        CREATE INDEX IF NOT EXISTS events_batch_event_id_index ON ${EventsBatchTable.TABLE_NAME} (${EventsBatchTable.COL_EVENT_ID})
    """

    const val CREATE_SESSIONS_CREATED_AT_INDEX = """
        CREATE INDEX IF NOT EXISTS sessions_created_at_index ON ${SessionsTable.TABLE_NAME} (${SessionsTable.COL_CREATED_AT})
    """

    const val CREATE_SPANS_SESSION_SAMPLED_INDEX = """
        CREATE INDEX IF NOT EXISTS idx_spans_session_sampled_starttime 
        ON ${SpansTable.TABLE_NAME}(${SpansTable.COL_SESSION_ID}, ${SpansTable.COL_SAMPLED}, ${SpansTable.COL_START_TIME})
    """

    const val CREATE_SPANS_BATCH_SPAN_ID_INDEX = """
        CREATE INDEX IF NOT EXISTS idx_spans_batch_span_id 
        ON ${SpansBatchTable.TABLE_NAME}(${SpansBatchTable.COL_SPAN_ID})
    """

    const val CREATE_SESSIONS_PID_INDEX = """
        CREATE INDEX IF NOT EXISTS sessions_pid_created_at_index
        ON ${SessionsTable.TABLE_NAME}(${SessionsTable.COL_PID}, ${SessionsTable.COL_CREATED_AT} DESC)
    """

    const val INSERT_EVENT = """
        INSERT INTO ${EventTable.TABLE_NAME} (
            ${EventTable.COL_ID},
            ${EventTable.COL_TYPE},
            ${EventTable.COL_TIMESTAMP},
            ${EventTable.COL_SESSION_ID},
            ${EventTable.COL_USER_TRIGGERED},
            ${EventTable.COL_DATA_FILE_PATH},
            ${EventTable.COL_DATA_SERIALIZED},
            ${EventTable.COL_ATTRIBUTES},
            ${EventTable.COL_USER_DEFINED_ATTRIBUTES},
            ${EventTable.COL_ATTACHMENT_SIZE},
            ${EventTable.COL_ATTACHMENTS},
            ${EventTable.COL_SAMPLED}
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """

    const val INSERT_ATTACHMENT = """
        INSERT INTO ${AttachmentV1Table.TABLE_NAME} (
            ${AttachmentV1Table.COL_ID},
            ${AttachmentV1Table.COL_EVENT_ID},
            ${AttachmentV1Table.COL_TYPE},
            ${AttachmentV1Table.COL_TIMESTAMP},
            ${AttachmentV1Table.COL_SESSION_ID},
            ${AttachmentV1Table.COL_FILE_PATH},
            ${AttachmentV1Table.COL_NAME}
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    """

    const val INSERT_SPAN = """
        INSERT INTO ${SpansTable.TABLE_NAME} (
            ${SpansTable.COL_NAME},
            ${SpansTable.COL_SESSION_ID},
            ${SpansTable.COL_SPAN_ID},
            ${SpansTable.COL_TRACE_ID},
            ${SpansTable.COL_PARENT_ID},
            ${SpansTable.COL_START_TIME},
            ${SpansTable.COL_END_TIME},
            ${SpansTable.COL_DURATION},
            ${SpansTable.COL_SERIALIZED_ATTRS},
            ${SpansTable.COL_SERIALIZED_USER_DEFINED_ATTRS},
            ${SpansTable.COL_SERIALIZED_SPAN_EVENTS},
            ${SpansTable.COL_SAMPLED},
            ${SpansTable.COL_STATUS}
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """

    const val INSERT_SPANS_BATCH = """
        INSERT INTO ${SpansBatchTable.TABLE_NAME} (
            ${SpansBatchTable.COL_SPAN_ID},
            ${SpansBatchTable.COL_BATCH_ID},
            ${SpansBatchTable.COL_CREATED_AT}
        ) VALUES (?, ?, ?)
    """

    const val INSERT_EVENTS_BATCH = """
        INSERT INTO ${EventsBatchTable.TABLE_NAME} (
            ${EventsBatchTable.COL_EVENT_ID},
            ${EventsBatchTable.COL_BATCH_ID},
            ${EventsBatchTable.COL_CREATED_AT}
        ) VALUES (?, ?, ?)
    """

    private fun placeholders(count: Int): String = List(count) { "?" }.joinToString(", ")

    fun getEventsForIds(count: Int): String = """
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
            WHERE ${EventTable.COL_ID} IN (${placeholders(count)})
    """.trimIndent()

    fun getSpansForIds(count: Int): String = """
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
            WHERE ${SpansTable.COL_SPAN_ID} IN (${placeholders(count)})
    """.trimIndent()

    val getEventsForSession: String = """
            SELECT ${EventTable.COL_ID}
            FROM ${EventTable.TABLE_NAME}
            WHERE ${EventTable.COL_SESSION_ID} = ?
    """.trimIndent()

    fun getAttachmentsForEvents(count: Int): String = """
            SELECT ${AttachmentV1Table.COL_ID}
            FROM ${AttachmentV1Table.TABLE_NAME}
            WHERE ${AttachmentV1Table.COL_EVENT_ID} IN (${placeholders(count)})
    """.trimIndent()

    val getRecentSessionIds: String = """
            SELECT ${SessionsTable.COL_SESSION_ID}
            FROM ${SessionsTable.TABLE_NAME}
            ORDER BY ${SessionsTable.COL_CREATED_AT} DESC
            LIMIT ?
    """.trimIndent()

    val getOldestSessionWithSignals: String = """
            SELECT ${SessionsTable.COL_SESSION_ID}
            FROM ${SessionsTable.TABLE_NAME}
            WHERE EXISTS (
                SELECT 1 FROM ${EventTable.TABLE_NAME}
                WHERE ${EventTable.TABLE_NAME}.${EventTable.COL_SESSION_ID} = ${SessionsTable.TABLE_NAME}.${SessionsTable.COL_SESSION_ID}
            ) OR EXISTS (
                SELECT 1 FROM ${SpansTable.TABLE_NAME}
                WHERE ${SpansTable.TABLE_NAME}.${SpansTable.COL_SESSION_ID} = ${SessionsTable.TABLE_NAME}.${SessionsTable.COL_SESSION_ID}
            )
            ORDER BY ${SessionsTable.COL_CREATED_AT} ASC
            LIMIT 1
    """.trimIndent()

    val getEventsCount: String = """
            SELECT COUNT(${EventTable.COL_ID}) AS count
            FROM ${EventTable.TABLE_NAME}
    """.trimIndent()

    val getEventsCountForSession: String = """
            SELECT COUNT(${EventTable.COL_ID}) AS count
            FROM ${EventTable.TABLE_NAME}
            WHERE ${EventTable.COL_SESSION_ID} = ?
    """.trimIndent()

    val getSpansCountForSession: String = """
            SELECT COUNT(${SpansTable.COL_SPAN_ID}) AS count
            FROM ${SpansTable.TABLE_NAME}
            WHERE ${SpansTable.COL_SESSION_ID} = ?
    """.trimIndent()

    val getSpansCount: String = """
            SELECT COUNT(${SpansTable.COL_SPAN_ID}) AS count
            FROM ${SpansTable.TABLE_NAME}
    """.trimIndent()

    // Columns read into a SessionRecord; all getSessionFor* queries select these.
    private val SESSION_RECORD_COLUMNS = listOf(
        SessionsTable.COL_SESSION_ID,
        SessionsTable.COL_CREATED_AT,
        SessionsTable.COL_APP_VERSION,
        SessionsTable.COL_APP_BUILD,
        SessionsTable.COL_LAST_ANR_TIME,
    ).joinToString(", ")

    val getSessionForAppExit: String = """
            SELECT $SESSION_RECORD_COLUMNS
            FROM ${SessionsTable.TABLE_NAME}
            WHERE ${SessionsTable.COL_PID} = ? AND ${SessionsTable.COL_APP_EXIT_TRACKED} = 0
            ORDER BY ${SessionsTable.COL_CREATED_AT} DESC
            LIMIT 1
    """.trimIndent()

    val getSessionForTime: String = """
            SELECT $SESSION_RECORD_COLUMNS
            FROM ${SessionsTable.TABLE_NAME}
            WHERE ${SessionsTable.COL_CREATED_AT} <= ?
            ORDER BY ${SessionsTable.COL_CREATED_AT} DESC
            LIMIT 1
    """.trimIndent()

    val getSessionForAnr: String = """
            SELECT $SESSION_RECORD_COLUMNS
            FROM ${SessionsTable.TABLE_NAME}
            WHERE ${SessionsTable.COL_LAST_ANR_TIME} IS NOT NULL
                AND ${SessionsTable.COL_LAST_ANR_TIME} <= ?
                AND ${SessionsTable.COL_LAST_ANR_TIME} >= ? - ?
            ORDER BY ${SessionsTable.COL_LAST_ANR_TIME} DESC
            LIMIT 1
    """.trimIndent()

    val setSessionAnrTime: String = """
            UPDATE ${SessionsTable.TABLE_NAME}
            SET ${SessionsTable.COL_LAST_ANR_TIME} = ?
            WHERE ${SessionsTable.COL_SESSION_ID} = ?
                AND (${SessionsTable.COL_LAST_ANR_TIME} IS NULL OR ${SessionsTable.COL_LAST_ANR_TIME} < ?)
    """.trimIndent()

    fun getBatchedEventIds(count: Int): String = """
            SELECT
                ${EventsBatchTable.COL_EVENT_ID},
                ${EventsBatchTable.COL_BATCH_ID}
            FROM
                ${EventsBatchTable.TABLE_NAME}
            WHERE
                ${EventsBatchTable.COL_BATCH_ID}
                IN (${placeholders(count)})
    """.trimIndent()

    fun getBatchedSpanIds(count: Int): String = """
            SELECT
                ${SpansBatchTable.COL_SPAN_ID},
                ${SpansBatchTable.COL_BATCH_ID}
            FROM
                ${SpansBatchTable.TABLE_NAME}
            WHERE
                ${SpansBatchTable.COL_BATCH_ID}
                IN (${placeholders(count)})
    """.trimIndent()

    private val profileTypesList = listOf(
        AttachmentType.PERFETTO_TRACE,
        AttachmentType.HEAP_DUMP,
        AttachmentType.HEAP_PROFILE,
    ).joinToString(", ") { "'$it'" }

    val getAttachmentsToUpload: String = """
            SELECT
                ${AttachmentV1Table.COL_ID},
                ${AttachmentV1Table.COL_EVENT_ID},
                ${AttachmentV1Table.COL_SESSION_ID},
                ${AttachmentV1Table.COL_TIMESTAMP},
                ${AttachmentV1Table.COL_TYPE},
                ${AttachmentV1Table.COL_FILE_PATH},
                ${AttachmentV1Table.COL_NAME},
                ${AttachmentV1Table.COL_UPLOAD_URL},
                ${AttachmentV1Table.COL_URL_EXPIRES_AT},
                ${AttachmentV1Table.COL_URL_HEADERS}
            FROM
                ${AttachmentV1Table.TABLE_NAME}
            WHERE
                ${AttachmentV1Table.COL_UPLOAD_URL} IS NOT NULL
                AND ${AttachmentV1Table.COL_TYPE} NOT IN ($profileTypesList)
            LIMIT
                ?
    """.trimIndent()

    val getProfileAttachmentsToUpload: String = """
            SELECT
                ${AttachmentV1Table.COL_ID},
                ${AttachmentV1Table.COL_EVENT_ID},
                ${AttachmentV1Table.COL_SESSION_ID},
                ${AttachmentV1Table.COL_TIMESTAMP},
                ${AttachmentV1Table.COL_TYPE},
                ${AttachmentV1Table.COL_FILE_PATH},
                ${AttachmentV1Table.COL_NAME},
                ${AttachmentV1Table.COL_UPLOAD_URL},
                ${AttachmentV1Table.COL_URL_EXPIRES_AT},
                ${AttachmentV1Table.COL_URL_HEADERS}
            FROM
                ${AttachmentV1Table.TABLE_NAME}
            WHERE
                ${AttachmentV1Table.COL_UPLOAD_URL} IS NOT NULL
                AND ${AttachmentV1Table.COL_TYPE} IN ($profileTypesList)
            LIMIT
                ?
    """.trimIndent()

    val getSessionsToBatch: String = """
            SELECT ${SessionsTable.COL_SESSION_ID}
            FROM ${SessionsTable.TABLE_NAME}
            ORDER BY ${SessionsTable.COL_PRIORITY_SESSION} DESC
    """.trimIndent()

    val getSampledEvents: String = """
        SELECT e.${EventTable.COL_ID}
        FROM ${EventTable.TABLE_NAME} e
        LEFT JOIN ${EventsBatchTable.TABLE_NAME} eb
            ON e.${EventTable.COL_ID} = eb.${EventsBatchTable.COL_EVENT_ID}
        WHERE e.${EventTable.COL_SESSION_ID} = ?
            AND e.${EventTable.COL_SAMPLED} = 1
            AND eb.${EventsBatchTable.COL_EVENT_ID} IS NULL
        ORDER BY e.${EventTable.COL_TIMESTAMP} ASC
    """.trimIndent()

    val getSampledSpans: String = """
        SELECT sp.${SpansTable.COL_SPAN_ID}
        FROM ${SpansTable.TABLE_NAME} sp
        LEFT JOIN ${SpansBatchTable.TABLE_NAME} sb
            ON sp.${SpansTable.COL_SPAN_ID} = sb.${SpansBatchTable.COL_SPAN_ID}
        WHERE sp.${SpansTable.COL_SESSION_ID} = ?
            AND sp.${SpansTable.COL_SAMPLED} = 1
            AND sb.${SpansBatchTable.COL_SPAN_ID} IS NULL
        ORDER BY sp.${SpansTable.COL_START_TIME} ASC
    """.trimIndent()

    val getEventsForDeletion: String = """
        SELECT e.${EventTable.COL_ID}
        FROM ${EventTable.TABLE_NAME} e
        LEFT JOIN ${EventsBatchTable.TABLE_NAME} eb
            ON e.${EventTable.COL_ID} = eb.${EventsBatchTable.COL_EVENT_ID}
        WHERE e.${EventTable.COL_SESSION_ID} != ?
            AND e.${EventTable.COL_SAMPLED} = 0
            AND eb.${EventsBatchTable.COL_EVENT_ID} IS NULL
        LIMIT ?
    """.trimIndent()

    val getSpansForDeletion: String = """
        SELECT e.${SpansTable.COL_SPAN_ID}
        FROM ${SpansTable.TABLE_NAME} e
        LEFT JOIN ${SpansBatchTable.TABLE_NAME} eb
            ON e.${SpansTable.COL_SPAN_ID} = eb.${SpansBatchTable.COL_SPAN_ID}
        WHERE e.${SpansTable.COL_SESSION_ID} != ?
            AND e.${SpansTable.COL_SAMPLED} = 0
            AND eb.${SpansBatchTable.COL_SPAN_ID} IS NULL
        LIMIT ?
    """.trimIndent()

    val markTimelineForReporting: String = """
        UPDATE ${EventTable.TABLE_NAME}
        SET ${EventTable.COL_SAMPLED} = 1
        WHERE ${EventTable.COL_TIMESTAMP} BETWEEN
            strftime('%Y-%m-%dT%H:%M:%fZ', ?, ?)
            AND ?
    """.trimIndent()

    val getSessionIds: String = """
            SELECT ${SessionsTable.COL_SESSION_ID}
            FROM ${SessionsTable.TABLE_NAME}
            WHERE ${SessionsTable.COL_SESSION_ID} != ?
    """.trimIndent()

    val markSessionAsPriority: String = """
            UPDATE ${SessionsTable.TABLE_NAME}
            SET ${SessionsTable.COL_PRIORITY_SESSION} = 1
            WHERE ${SessionsTable.COL_SESSION_ID} = ?
    """.trimIndent()

    val getExpiredAttachments: String = """
            SELECT ${AttachmentV1Table.COL_ID}, ${AttachmentV1Table.COL_FILE_PATH}
            FROM ${AttachmentV1Table.TABLE_NAME}
            WHERE ${AttachmentV1Table.COL_URL_EXPIRES_AT} IS NOT NULL
                AND ${AttachmentV1Table.COL_URL_EXPIRES_AT} < ?
            LIMIT ?
    """.trimIndent()

    val getBatchIds: String = """
            SELECT ${BatchesTable.COL_BATCH_ID}
            FROM ${BatchesTable.TABLE_NAME}
            ORDER BY ${BatchesTable.COL_CREATED_AT} ASC
    """.trimIndent()
}
