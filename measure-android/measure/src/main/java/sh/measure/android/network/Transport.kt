package sh.measure.android.network

import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.session.SessionReport

internal interface Transport {
    fun sendSessionReport(sessionReport: SessionReport, callback: Callback? = null)

    interface Callback {
        fun onSuccess() {}
        fun onFailure() {}
    }
}

internal class TransportImpl(
    private val logger: Logger, private val httpClient: HttpClient
) : Transport {
    override fun sendSessionReport(sessionReport: SessionReport, callback: Transport.Callback?) {
        logger.log(
            LogLevel.Debug, "Sending session report for session: ${sessionReport.session_id}"
        )
        httpClient.sendSessionReport(sessionReport, callback)
    }
}