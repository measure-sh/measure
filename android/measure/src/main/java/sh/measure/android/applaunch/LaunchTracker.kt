package sh.measure.android.applaunch

import android.app.Activity
import android.app.ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
import android.os.Bundle
import android.os.SystemClock
import android.util.Log
import curtains.onNextDraw
import sh.measure.android.config.ConfigProvider
import sh.measure.android.lifecycle.ActivityLifecycleAdapter
import sh.measure.android.mainHandler
import sh.measure.android.postAtFrontOfQueueAsync

internal interface LaunchCallbacks {
    fun onColdLaunch(coldLaunchData: ColdLaunchData, coldLaunchTime: Long?)
    fun onWarmLaunch(warmLaunchData: WarmLaunchData, warmLaunchTime: Long?)
    fun onHotLaunch(hotLaunchData: HotLaunchData)
}

// Holds launch data until the SDK is initialized.
internal class PreRegistrationData(
    val coldLaunchData: ColdLaunchData?,
    val coldLaunchTime: Long?,
    val warmLaunchData: WarmLaunchData?,
    val warmLaunchTime: Long?,
)

/**
 * Tracks cold, warm and hot launch.
 * Heavily inspired by [PAPA](https://github.com/square/papa/).
 */
internal class LaunchTracker : ActivityLifecycleAdapter {
    private var callbacks: LaunchCallbacks? = null
    private var coldLaunchComplete = false
    private var launchInProgress = false

    private var coldLaunchData: ColdLaunchData? = null
    private var coldLaunchTime: Long? = null
    private var warmLaunchData: WarmLaunchData? = null
    private var warmLaunchTime: Long? = null
    private var configProvider: ConfigProvider? = null

    private data class OnCreateRecord(
        val sameMessage: Boolean,
        val hasSavedState: Boolean,
        val intentData: String?,
        val activityName: String,
    )

    private val createdActivities = mutableMapOf<String, OnCreateRecord>()
    private val startedActivities = mutableListOf<String>()
    private val resumedActivities = mutableListOf<String>()

    fun registerCallbacks(
        callbacks: LaunchCallbacks,
        configProvider: ConfigProvider,
    ): PreRegistrationData {
        this.callbacks = callbacks
        this.configProvider = configProvider
        return PreRegistrationData(
            coldLaunchData = coldLaunchData,
            coldLaunchTime = coldLaunchTime,
            warmLaunchData = warmLaunchData,
            warmLaunchTime = warmLaunchTime,
        )
    }

    override fun onActivityPreCreated(activity: Activity, savedInstanceState: Bundle?) {
        val identityHash = Integer.toHexString(System.identityHashCode(activity))
        if (createdActivities[identityHash] == null) {
            handleActivityOnCreate(activity, savedInstanceState, identityHash)
        }
    }

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
        val identityHash = Integer.toHexString(System.identityHashCode(activity))
        if (createdActivities[identityHash] == null) {
            handleActivityOnCreate(activity, savedInstanceState, identityHash)
        }
    }

    private fun handleActivityOnCreate(
        activity: Activity,
        savedInstanceState: Bundle?,
        identityHash: String,
    ) {
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

    override fun onActivityResumed(activity: Activity) {
        val identityHash = Integer.toHexString(System.identityHashCode(activity))
        resumedActivities += identityHash
        val onCreateRecord = createdActivities[identityHash]
        activity.window.onNextDraw {
            mainHandler.postAtFrontOfQueueAsync {
                if (launchInProgress) {
                    val onNextDrawElapsedRealtime = SystemClock.elapsedRealtime()
                    onCreateRecord?.let { onCreateRecord ->
                        val launchType = computeLaunchType(onCreateRecord)
                        trackLaunchEvent(
                            launchType,
                            onNextDrawElapsedRealtime,
                            onCreateRecord,
                        )
                        launchInProgress = false
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

    private fun trackLaunchEvent(
        launchType: String,
        onNextDrawElapsedRealtime: Long,
        onCreateRecord: OnCreateRecord,
    ) {
        val intentData = getIntentData(onCreateRecord.intentData)
        when (launchType) {
            "Cold" -> {
                coldLaunchComplete = true
                val coldLaunchData = ColdLaunchData(
                    process_start_uptime = LaunchState.processStartElapsedRealtime,
                    process_start_requested_uptime = LaunchState.processStartRequestedElapsedRealtime,
                    content_provider_attach_uptime = LaunchState.contentLoaderAttachElapsedRealtime,
                    on_next_draw_uptime = onNextDrawElapsedRealtime,
                    launched_activity = onCreateRecord.activityName,
                    has_saved_state = onCreateRecord.hasSavedState,
                    intent_data = intentData,
                )
                if (callbacks != null) {
                    callbacks?.onColdLaunch(
                        coldLaunchData = coldLaunchData,
                        coldLaunchTime = System.currentTimeMillis(),
                    )
                } else {
                    this@LaunchTracker.coldLaunchData = coldLaunchData
                }
            }

            "Hot" -> {
                LaunchState.lastAppVisibleElapsedRealtime?.let {
                    val hotLaunchData = HotLaunchData(
                        app_visible_uptime = it,
                        on_next_draw_uptime = onNextDrawElapsedRealtime,
                        launched_activity = onCreateRecord.activityName,
                        has_saved_state = onCreateRecord.hasSavedState,
                        intent_data = intentData,
                    )
                    callbacks?.onHotLaunch(hotLaunchData)
                }
            }

            "Warm" -> {
                val warmLaunchData = WarmLaunchData(
                    process_start_uptime = LaunchState.processStartElapsedRealtime,
                    process_start_requested_uptime = LaunchState.processStartRequestedElapsedRealtime,
                    content_provider_attach_uptime = LaunchState.contentLoaderAttachElapsedRealtime,
                    app_visible_uptime = LaunchState.lastAppVisibleElapsedRealtime ?: 0,
                    on_next_draw_uptime = onNextDrawElapsedRealtime,
                    launched_activity = onCreateRecord.activityName,
                    has_saved_state = onCreateRecord.hasSavedState,
                    intent_data = intentData,
                    is_lukewarm = false,
                )
                if (callbacks != null) {
                    callbacks?.onWarmLaunch(warmLaunchData, System.currentTimeMillis())
                } else {
                    this@LaunchTracker.warmLaunchData = warmLaunchData
                }
            }

            "Lukewarm" -> {
                val warmLaunchData = WarmLaunchData(
                    process_start_uptime = LaunchState.processStartElapsedRealtime,
                    process_start_requested_uptime = LaunchState.processStartRequestedElapsedRealtime,
                    content_provider_attach_uptime = LaunchState.contentLoaderAttachElapsedRealtime,
                    app_visible_uptime = LaunchState.lastAppVisibleElapsedRealtime ?: 0,
                    on_next_draw_uptime = onNextDrawElapsedRealtime,
                    launched_activity = onCreateRecord.activityName,
                    has_saved_state = onCreateRecord.hasSavedState,
                    intent_data = intentData,
                    is_lukewarm = true,
                )
                if (callbacks != null) {
                    callbacks?.onWarmLaunch(warmLaunchData, System.currentTimeMillis())
                } else {
                    this@LaunchTracker.warmLaunchData = warmLaunchData
                }
            }

            else -> {
                Log.d("Measure", "Unknown launch type: $launchType")
            }
        }
    }

    private fun appMightBecomeVisible() {
        LaunchState.lastAppVisibleElapsedRealtime = SystemClock.elapsedRealtime()
    }

    private fun computeLaunchType(onCreateRecord: OnCreateRecord): String = when {
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
        // lastAppVisibleElapsedRealtime as it won't be set in this case.
        else -> "Lukewarm"
    }

    private fun getIntentData(intentData: String?): String? {
        if (configProvider?.trackActivityIntentData == true) {
            return intentData
        }
        return null
    }
}
