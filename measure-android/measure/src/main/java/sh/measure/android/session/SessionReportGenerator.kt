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
import sh.measure.android.exitinfo.ExitInfo
import sh.measure.android.exitinfo.ExitInfoProvider
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.Storage
import sh.measure.android.storage.UnsyncedSession
import sh.measure.android.utils.iso8601Timestamp
import java.io.File

internal class SessionReportGenerator(
    private val logger: Logger,
    private val storage: Storage,
    private val exitInfoProvider: ExitInfoProvider
) {

    fun getSessionReport(session: UnsyncedSession): SessionReport {
        logger.log(LogLevel.Debug, "Getting session report for session: ${session.id}")
        val sessionStartTime = getSessionStartTime(session.id)
        val exitInfo = exitInfoProvider.get(session.processId)
        val eventsFile = createEventsJsonFile(session.id, exitInfo)
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

    private fun createEventsJsonFile(sessionId: String, exitInfo: ExitInfo?): File {
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
                    if (exitInfo != null) {
                        addExitInfo(sink, exitInfo)
                    }
                }
                sink.writeUtf8("]")
            }
        }
        logger.log(LogLevel.Debug, "Created events.json file for session: $sessionId")
        return eventsFile
    }

    @OptIn(ExperimentalSerializationApi::class)
    private fun addExitInfo(sink: BufferedSink, exitInfo: ExitInfo) {
        sink.writeUtf8(",")
        sink.writeUtf8("{")
        sink.writeUtf8("\"timestamp\": \"${exitInfo.timestamp}\",")
        sink.writeUtf8("\"type\": \"${EventType.EXIT_INFO}\",")
        sink.writeUtf8("\"${EventType.EXIT_INFO}\": ")
        Json.encodeToStream(
            Json.encodeToJsonElement(ExitInfo.serializer(), exitInfo),
            sink.outputStream()
        )
        sink.writeUtf8("}")
    }
}