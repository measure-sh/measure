package sh.measure.android.appexit

import sh.measure.android.SessionManager
import sh.measure.android.events.EventProcessor
import sh.measure.android.events.EventType
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.utils.TimeProvider

internal class AppExitCollector(
    private val appExitProvider: AppExitProvider,
    private val measureExecutorService: MeasureExecutorService,
    private val eventProcessor: EventProcessor,
    private val timeProvider: TimeProvider,
    private val sessionManager: SessionManager,
) {
    fun onColdLaunch() {
        trackAppExit()
    }

    private fun trackAppExit() {
        measureExecutorService.submit {
            val appExits = appExitProvider.get()
            if (appExits.isNullOrEmpty()) {
                return@submit
            }
            val untrackedSessions = sessionManager.getSessions()
            val appExitsToTrack: List<Pair<String, AppExit>> =
                getAppExitsToTrack(untrackedSessions, appExits)
            appExitsToTrack.forEach {
                eventProcessor.track(
                    it.second,
                    timeProvider.currentTimeSinceEpochInMillis,
                    EventType.APP_EXIT,
                    sessionId = it.first
                )
                sessionManager.deleteSession(it.first)
            }
        }
    }

    private fun getAppExitsToTrack(
        sessionPidPairs: List<Pair<String, Int>>,
        appExits: Map<Int, AppExit>,
    ): List<Pair<String, AppExit>> {
        val result: MutableList<Pair<String, AppExit>> = ArrayList()
        for ((sessionId, pid) in sessionPidPairs) {
            if (appExits.containsKey(pid)) {
                val appExit = appExits[pid]
                result.add(Pair(sessionId, appExit!!))
            }
        }

        return result
    }
}