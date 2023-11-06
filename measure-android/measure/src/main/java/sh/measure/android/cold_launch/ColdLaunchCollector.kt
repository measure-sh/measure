package sh.measure.android.cold_launch

import android.app.Activity
import android.app.ActivityManager
import android.app.Application
import android.os.Bundle
import android.os.Process
import android.os.SystemClock
import curtains.onNextDraw
import sh.measure.android.MeasureInitProvider
import sh.measure.android.attachment.AttachmentInfo
import sh.measure.android.attachment.AttachmentType
import sh.measure.android.cold_launch.StartUptimeMechanism.CONTENT_PROVIDER
import sh.measure.android.cold_launch.StartUptimeMechanism.PROCESS_START_REQUESTED_UPTIME
import sh.measure.android.cold_launch.StartUptimeMechanism.PROCESS_START_UPTIME
import sh.measure.android.events.EventTracker
import sh.measure.android.lifecycle.ActivityLifecycleAdapter
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.mainHandler
import sh.measure.android.postAtFrontOfQueueAsync
import sh.measure.android.utils.CurrentThread
import sh.measure.android.utils.TimeProvider
import sh.measure.android.utils.iso8601Timestamp

/**
 * Tracks 'cold' app launches along with the time to launch, also known as app
 * launch [TTID](https://developer.android.com/topic/performance/vitals/launch-time#time-initial)
 *
 * ## Algorithm
 * 1. Finds the most accurate starting time when the user started waiting for the app to launch:
 *  * Up to API 24: Using [MeasureInitProvider] content provider.
 *  * API 24 - API 33: [Process.getStartUptimeMillis], with fallback to content provider in rare scenarios.
 *  * API 33 beyond - [Process.getStartRequestedUptimeMillis].
 *
 * 2. Check process importance
 * Classify launch as cold launch only if the process was launched with IMPORTANCE_FOREGROUND.
 * This has some more finer details, where the process can change importance at any time while
 * running. Yet to figure out when to capture this info.
 *
 * 3. First draw time
 * Track time at nextDraw of the first activity. This is the time when the user sees the first
 * content on the screen.
 *
 * Heavily inspired from [PAPA](https://github.com/square/papa).
 */
internal class ColdLaunchCollector(
    private val application: Application,
    private val logger: Logger,
    private val eventTracker: EventTracker,
    private val timeProvider: TimeProvider,
    private val launchInfo: LaunchState,
    private val trace: ColdLaunchTrace,
    private val currentThread: CurrentThread,
) : ActivityLifecycleAdapter {

    private var firstDrawComplete = false
    private lateinit var createdActivity: CreatedActivity

    fun register() {
        logger.log(LogLevel.Debug, "Registering app launch tracker")
        application.registerActivityLifecycleCallbacks(this)
    }

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
        createdActivity = CreatedActivity(
            name = activity.javaClass.name,
            intent = activity.intent.dataString,
            hasSavedState = savedInstanceState != null
        )
    }

    override fun onActivityResumed(activity: Activity) {
        if (firstDrawComplete) return
        if (createdActivity.hasSavedState) return
        if (!isForegroundProcess()) return
        val (startUptime, startUptimeMechanism) = launchInfo.startUptimePair ?: return

        activity.window.onNextDraw {
            firstDrawComplete = true
            mainHandler.postAtFrontOfQueueAsync {
                val completeUptime = SystemClock.uptimeMillis()
                val duration = completeUptime - startUptime
                val event = ColdLaunchEvent(
                    start_uptime = startUptime,
                    su_is_process_start_uptime = startUptimeMechanism == PROCESS_START_UPTIME,
                    su_is_process_start_requested = startUptimeMechanism == PROCESS_START_REQUESTED_UPTIME,
                    su_is_content_provider_init = startUptimeMechanism == CONTENT_PROVIDER,
                    end_uptime = completeUptime,
                    eu_is_first_draw = true,
                    first_visible_activity = createdActivity.name,
                    intent = createdActivity.intent,
                    duration = duration,
                    timestamp = timeProvider.currentTimeSinceEpochInMillis.iso8601Timestamp(),
                    thread_name = currentThread.name
                )
                eventTracker.trackColdLaunch(event)
                trace.stop()
                eventTracker.storeAttachment(
                    AttachmentInfo(
                        name = trace.config.name,
                        type = AttachmentType.METHOD_TRACE,
                        extension = trace.config.extension,
                        absolutePath = trace.config.absolutePath,
                        timestamp = timeProvider.currentTimeSinceEpochInMillis
                    )
                )
                unregisterLifecycleCallbacks()
            }
        }
    }

    private fun isForegroundProcess(): Boolean {
        val processInfo = ActivityManager.RunningAppProcessInfo()
        ActivityManager.getMyMemoryState(processInfo)
        return processInfo.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
    }

    private fun unregisterLifecycleCallbacks() {
        logger.log(LogLevel.Debug, "Unregistering cold launch tracker")
        application.unregisterActivityLifecycleCallbacks(this)
    }
}

internal data class CreatedActivity(
    val name: String, val intent: String?, val hasSavedState: Boolean
)

