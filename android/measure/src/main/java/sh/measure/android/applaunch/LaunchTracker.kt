package sh.measure.android.applaunch

import android.app.Activity
import android.app.ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
import android.os.Bundle
import curtains.onNextDraw
import sh.measure.android.config.ConfigProvider
import sh.measure.android.lifecycle.ActivityLifecycleAdapter
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.mainHandler
import sh.measure.android.postAtFrontOfQueueAsync
import sh.measure.android.tracing.AttributeName
import sh.measure.android.tracing.CheckpointName
import sh.measure.android.tracing.Span
import sh.measure.android.tracing.SpanName
import sh.measure.android.tracing.SpanStatus
import sh.measure.android.tracing.Tracer
import sh.measure.android.utils.TimeProvider

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
    private val timeProvider: TimeProvider,
    private val configProvider: ConfigProvider,
    private val tracer: Tracer,
) : ActivityLifecycleAdapter {

    private var callbacks: LaunchCallbacks? = null
    private var coldLaunchComplete = false
    private var launchInProgress = false

    private data class OnCreateRecord(
        val sameMessage: Boolean,
        val hasSavedState: Boolean,
        val intentData: String?,
        val activityName: String,
        val ttidSpan: Span? = null,
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

        val activityTtidSpan = if (savedInstanceState == null) {
            startActivityTtidSpan(activity)
        } else {
            null
        }

        createdActivities[identityHash] = OnCreateRecord(
            sameMessage = true,
            hasSavedState = hasSavedState,
            intentData = activity.intent.dataString,
            activityName = activity.javaClass.name,
            ttidSpan = activityTtidSpan,
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

        createdActivities[identityHash]?.let { onCreateRecord ->
            onCreateRecord.ttidSpan?.setCheckpoint(CheckpointName.ACTIVITY_STARTED)
        }
    }

    override fun onActivityResumed(activity: Activity) {
        val identityHash = Integer.toHexString(System.identityHashCode(activity))
        resumedActivities += identityHash
        val onCreateRecord = createdActivities[identityHash]
        onCreateRecord?.ttidSpan?.setCheckpoint(CheckpointName.ACTIVITY_RESUMED)
        activity.window.onNextDraw {
            mainHandler.postAtFrontOfQueueAsync {
                if (launchInProgress) {
                    val onNextDrawElapsedRealtime = timeProvider.elapsedRealtime
                    onCreateRecord?.let { onCreateRecord ->
                        val launchType = computeLaunchType(onCreateRecord)
                        trackLaunchEvent(
                            launchType,
                            onNextDrawElapsedRealtime,
                            onCreateRecord,
                        )
                        endActivityTtidSpan(identityHash, onCreateRecord.ttidSpan, launchType)
                        launchInProgress = false
                    }
                } else {
                    endActivityTtidSpan(identityHash, createdActivities[identityHash]?.ttidSpan)
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
        when (launchType) {
            "Cold" -> {
                coldLaunchComplete = true
                callbacks?.onColdLaunch(
                    coldLaunchData = ColdLaunchData(
                        process_start_uptime = LaunchState.processStartElapsedRealtime,
                        process_start_requested_uptime = LaunchState.processStartRequestedElapsedRealtime,
                        content_provider_attach_uptime = LaunchState.contentLoaderAttachElapsedRealtime,
                        on_next_draw_uptime = onNextDrawElapsedRealtime,
                        launched_activity = onCreateRecord.activityName,
                        has_saved_state = onCreateRecord.hasSavedState,
                        intent_data = onCreateRecord.intentData,
                    ),
                )
            }

            "Hot" -> {
                LaunchState.lastAppVisibleElapsedRealtime?.let {
                    callbacks?.onHotLaunch(
                        HotLaunchData(
                            app_visible_uptime = it,
                            on_next_draw_uptime = onNextDrawElapsedRealtime,
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
                        process_start_uptime = LaunchState.processStartElapsedRealtime,
                        process_start_requested_uptime = LaunchState.processStartRequestedElapsedRealtime,
                        content_provider_attach_uptime = LaunchState.contentLoaderAttachElapsedRealtime,
                        app_visible_uptime = LaunchState.lastAppVisibleElapsedRealtime ?: 0,
                        on_next_draw_uptime = onNextDrawElapsedRealtime,
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
                        process_start_uptime = LaunchState.processStartElapsedRealtime,
                        process_start_requested_uptime = LaunchState.processStartRequestedElapsedRealtime,
                        content_provider_attach_uptime = LaunchState.contentLoaderAttachElapsedRealtime,
                        app_visible_uptime = LaunchState.lastAppVisibleElapsedRealtime ?: 0,
                        on_next_draw_uptime = onNextDrawElapsedRealtime,
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

    private fun appMightBecomeVisible() {
        LaunchState.lastAppVisibleElapsedRealtime = timeProvider.elapsedRealtime
        logger.log(
            LogLevel.Debug,
            "Updated last app visible time: ${LaunchState.lastAppVisibleElapsedRealtime}",
        )
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
            // lastAppVisibleElapsedRealtime as it won't be set in this case.
            else -> "Lukewarm"
        }
    }

    private fun startActivityTtidSpan(activity: Activity): Span? {
        if (!isActivityTtidSpanEnabled()) {
            return null
        }
        val span = tracer.spanBuilder(SpanName.activityTtidSpan(activity)).startSpan()
        span.setCheckpoint(CheckpointName.ACTIVITY_CREATED)
        return span
    }

    private fun endActivityTtidSpan(
        activityIdentityHash: String,
        ttidSpan: Span?,
        launchType: String? = null,
    ) {
        if (launchType == "Cold") {
            ttidSpan?.setAttribute(AttributeName.APP_STARTUP_FIRST_ACTIVITY, true)
        }
        ttidSpan?.setStatus(SpanStatus.Ok)?.end()
        if (activityIdentityHash in createdActivities && ttidSpan != null) {
            createdActivities[activityIdentityHash]?.copy(ttidSpan = null)?.let {
                createdActivities[activityIdentityHash] = it
            }
        }
    }

    private fun isActivityTtidSpanEnabled(): Boolean {
        return configProvider.trackActivityLoadTime
    }
}
