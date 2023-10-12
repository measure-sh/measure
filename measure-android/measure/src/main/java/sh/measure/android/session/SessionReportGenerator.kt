package sh.measure.android.session

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.encodeToStream
import okio.BufferedSink
import okio.buffer
import okio.sink
import okio.source
import okio.use
import sh.measure.android.events.EventType
import sh.measure.android.appexit.AppExit
import sh.measure.android.appexit.AppExitProvider
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.Storage
import sh.measure.android.storage.UnsyncedSession
import sh.measure.android.utils.iso8601Timestamp
import java.io.File

internal class SessionReportGenerator(
    private val logger: Logger,
    private val storage: Storage,
    private val appExitProvider: AppExitProvider
) {

    fun getSessionReport(session: UnsyncedSession): SessionReport {
        logger.log(LogLevel.Debug, "Getting session report for session: ${session.id}")
        val sessionStartTime = getSessionStartTime(session.id)
        val appExit = appExitProvider.get(session.processId)
        val eventsFile = createEventsJsonFile(session.id, appExit)
        val resourceFile = storage.getResourceFile(session.id)
        return SessionReport(
            session_id = session.id,
            timestamp = sessionStartTime.iso8601Timestamp(),
            eventsFile = eventsFile,
            resourceFile = resourceFile
        )
    }

    private fun getSessionStartTime(sessionId: String): Long {
        return storage.getSessionStartTime(sessionId)
    }

    private fun createEventsJsonFile(sessionId: String, appExit: AppExit?): File {
        logger.log(LogLevel.Debug, "Creating events.json file for session: $sessionId")
        val eventsFile = storage.getEventsFile(sessionId)
        storage.getEventLogFile(sessionId).source().buffer().use { source ->
            eventsFile.sink().buffer().use { sink ->
                sink.writeUtf8("[")
                var line = source.readUtf8Line()
                while (line != null) {
                    sink.writeUtf8(line)
                    line = source.readUtf8Line()
                    if (line != null) {
                        sink.writeUtf8(",")
                        continue
                    }
                    if (appExit != null) {
                        appAppExit(sink, appExit)
                    }
                }
                sink.writeUtf8("]")
            }
        }
        logger.log(LogLevel.Debug, "Created events.json file for session: $sessionId")
        return eventsFile
    }

    @OptIn(ExperimentalSerializationApi::class)
    private fun appAppExit(sink: BufferedSink, appExit: AppExit) {
        sink.writeUtf8(",")
        sink.writeUtf8("{")
        sink.writeUtf8("\"timestamp\": \"${appExit.timestamp}\",")
        sink.writeUtf8("\"type\": \"${EventType.APP_EXIT}\",")
        sink.writeUtf8("\"${EventType.APP_EXIT}\": ")
        Json.encodeToStream(
            Json.encodeToJsonElement(AppExit.serializer(), appExit),
            sink.outputStream()
        )
        sink.writeUtf8("}")
    }
}