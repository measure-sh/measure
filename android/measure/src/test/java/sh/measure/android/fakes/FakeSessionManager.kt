package sh.measure.android.fakes

import sh.measure.android.SessionManager

internal class FakeSessionManager : SessionManager {
    var id = "fake-session-id"

    override fun init(): String = id

    override fun getSessionId(): String = id

    override fun onAppForeground() {
        // no-op
    }

    override fun onAppBackground() {
        // no-op
    }

    override fun onConfigLoaded() {
        // no-op
    }
}
