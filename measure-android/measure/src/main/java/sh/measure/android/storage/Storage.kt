package sh.measure.android.storage

import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.session.Session
import sh.measure.android.session.SessionReport
import sh.measure.android.session.SignalReport
import sh.measure.android.storage.SessionContract.SessionTable
import sh.measure.android.storage.SessionContract.SignalsTable

internal interface Storage {
    fun saveSession(session: Session)
    fun deleteSession(sessionId: String)
    fun saveUnhandledException(signal: Signal)
    fun getSessionReport(sessionId: String): SessionReport?
    fun deleteSessionAndSignals(sessionId: String)
    fun getUnsyncedSessions(): List<String>
    fun deleteSessionsWithoutCrash(activeSessionId: String)
}

internal class StorageImpl(
    private val logger: Logger, private val db: SqliteDbHelper
) : Storage {
    override fun saveSession(session: Session) {
        logger.log(LogLevel.Debug, "Inserting session: ${session.id}")
        try {
            db.writableDatabase.let {
                val result = it.insertWithOnConflict(
                    SessionTable.TABLE_NAME,
                    null,
                    session.toContentValues(),
                    SQLiteDatabase.CONFLICT_FAIL
                )

                if (result == -1L) {
                    logger.log(LogLevel.Error, "Failed to insert session: ${session.id}")
                } else {
                    logger.log(LogLevel.Debug, "Inserted session: ${session.id}")
                }
            }
        } catch (e: SQLiteException) {
            logger.log(LogLevel.Error, "Failed to insert session: ${session.id}", e)
        }
    }

    override fun deleteSession(sessionId: String) {
        logger.log(LogLevel.Debug, "Deleting session: $sessionId")

        try {
            db.writableDatabase.let {
                val result = it.delete(
                    SessionTable.TABLE_NAME,
                    "${SessionTable.COLUMN_SESSION_ID} = ?",
                    arrayOf(sessionId)
                )

                if (result == 0) {
                    logger.log(LogLevel.Error, "Failed to delete session: $sessionId")
                } else {
                    logger.log(LogLevel.Debug, "Deleted session: $sessionId")
                }
            }
        } catch (e: SQLiteException) {
            logger.log(LogLevel.Error, "Failed to delete session: $sessionId", e)
        }
    }

    // Marks the session as crashed and saves the exception signal in a single transaction.
    override fun saveUnhandledException(signal: Signal) {
        logger.log(LogLevel.Debug, "Saving exception signal for session ${signal.sessionId}")

        db.writableDatabase.let {
            it.beginTransactionNonExclusive()
            try {
                // Mark session as crashed
                val contentValues = ContentValues().apply {
                    put(SessionTable.COLUMN_CRASHED, true)
                }
                val sessionUpdateResult = it.update(
                    SessionTable.TABLE_NAME,
                    contentValues,
                    "${SessionTable.COLUMN_SESSION_ID} = ?",
                    arrayOf(signal.sessionId)
                )
                if (sessionUpdateResult == 0) {
                    logger.log(
                        LogLevel.Error, "Failed to mark session as crashed: ${signal.sessionId}"
                    )
                    it.endTransaction()
                    return
                }

                // Save signal
                val signalContentValues = signal.toContentValues()
                val result = it.insert(SignalsTable.TABLE_NAME, null, signalContentValues)
                if (result == -1L) {
                    logger.log(
                        LogLevel.Error,
                        "Failed to insert ${signal.signalType} for: ${signal.sessionId}"
                    )
                    it.endTransaction()
                    return
                }

                logger.log(LogLevel.Debug, "Marked session as crashed: ${signal.sessionId}")
                it.setTransactionSuccessful()
            } catch (e: SQLiteException) {
                logger.log(
                    LogLevel.Error, "Failed to mark session as crashed: ${signal.sessionId}", e
                )
            } finally {
                it.endTransaction()
            }
        }
    }

    override fun deleteSessionAndSignals(sessionId: String) {
        logger.log(LogLevel.Debug, "Deleting session and signals for session: $sessionId")

        db.writableDatabase.let {
            it.beginTransactionNonExclusive()
            try {
                val signalsResult = it.delete(
                    SignalsTable.TABLE_NAME,
                    "${SignalsTable.COLUMN_SESSION_ID} = ?",
                    arrayOf(sessionId)
                )

                val sessionResult = it.delete(
                    SessionTable.TABLE_NAME,
                    "${SessionTable.COLUMN_SESSION_ID} = ?",
                    arrayOf(sessionId)
                )

                if (signalsResult == 0 && sessionResult == 0) {
                    logger.log(
                        LogLevel.Error,
                        "Failed to delete session and signals for session: $sessionId"
                    )
                    it.endTransaction()
                } else {
                    logger.log(
                        LogLevel.Debug, "Deleted session and signals for session: $sessionId"
                    )
                    it.setTransactionSuccessful()
                }
            } catch (e: SQLiteException) {
                logger.log(LogLevel.Error, "Failed to delete signals for session: $sessionId", e)
            } finally {
                it.endTransaction()
            }
        }
    }

    override fun getSessionReport(sessionId: String): SessionReport? {
        logger.log(LogLevel.Debug, "Getting signals for session: $sessionId")
        db.readableDatabase.let {
            it.beginTransactionNonExclusive()

            try {
                val sessionReportBuilder = SessionReport.Builder()

                // Get resource from session table
                val sessionCursor = it.query(
                    SessionTable.TABLE_NAME,
                    arrayOf(SessionTable.COLUMN_RESOURCE, SessionTable.COLUMN_SESSION_START_TIME),
                    "${SessionTable.COLUMN_SESSION_ID} = ?",
                    arrayOf(sessionId),
                    null,
                    null,
                    null
                )
                sessionCursor.moveToFirst()
                val resourceIndex = sessionCursor.getColumnIndex(SessionTable.COLUMN_RESOURCE)
                val resource = Json.decodeFromString(
                    JsonElement.serializer(), sessionCursor.getString(resourceIndex)
                )
                val startTimeIndex =
                    sessionCursor.getColumnIndex(SessionTable.COLUMN_SESSION_START_TIME)
                val timestamp = sessionCursor.getLong(startTimeIndex)
                sessionReportBuilder.sessionId(sessionId).resource(resource)
                    .timestamp(timestamp)
                sessionCursor.close()

                // Get signals from signals table
                val signalsCursor = it.query(
                    SignalsTable.TABLE_NAME,
                    null,
                    "${SignalsTable.COLUMN_SESSION_ID} = ?",
                    arrayOf(sessionId),
                    null,
                    null,
                    null
                )
                val signals = mutableListOf<SignalReport>()
                val timestampIndex = signalsCursor.getColumnIndex(SignalsTable.COLUMN_TIMESTAMP)
                val signalTypeIndex = signalsCursor.getColumnIndex(SignalsTable.COLUMN_SIGNAL_TYPE)
                val dataTypeIndex = signalsCursor.getColumnIndex(SignalsTable.COLUMN_DATA_TYPE)
                val dataIndex = signalsCursor.getColumnIndex(SignalsTable.COLUMN_DATA)
                while (signalsCursor.moveToNext()) {
                    val signalTimestamp = signalsCursor.getString(timestampIndex)
                    val signalType = signalsCursor.getString(signalTypeIndex)
                    val dataType = signalsCursor.getString(dataTypeIndex)
                    val data = Json.decodeFromString(
                        JsonElement.serializer(), signalsCursor.getString(dataIndex)
                    )
                    signals.add(SignalReport(signalTimestamp, signalType, dataType, data))
                }
                signalsCursor.close()

                it.setTransactionSuccessful()
                return sessionReportBuilder.signals(signals).build()
            } catch (e: SQLiteException) {
                logger.log(
                    LogLevel.Error, "Failed to get session report for session: $sessionId", e
                )
                return null
            } finally {
                it.endTransaction()
            }
        }
    }

    override fun getUnsyncedSessions(): List<String> {
        logger.log(LogLevel.Debug, "Getting unsynced sessions")
        db.readableDatabase.let {
            try {
                val sessionIds = mutableListOf<String>()

                // Get crashed, unsynced session from session table
                val sessionCursor = it.query(
                    SessionTable.TABLE_NAME,
                    arrayOf(SessionTable.COLUMN_SESSION_ID),
                    "${SessionTable.COLUMN_CRASHED} = ? AND ${SessionTable.COLUMN_SYNCED} = ?",
                    arrayOf("1", "0"),
                    null,
                    null,
                    null
                )
                val sessionIdIndex = sessionCursor.getColumnIndex(SessionTable.COLUMN_SESSION_ID)
                while (sessionCursor.moveToNext()) {
                    sessionIds.add(sessionCursor.getString(sessionIdIndex))
                }
                sessionCursor.close()
                return sessionIds
            } catch (e: SQLiteException) {
                logger.log(
                    LogLevel.Error, "Failed to get unsynced sessions", e
                )
                return emptyList()
            }
        }

    }

    override fun deleteSessionsWithoutCrash(activeSessionId: String) {
        logger.log(LogLevel.Debug, "Deleting sessions without crash")

        db.writableDatabase.let {
            it.beginTransactionNonExclusive()
            try {
                val crashedSessionsCursor = it.query(
                    SessionTable.TABLE_NAME, arrayOf(SessionTable.COLUMN_SESSION_ID),
                    "${SessionTable.COLUMN_SESSION_ID} != ? AND ${SessionTable.COLUMN_CRASHED} = ?",
                    arrayOf(activeSessionId, "0"),
                    null,
                    null,
                    null
                )
                val sessionIds = mutableListOf<String>()
                val sessionIdIndex = crashedSessionsCursor.getColumnIndex(
                    SessionTable.COLUMN_SESSION_ID
                )
                while (crashedSessionsCursor.moveToNext()) {
                    sessionIds.add(crashedSessionsCursor.getString(sessionIdIndex))
                }
                crashedSessionsCursor.close()

                if (sessionIds.isEmpty()) {
                    logger.log(LogLevel.Debug, "No sessions without crash found")
                    return
                }

                val sessionsTypedArray = sessionIds.toTypedArray()
                val placeholders = sessionIds.joinToString(",") { "?" }

                // Delete signals for all sessionIds
                val signalsResult = it.delete(
                    SignalsTable.TABLE_NAME,
                    "${SignalsTable.COLUMN_SESSION_ID} IN ($placeholders)",
                    sessionsTypedArray
                )
                logger.log(
                    LogLevel.Debug,
                    "Deleted $signalsResult signals from ${sessionIds.size} sessions"
                )
                val sessionsResult = it.delete(
                    SessionTable.TABLE_NAME,
                    "${SessionTable.COLUMN_SESSION_ID} IN ($placeholders)",
                    sessionsTypedArray
                )
                logger.log(
                    LogLevel.Debug, "Deleted $sessionsResult sessions without crash"
                )
                it.setTransactionSuccessful()
            } catch (e: SQLiteException) {
                logger.log(LogLevel.Error, "Failed to delete sessions without crash", e)
            } finally {
                it.endTransaction()
            }
        }
    }
}