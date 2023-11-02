package sh.measure.android.network

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import sh.measure.android.attachment.AttachmentPacket
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.session.SessionReport

internal interface Transport {
    fun sendSessionReportMultipart(sessionReport: SessionReport, callback: Callback? = null)
    fun sendSessionReport(sessionReport: SessionReport, callback: Callback? = null)

    interface Callback {
        fun onSuccess() {}
        fun onFailure() {}
    }
}

internal class TransportImpl(
    private val logger: Logger, private val httpClient: HttpClient
) : Transport {
    override fun sendSessionReportMultipart(
        sessionReport: SessionReport, callback: Transport.Callback?
    ) {
        try {
            httpClient.sendSessionReportMultipart(sessionReport, callback)
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "Failed to send session report", e)
            callback?.onFailure()
        }
    }

    override fun sendSessionReport(sessionReport: SessionReport, callback: Transport.Callback?) {
        try {
            val request = getSessionRequest(sessionReport)
            logger.log(
                LogLevel.Debug,
                Json.encodeToString(SessionReportRequest.serializer(), request)
            )
            httpClient.sendSessionReport(request, callback)
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "Failed to send session report", e)
            callback?.onFailure()
        }
    }

    private fun getSessionRequest(sessionReport: SessionReport): SessionReportRequest {
        return SessionReportRequest(
            session_id = sessionReport.session_id,
            timestamp = sessionReport.timestamp,
            resource = sessionReport.resource,
            events = Json.parseToJsonElement(sessionReport.eventsFile.readText()) as JsonArray,
            attachments = sessionReport.attachments,
        )
    }
}

@Serializable
internal data class SessionReportRequest(
    val session_id: String,
    val timestamp: String,
    val resource: JsonElement,
    val events: JsonArray,
    val attachments: List<AttachmentPacket>,
)
