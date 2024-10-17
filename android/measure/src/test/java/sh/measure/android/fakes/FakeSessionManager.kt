package sh.measure.android.fakes

import sh.measure.android.SessionManager

internal class FakeSessionManager : SessionManager {
    var sessionPids = mutableListOf(Pair("fake-session-id", 1234))
    var crashedSession = ""
    var crashedSessions = mutableListOf<String>()
    var onEventTracked = false

    override var currentSessionId: String? = "fake-session-id"

    override fun getOrCreateSession(): String {
        return "fake-session-id"
    }

    override fun getSessionsWithUntrackedAppExit(): Map<Int, List<String>> {
        return sessionPids.groupBy({ it.second }, { it.first })
    }

    override fun updateAppExitTracked(pid: Int) {
        // No-op
    }

    override fun markCrashedSession(sessionId: String) {
        crashedSession = sessionId
    }

    override fun markCrashedSessions(sessionIds: List<String>) {
        crashedSessions = sessionIds.toMutableList()
    }

    override fun onEventTracked() {
        onEventTracked = true
    }
}
