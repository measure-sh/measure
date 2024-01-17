package sh.measure.android.fakes

import sh.measure.android.network.Transport
import sh.measure.android.session.SessionReport

internal class FakeTransport(var returnSuccess: Boolean = true) : Transport {
    override fun sendSessionReportMultipart(
        sessionReport: SessionReport,
        callback: Transport.Callback?,
    ) {
        if (returnSuccess) {
            callback?.onSuccess()
        } else {
            callback?.onFailure()
        }
    }

    override fun sendSessionReport(sessionReport: SessionReport, callback: Transport.Callback?) {
        if (returnSuccess) {
            callback?.onSuccess()
        } else {
            callback?.onFailure()
        }
    }
}
