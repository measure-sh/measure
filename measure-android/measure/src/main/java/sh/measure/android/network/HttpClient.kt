package sh.measure.android.network

import sh.measure.android.session.SessionReport

internal interface HttpClient {
    fun sendSessionReportMultipart(sessionReport: SessionReport, callback: Transport.Callback?)
    fun sendSessionReport(sessionReportRequest: SessionReportRequest, callback: Transport.Callback?)
}
