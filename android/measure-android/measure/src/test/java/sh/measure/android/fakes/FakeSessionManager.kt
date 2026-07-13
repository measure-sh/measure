package sh.measure.android.fakes

import sh.measure.android.SessionManager
import sh.measure.android.SessionStartListener
import sh.measure.android.storage.SessionRecord

internal class FakeSessionManager : SessionManager {
    var id = "fake-session-id"
    var startTime: Long = 0L
    var onSessionStartListener: SessionStartListener? = null
    val markedAnrSessions = mutableListOf<Pair<String, Long>>()
    val appExitSessions = mutableMapOf<Int, SessionRecord>()
    var appExitTrackedCount = 0
    var sessionForTime: SessionRecord? = null
    var sessionForAnr: SessionRecord? = null
    val sessionForTimeCalls = mutableListOf<Long>()
    val sessionForAnrCalls = mutableListOf<Pair<Long, Long>>()

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

    override fun markSessionWithAnr(sessionId: String, anrTimeMs: Long) {
        markedAnrSessions.add(sessionId to anrTimeMs)
    }

    override fun getSessionForAppExit(pid: Int): SessionRecord? = appExitSessions[pid]

    override fun markSessionsAppExitTracked() {
        appExitTrackedCount++
    }

    override fun getSessionForTime(timeMs: Long): SessionRecord? {
        sessionForTimeCalls.add(timeMs)
        return sessionForTime
    }

    override fun getSessionForAnr(timeMs: Long, maxGapMs: Long): SessionRecord? {
        sessionForAnrCalls.add(timeMs to maxGapMs)
        return sessionForAnr
    }

    override fun setSessionStartListener(listener: SessionStartListener) {
        onSessionStartListener = listener
    }
}
