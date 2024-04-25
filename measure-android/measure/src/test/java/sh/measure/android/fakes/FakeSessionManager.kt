package sh.measure.android.fakes

import sh.measure.android.SessionManager

internal class FakeSessionManager : SessionManager {
    var sessionPids = listOf(Pair("fake-session-id", 1234))

    override val sessionId: String
        get() = "fake-session-id"

    override fun getSessions(): List<Pair<String, Int>> {
        return sessionPids
    }

    override fun deleteSession(sessionId: String) {
        // No-op
    }
}
