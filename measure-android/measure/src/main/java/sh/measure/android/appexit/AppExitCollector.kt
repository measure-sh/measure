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
            val appExitsToTrack: List<Triple<Int, String, AppExit>> =
                mapAppExitsToSession(pidsToSessionsMap, appExits)
            appExitsToTrack.forEach {
                eventProcessor.track(
                    it.third,
                    timeProvider.currentTimeSinceEpochInMillis,
                    EventType.APP_EXIT,
                    sessionId = it.second,
                )
                sessionManager.updateAppExitTracked(pid = it.first)
            }
        }
    }

    private fun mapAppExitsToSession(
        pidToSessionsMap: Map<Int, List<String>>,
        appExits: Map<Int, AppExit>,
    ): List<Triple<Int, String, AppExit>> {
        val result: MutableList<Triple<Int, String, AppExit>> = ArrayList()
        for ((pid, sessionIds) in pidToSessionsMap) {
            if (appExits.containsKey(pid)) {
                val appExit = appExits[pid]
                // assuming last session for the PID to be the one that maps to app exit.
                val lastSessionId = sessionIds.last()
                result.add(Triple(pid, lastSessionId, appExit!!))
            }
        }

        return result
    }
}
