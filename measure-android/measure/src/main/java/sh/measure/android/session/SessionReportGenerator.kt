package sh.measure.android.session

import okio.BufferedSink
import okio.Closeable
import okio.buffer
import okio.sink
import okio.source
import okio.use
import sh.measure.android.appexit.AppExit
import sh.measure.android.appexit.AppExitProvider
import sh.measure.android.attachment.AttachmentInfo
import sh.measure.android.attachment.AttachmentPacket
import sh.measure.android.events.toEvent
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.Storage
import sh.measure.android.utils.iso8601Timestamp
import java.io.File

internal class SessionReportGenerator(
    private val logger: Logger,
    private val storage: Storage,
    private val appExitProvider: AppExitProvider,
) {

    fun getSessionReport(session: Session): SessionReport {
        logger.log(LogLevel.Debug, "Getting session report for session: ${session.id}")
        val sessionStartTime = session.startTime.iso8601Timestamp()
        val appExit = appExitProvider.get(session.pid)
        val eventsFile = createEventsJsonFile(session.id, appExit)
        val attachments = storage.getAllAttachmentsInfo(session.id).mapNotNull { it.toAttachmentPacket() }
        return SessionReport(
            session_id = session.id,
            timestamp = sessionStartTime,
            eventsFile = eventsFile,
            attachments = attachments,
        )
    }

    private fun createEventsJsonFile(sessionId: String, appExit: AppExit?): File {
        logger.log(LogLevel.Debug, "Creating events.json file for session: $sessionId")
        val eventsFile = storage.getEventsFile(sessionId)
        val eventLogFile = storage.getEventLogFile(sessionId)

        eventLogFile.source().buffer().use { source ->
            val writer = ArrayWriter(eventsFile.sink().buffer())
            val firstLine = source.readUtf8Line()
            writer.start()
            // write first object
            if (firstLine != null) {
                writer.writeFirstObject(firstLine)
            } else if (appExit != null) {
                writer.writeFirstObject(appExit.toEvent().toJson())
            }
            // write the rest of the event log
            while (!source.exhausted()) {
                val line = source.readUtf8Line() ?: break
                writer.writeObject(line)
            }
            // write app exit if not already added
            if (firstLine != null && appExit != null) {
                writer.writeObject(appExit.toEvent().toJson())
            }
            // close the array and the file
            writer.close()
        }

        logger.log(LogLevel.Debug, "Created events.json file for session: $sessionId")
        return eventsFile
    }

    private fun AttachmentInfo.toAttachmentPacket(): AttachmentPacket? {
        val file = File(absolutePath)
        if (!file.exists()) {
            logger.log(LogLevel.Error, "Attachment file not found: $absolutePath")
            return null
        }
        val blob = file.source().use {
            it.buffer().readByteString().base64()
        }
        return AttachmentPacket(
            timestamp = timestamp.iso8601Timestamp(),
            name = name,
            type = type,
            extension = extension,
            blob = blob,
        )
    }
}

private class ArrayWriter(private val sink: BufferedSink) : Closeable {
    fun start() {
        sink.writeUtf8("[")
    }

    fun writeFirstObject(value: String) {
        sink.writeUtf8(value)
    }

    fun writeObject(value: String) {
        sink.writeUtf8(",")
        sink.writeUtf8(value)
    }

    override fun close() {
        sink.writeUtf8("]")
        sink.close()
    }
}
