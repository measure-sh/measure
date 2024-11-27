package sh.measure.android.applaunch

import android.app.Activity
import android.app.ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
import android.os.Bundle
import curtains.onNextDraw
import sh.measure.android.lifecycle.ActivityLifecycleAdapter
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.mainHandler
import sh.measure.android.postAtFrontOfQueueAsync

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
) : ActivityLifecycleAdapter {

    private var callbacks: LaunchCallbacks? = null
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

    fun registerCallbacks(callbacks: LaunchCallbacks) {
        this.callbacks = callbacks
    }

    fun unregisterCallbacks() {
        this.callbacks = null
    }

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
        LaunchState.lastAppVisibleTime = android.os.SystemClock.uptimeMillis()
        logger.log(
            LogLevel.Debug,
            "Updated last app visible time: ${LaunchState.lastAppVisibleTime}",
        )
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

                val onNextDrawUptime = android.os.SystemClock.uptimeMillis()
                onCreateRecord?.let { onCreateRecord ->
                    when (val launchType = computeLaunchType(onCreateRecord)) {
                        "Cold" -> {
                            coldLaunchComplete = true
                            callbacks?.onColdLaunch(
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
                                callbacks?.onHotLaunch(
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
                            callbacks?.onWarmLaunch(
                                WarmLaunchData(
                                    process_start_uptime = LaunchState.processStartUptime,
                                    process_start_requested_uptime = LaunchState.processStartRequestedUptime,
                                    content_provider_attach_uptime = LaunchState.contentLoaderAttachUptime,
                                    app_visible_uptime = LaunchState.lastAppVisibleTime ?: 0,
                                    on_next_draw_uptime = onNextDrawUptime,
                                    launched_activity = onCreateRecord.activityName,
                                    has_saved_state = onCreateRecord.hasSavedState,
                                    intent_data = onCreateRecord.intentData,
                                    is_lukewarm = false,
                                ),
                            )
                        }

                        "Lukewarm" -> {
                            callbacks?.onWarmLaunch(
                                WarmLaunchData(
                                    process_start_uptime = LaunchState.processStartUptime,
                                    process_start_requested_uptime = LaunchState.processStartRequestedUptime,
                                    content_provider_attach_uptime = LaunchState.contentLoaderAttachUptime,
                                    app_visible_uptime = LaunchState.lastAppVisibleTime ?: 0,
                                    on_next_draw_uptime = onNextDrawUptime,
                                    launched_activity = onCreateRecord.activityName,
                                    has_saved_state = onCreateRecord.hasSavedState,
                                    intent_data = onCreateRecord.intentData,
                                    is_lukewarm = true,
                                ),
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

            // This could have been a cold launch, but the activity was created with a saved state.
            // Which reflects that the app was previously alive but the system evicted it from
            // memory, but still kept the saved state. This is a "lukewarm" launch as the activity
            // will still be created from scratch. It's not a cold launch as the system can benefit
            // from the saved state.
            LaunchState.processImportanceOnInit == IMPORTANCE_FOREGROUND && onCreateRecord.hasSavedState -> "Lukewarm"

            // This is clearly a cold launch as the process was started with a foreground importance
            // and does not have a saved state.
            LaunchState.processImportanceOnInit == IMPORTANCE_FOREGROUND -> "Cold"

            // This is a case where activity was created and resumed, but the app was
            // not launched with a foreground importance. The system started the app without
            // foreground importance but decided to change it's mind later. We track this as a
            // lukewarm launch as the system got a chance to warm up before deciding to bring the
            // activity to the foreground. Sadly we do not know when the system changed it's mind, so
            // we just use the same launch time as a cold launch. We cannot rely on
            // app_visible_uptime as it won't be set in this case.
            else -> "Lukewarm"
        }
    }
}
