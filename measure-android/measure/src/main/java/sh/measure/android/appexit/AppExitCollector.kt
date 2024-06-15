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
            val pidsToSessionsMap: Map<Int, List<String>> = sessionManager.getSessionsForPids()
            val appExitsToTrack: List<Pair<String, AppExit>> =
                mapAppExitsToSession(pidsToSessionsMap, appExits)
            appExitsToTrack.forEach {
                eventProcessor.track(
                    it.second,
                    timeProvider.currentTimeSinceEpochInMillis,
                    EventType.APP_EXIT,
                    sessionId = it.first,
                )
            }
        }
    }

    private fun mapAppExitsToSession(
        pidToSessionsMap: Map<Int, List<String>>,
        appExits: Map<Int, AppExit>,
    ): List<Pair<String, AppExit>> {
        val result: MutableList<Pair<String, AppExit>> = ArrayList()
        for ((pid, sessionIds) in pidToSessionsMap) {
            if (appExits.containsKey(pid)) {
                val appExit = appExits[pid]
                // assuming last session for the PID to be the one that maps to app exit.
                val lastSessionId = sessionIds.last()
                result.add(Pair(lastSessionId, appExit!!))
            }
        }

        return result
    }
}
