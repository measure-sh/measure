package sh.measure.android.network

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
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
        httpClient.sendSessionReportMultipart(sessionReport, callback)
    }

    override fun sendSessionReport(sessionReport: SessionReport, callback: Transport.Callback?) {
        val request = getSessionRequest(sessionReport)
        httpClient.sendSessionReport(request, callback)
    }

    private fun getSessionRequest(sessionReport: SessionReport): SessionReportRequest {
        return SessionReportRequest(
            session_id = sessionReport.session_id,
            timestamp = sessionReport.timestamp,
            resource = Json.parseToJsonElement(sessionReport.resourceFile.readText()),
            events = Json.parseToJsonElement(sessionReport.eventsFile.readText()) as JsonArray
        )
    }
}

@Serializable
internal data class SessionReportRequest(
    val session_id: String, val timestamp: String, val resource: JsonElement, val events: JsonArray
)