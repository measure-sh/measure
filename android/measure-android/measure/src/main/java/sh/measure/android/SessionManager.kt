package sh.measure.android

import androidx.annotation.VisibleForTesting
import sh.measure.android.config.ConfigProvider
import sh.measure.android.config.DefaultConfig
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.Database
import sh.measure.android.storage.SessionEntity
import sh.measure.android.storage.SessionRecord
import sh.measure.android.tracing.InternalTrace
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.PackageInfoProvider
import sh.measure.android.utils.ProcessInfoProvider
import sh.measure.android.utils.Sampler
import sh.measure.android.utils.TimeProvider
import java.util.concurrent.RejectedExecutionException

/**
 * Callback to be called when a new session is created.
 */
internal interface SessionStartListener {
    fun onSessionStart(sessionId: String, startTime: Long)
}

internal interface SessionManager {
    /**
     * Creates a new session, to be used only when the SDK is initialized.
     *
     * @return the session ID
     */
    fun init(): String

    /**
     * Returns the current session ID.
     *
     * @throws IllegalArgumentException if the SDK has not been initialized and the session id
     * has not been created.
     */
    @Throws(IllegalArgumentException::class)
    fun getSessionId(): String

    /**
     * Returns the start time of the current session.
     *
     * @throws IllegalArgumentException if the SDK has not been initialized and the session
     * has not been created.
     */
    @Throws(IllegalArgumentException::class)
    fun getSessionStartTime(): Long

    /**
     * Called when app comes to foreground
     */
    fun onAppForeground()

    /**
     * Called when app goes to background
     */
    fun onAppBackground()

    /**
     * Called when config is loaded.
     */
    fun onConfigLoaded()

    /**
     * Records that [sessionId] experienced an ANR at [anrTimeMs], so that signals delivered
     * later (e.g. profiles finalized after a relaunch) can be attributed to the session that
     * was live when the ANR occurred. Runs synchronously as it is called on the ANR'd thread,
     * which may not survive.
     */
    fun markSessionWithAnr(sessionId: String, anrTimeMs: Long)

    /**
     * Returns the session to attribute an app exit to, given the process ID the
     * exit was reported for. Sessions already marked by [markSessionsAppExitTracked]
     * are ignored.
     *
     * @param pid The process ID the app exit was reported for.
     * @return Session data if found, `null` otherwise.
     */
    fun getSessionForAppExit(pid: Int): SessionRecord?

    /**
     * Marks all sessions except the current one as having had their app exit
     * tracked, hiding them from [getSessionForAppExit] so an app exit is never
     * reported twice.
     */
    fun markSessionsAppExitTracked()

    /**
     * Returns the session that was active at the given time, based on session
     * start times.
     *
     * @param timeMs Time in milliseconds since epoch.
     * @return Session data if a session started at or before [timeMs], `null` otherwise.
     */
    fun getSessionForTime(timeMs: Long): SessionRecord?

    /**
     * Returns the most recent session that had an ANR at or before [timeMs] and
     * within [maxGapMs] of it. Used to attribute an ANR profile back to the
     * session where the ANR happened, even after a relaunch. The gap bounds the
     * lookup so a profile is never attributed to a stale, unrelated ANR.
     *
     * @param timeMs The profile's capture time in milliseconds since epoch.
     * @param maxGapMs The maximum allowed gap between the ANR and [timeMs].
     * @return Session data if a matching ANR session is found, `null` otherwise.
     */
    fun getSessionForAnr(timeMs: Long, maxGapMs: Long): SessionRecord?

    /**
     * Sets a listener to be called when a new session is created.
     *
     * @param listener the listener to be called
     */
    fun setSessionStartListener(listener: SessionStartListener)
}

/**
 * Manages creation of sessions.
 *
 * A new session is created when [getSessionId] is first called. A session ends when the app comes
 * back to foreground after being in background for more than [ConfigProvider.sessionBackgroundTimeoutThresholdMs].
 */
internal class SessionManagerImpl(
    private val logger: Logger,
    private val idProvider: IdProvider,
    private val database: Database,
    private val ioExecutor: MeasureExecutorService,
    private val processInfo: ProcessInfoProvider,
    private val timeProvider: TimeProvider,
    private val configProvider: ConfigProvider,
    private val packageInfoProvider: PackageInfoProvider,
    private val sampler: Sampler,
) : SessionManager {
    private var sessionStartListener: SessionStartListener? = null
    private var sessionId: String? = null
    private var sessionStartTime: Long? = null

    @VisibleForTesting
    internal var appBackgroundTime: Long = 0

    override fun init(): String {
        val sessionId = createNewSession()
        logger.log(LogLevel.Debug, "SessionManager: New session created $sessionId")
        return sessionId
    }

    override fun onAppForeground() {
        if (appBackgroundTime == 0L) {
            // happens when app hasn't gone to background, yet
            // it's coming to foreground for the first time.
            return
        }
        if (shouldStartNewSession()) {
            val sessionId = createNewSession()
            logger.log(
                LogLevel.Debug,
                "SessionManager: New session created $sessionId after app came to foreground",
            )
        }

        // reset state
        appBackgroundTime = 0
    }

    override fun onAppBackground() {
        appBackgroundTime = timeProvider.now()
    }

    override fun getSessionId(): String {
        val sessionId = this.sessionId
        requireNotNull(sessionId) {
            "SDK must be initialized before accessing current session id"
        }
        return sessionId
    }

    override fun getSessionStartTime(): Long {
        val startTime = this.sessionStartTime
        requireNotNull(startTime) {
            "SDK must be initialized before accessing session start time"
        }
        return startTime
    }

    override fun onConfigLoaded() {
        val currentSessionId = sessionId ?: return
        if (sampler.shouldTrackJourneyForSession(currentSessionId)) {
            try {
                ioExecutor.submit {
                    InternalTrace.trace(
                        { "msr-markSessionForJourneyTracking" },
                        {
                            database.sampleJourneyEvents(currentSessionId, DefaultConfig.JOURNEY_EVENTS)
                        },
                    )
                }
            } catch (e: RejectedExecutionException) {
                logger.log(
                    LogLevel.Error,
                    "SessionManager: Failed to mark session for journey tracking",
                    e,
                )
            }
        }
    }

    override fun markSessionWithAnr(sessionId: String, anrTimeMs: Long) {
        database.setSessionAnrTime(sessionId, anrTimeMs)
    }

    override fun getSessionForAppExit(pid: Int): SessionRecord? = database.getSessionForAppExit(pid)

    override fun markSessionsAppExitTracked() {
        database.markSessionsAppExitTracked(excludeSessionId = getSessionId())
    }

    override fun getSessionForTime(timeMs: Long): SessionRecord? = database.getSessionForTime(timeMs)

    override fun getSessionForAnr(timeMs: Long, maxGapMs: Long): SessionRecord? = database.getSessionForAnr(timeMs, maxGapMs)

    override fun setSessionStartListener(listener: SessionStartListener) {
        this.sessionStartListener = listener
    }

    private fun createNewSession(): String {
        val id = idProvider.uuid()
        val startTime = timeProvider.now()
        this.sessionId = id
        this.sessionStartTime = startTime
        sessionStartListener?.onSessionStart(id, startTime)
        storeSession(id, startTime)
        return id
    }

    private fun storeSession(id: String, startTime: Long) {
        try {
            ioExecutor.submit {
                InternalTrace.trace(
                    { "msr-storeSession" },
                    {
                        val pid = processInfo.getPid()
                        val success = database.insertSession(
                            SessionEntity(
                                id,
                                pid,
                                startTime,
                                appVersion = packageInfoProvider.appVersion,
                                appBuild = packageInfoProvider.getVersionCode(),
                            ),
                        )
                        if (!success) {
                            logger.log(LogLevel.Debug, "SessionManager: Failed to store session")
                        } else {
                            logger.log(
                                LogLevel.Debug,
                                "SessionManager: Session ID stored successfully in DB",
                            )
                        }
                    },
                )
            }
        } catch (e: RejectedExecutionException) {
            logger.log(LogLevel.Debug, "SessionManager: Failed to store session", e)
        }
    }

    private fun shouldStartNewSession(): Boolean = timeProvider.now() - appBackgroundTime > configProvider.sessionBackgroundTimeoutThresholdMs
}
