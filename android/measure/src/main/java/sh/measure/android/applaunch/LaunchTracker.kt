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
import sh.measure.android.utils.ProcessInfoProvider

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
    private val processInfo: ProcessInfoProvider,
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
                createdActivities[identityHash]?.copy(sameMessage = false)?.let {
                    createdActivities[identityHash] = it
                }
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
        val onCreateRecord = createdActivities[identityHash]
        activity.window.onNextDraw {
            mainHandler.postAtFrontOfQueueAsync {
                if (!launchInProgress) return@postAtFrontOfQueueAsync
                launchInProgress = false

                val onNextDrawUptime = SystemClock.uptimeMillis()
                onCreateRecord?.let { onCreateRecord ->
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
                            LaunchState.lastAppVisibleTime?.let {
                                callbacks.onHotLaunch(
                                    HotLaunchData(
                                        app_visible_uptime = it,
                                        on_next_draw_uptime = onNextDrawUptime,
                                        launched_activity = onCreateRecord.activityName,
                                        has_saved_state = onCreateRecord.hasSavedState,
                                        intent_data = onCreateRecord.intentData,
                                    ),
                                )
                            } ?: logger.log(
                                LogLevel.Error,
                                "lastAppVisibleTime is null, cannot calculate hot launch time",
                            )
                        }

                        "Warm" -> {
                            LaunchState.lastAppVisibleTime?.let {
                                callbacks.onWarmLaunch(
                                    WarmLaunchData(
                                        app_visible_uptime = it,
                                        on_next_draw_uptime = onNextDrawUptime,
                                        launched_activity = onCreateRecord.activityName,
                                        has_saved_state = onCreateRecord.hasSavedState,
                                        intent_data = onCreateRecord.intentData,
                                    ),
                                )
                            } ?: logger.log(
                                LogLevel.Error,
                                "lastAppVisibleTime is null, cannot calculate warm launch time",
                            )
                        }

                        else -> {
                            logger.log(LogLevel.Error, "Unknown launch type: $launchType")
                        }
                    }
                }
            }
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

    private fun computeLaunchType(onCreateRecord: OnCreateRecord): String {
        return when {
            coldLaunchComplete -> {
                if (onCreateRecord.sameMessage) {
                    "Warm"
                } else {
                    "Hot"
                }
            }

            // Cold launch hasn't completed yet.
            // However, the activity has a saved state, so it must be a warm launch. The process
            // was recreated but the system still retained some state. This is not a cold launch as
            // the process didn't really start from scratch.
            onCreateRecord.hasSavedState -> "Warm"

            processInfo.isForegroundProcess() -> "Cold"

            // While the process was starting in background the system must have decided to create
            // the activity and it got resumed. This is not a cold start as the system likely got a
            // chance to warm up before the activity was created. Sadly the system doesn't tell us
            // when it decided to do so, the data for this can be noisy.
            else -> "Warm"
        }
    }
}
