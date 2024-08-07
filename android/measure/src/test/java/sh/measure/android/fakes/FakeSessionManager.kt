package sh.measure.android.fakes

import sh.measure.android.SessionManager

internal class FakeSessionManager : SessionManager {
    var sessionPids = mutableListOf(Pair("fake-session-id", 1234))
    var crashedSession = ""
    var crashedSessions = mutableListOf<String>()
    override fun init() {
        // No-op
    }

    override fun getSessionId(): String {
        return "fake-session-id"
    }

    override fun getSessionsWithUntrackedAppExit(): Map<Int, List<String>> {
        return sessionPids.groupBy({ it.second }, { it.first })
    }

    override fun onAppBackground() {
        // No-op
    }

    override fun onAppForeground() {
        // No-op
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
}
