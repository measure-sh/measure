package sh.measure.android.fakes

import sh.measure.android.SessionManager
import sh.measure.android.events.Event

internal class FakeSessionManager : SessionManager {
    var crashedSession = ""
    var crashedSessions = mutableListOf<String>()
    var onEventTracked = false

    override fun init() {
        // no-op
    }

    override fun getSessionId(): String {
        return "fake-session-id"
    }

    override fun markCrashedSession(sessionId: String) {
        crashedSession = sessionId
    }

    override fun markCrashedSessions(sessionIds: List<String>) {
        crashedSessions = sessionIds.toMutableList()
    }

    override fun <T> onEventTracked(event: Event<T>) {
        onEventTracked = true
    }

    override fun onAppForeground() {
        // no-op
    }

    override fun onAppBackground() {
        // no-op
    }

    override fun clearAppExitSessionsBefore(timestamp: Long) {
        // no-op
    }
}
