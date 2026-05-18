package sh.measure.android.fakes

import sh.measure.android.SessionManager
import sh.measure.android.SessionStartListener

internal class FakeSessionManager : SessionManager {
    var id = "fake-session-id"
    var startTime: Long = 0L
    var onSessionStartListener: SessionStartListener? = null

    override fun init(): String = id

    override fun getSessionId(): String = id

    override fun getSessionStartTime(): Long = startTime

    override fun onAppForeground() {
        // no-op
    }

    override fun onAppBackground() {
        // no-op
    }

    override fun onConfigLoaded() {
        // no-op
    }

    override fun setSessionStartListener(listener: SessionStartListener) {
        onSessionStartListener = listener
    }
}
