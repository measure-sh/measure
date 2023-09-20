package sh.measure.android.network

import sh.measure.android.session.SessionReport

internal interface HttpClient {
    fun sendSessionReport(sessionRequest: SessionReport, callback: Transport.Callback?)
}
