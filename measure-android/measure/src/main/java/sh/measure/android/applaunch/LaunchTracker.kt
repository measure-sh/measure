package sh.measure.android.applaunch

import android.app.Activity
import android.os.Bundle
import android.os.SystemClock
import curtains.onNextDraw
import sh.measure.android.lifecycle.ActivityLifecycleAdapter
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.mainHandler
import sh.measure.android.postAtFrontOfQueueAsync
import sh.measure.android.utils.TimeProvider
import sh.measure.android.utils.isForegroundProcess

internal interface LaunchCallbacks {
    fun onColdLaunch(coldLaunchData: ColdLaunchData)
    fun onWarmLaunch(warmLaunchData: WarmLaunchData)
    fun onHotLaunch(hotLaunchData: HotLaunchData)
}

/**
 * Tracks cold, warm and hot launch.
 * Heavily inspired by [PAPA](https://github.com/square/papa/).
 */
internal class LaunchTracker(
    private val logger: Logger,
    private val callbacks: LaunchCallbacks,
) : ActivityLifecycleAdapter {

    private var coldLaunchComplete = false
    private var launchInProgress = false

    private data class OnCreateRecord(
        val sameMessage: Boolean,
        val hasSavedState: Boolean,
        val intentData: String?,
        val activityName: String,
    )

    private val createdActivities = mutableMapOf<String, OnCreateRecord>()
    private val startedActivities = mutableListOf<String>()
    private val resumedActivities = mutableListOf<String>()

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
        val identityHash = Integer.toHexString(System.identityHashCode(activity))
        val hasSavedState = savedInstanceState != null
        createdActivities[identityHash] = OnCreateRecord(
            sameMessage = true,
            hasSavedState = hasSavedState,
            intentData = activity.intent.dataString,
            activityName = activity.javaClass.name,
        )

        // Helps differentiating between warm and hot launches.
        // OnCreateRecord.sameMessage remains true for warm launch. While it gets set to
        // false for hot launch. This is because hot launch does not trigger an onCreate.
        // The handler processes this message after the activity is resumed.
        mainHandler.post {
            if (identityHash in createdActivities) {
                val update = createdActivities.getValue(identityHash).copy(sameMessage = false)
                createdActivities[identityHash] = update
            }
        }

        val appWasInvisible = startedActivities.isEmpty()
        if (appWasInvisible) {
            if (!launchInProgress) {
                launchInProgress = true
                appMightBecomeVisible()
            }
        }
    }

    override fun onActivityStarted(activity: Activity) {
        val appWasInvisible = startedActivities.isEmpty()
        if (appWasInvisible) {
            if (!launchInProgress) {
                launchInProgress = true
                appMightBecomeVisible()
            }
        }
        val identityHash = Integer.toHexString(System.identityHashCode(activity))
        startedActivities += identityHash
    }

    private fun appMightBecomeVisible() {
        if (coldLaunchComplete) {
            LaunchState.lastAppVisibleTime = SystemClock.uptimeMillis()
            logger.log(
                LogLevel.Debug,
                "Updated last app visible time: ${LaunchState.lastAppVisibleTime}",
            )
        }
    }

    override fun onActivityResumed(activity: Activity) {
        if (!launchInProgress) return

        val identityHash = Integer.toHexString(System.identityHashCode(activity))
        resumedActivities += identityHash
        val onCreateRecord = createdActivities.getValue(identityHash)
        activity.window.onNextDraw {
            mainHandler.postAtFrontOfQueueAsync {
                if (!launchInProgress) return@postAtFrontOfQueueAsync
                launchInProgress = false

                val onNextDrawUptime = SystemClock.uptimeMillis()
                when (val launchType = computeLaunchType(onCreateRecord)) {
                    "Cold" -> {
                        coldLaunchComplete = true
                        callbacks.onColdLaunch(
                            coldLaunchData = ColdLaunchData(
                                process_start_uptime = LaunchState.processStartUptime,
                                process_start_requested_uptime = LaunchState.processStartRequestedUptime,
                                content_provider_attach_uptime = LaunchState.contentLoaderAttachUptime,
                                on_next_draw_uptime = onNextDrawUptime,
                                launched_activity = onCreateRecord.activityName,
                                has_saved_state = onCreateRecord.hasSavedState,
                                intent_data = onCreateRecord.intentData,
                            ),
                        )
                    }

                    "Hot" -> {
                        callbacks.onHotLaunch(
                            HotLaunchData(
                                app_visible_uptime = LaunchState.lastAppVisibleTime!!,
                                on_next_draw_uptime = onNextDrawUptime,
                                launched_activity = onCreateRecord.activityName,
                                has_saved_state = onCreateRecord.hasSavedState,
                                intent_data = onCreateRecord.intentData,
                            ),
                        )
                    }

                    "Warm" -> {
                        callbacks.onWarmLaunch(
                            WarmLaunchData(
                                app_visible_uptime = LaunchState.lastAppVisibleTime!!,
                                on_next_draw_uptime = onNextDrawUptime,
                                launched_activity = onCreateRecord.activityName,
                                has_saved_state = onCreateRecord.hasSavedState,
                                intent_data = onCreateRecord.intentData,
                            ),
                        )
                    }

                    else -> {
                        throw IllegalStateException("Unknown preLaunchState: $launchType")
                    }
                }
            }
        }
    }

    private fun computeLaunchType(onCreateRecord: OnCreateRecord): String {
        return when {
            coldLaunchComplete -> {
                if (onCreateRecord.sameMessage) {
                    "Warm"
                } else {
                    "Hot"
                }
            }
            isForegroundProcess() -> "Cold"
            else -> "Warm"
        }
    }

    override fun onActivityPaused(activity: Activity) {
        val identityHash = Integer.toHexString(System.identityHashCode(activity))
        resumedActivities.remove(identityHash)
    }

    override fun onActivityStopped(activity: Activity) {
        val identityHash = Integer.toHexString(System.identityHashCode(activity))
        startedActivities.remove(identityHash)
    }

    override fun onActivityDestroyed(activity: Activity) {
        val identityHash = Integer.toHexString(System.identityHashCode(activity))
        createdActivities.remove(identityHash)
    }
}
