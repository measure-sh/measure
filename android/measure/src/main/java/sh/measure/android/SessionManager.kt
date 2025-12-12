package sh.measure.android

import android.os.Build
import sh.measure.android.config.ConfigProvider
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.Database
import sh.measure.android.storage.SessionEntity
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.PackageInfoProvider
import sh.measure.android.utils.ProcessInfoProvider
import sh.measure.android.utils.Randomizer
import sh.measure.android.utils.TimeProvider
import java.util.concurrent.RejectedExecutionException

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
     * Call when app comes to foreground
     */
    fun onAppForeground()

    /**
     * Call when app goes to background
     */
    fun onAppBackground()

    /**
     * Clears sessions for tracking app exit which happened before the given [timestamp].
     */
    fun clearAppExitSessionsBefore(timestamp: Long)
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
    private val randomizer: Randomizer,
) : SessionManager {
    private var sessionId: String? = null
    private var appBackgroundTime: Long = 0

    override fun init(): String = createNewSession()

    override fun onAppForeground() {
        if (appBackgroundTime == 0L) {
            // happens when app hasn't gone to background yet
            // it's coming to foreground for the first time.
            return
        }
        if (shouldStartNewSession()) {
            createNewSession()
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

    override fun clearAppExitSessionsBefore(timestamp: Long) {
        database.clearAppExitSessionsBefore(timestamp)
    }

    private fun createNewSession(): String {
        val id = idProvider.uuid()
        val needsReporting = shouldMarkSessionForExport()
        val trackJourney = shouldTrackJourneyForSession()
        this.sessionId = id
        storeSession(id, needsReporting, trackJourney)
        logger.log(LogLevel.Debug, "SessionManager: New session created $id")
        return id
    }

    private fun shouldMarkSessionForExport(): Boolean {
        if (configProvider.samplingRateForErrorFreeSessions == 0.0f) {
            return false
        }
        if (configProvider.samplingRateForErrorFreeSessions == 1.0f) {
            return true
        }
        return randomizer.random() < configProvider.samplingRateForErrorFreeSessions
    }

    private fun shouldTrackJourneyForSession(): Boolean {
        if (configProvider.journeySamplingRate == 0.0f) {
            return false
        }
        if (configProvider.journeySamplingRate == 1.0f) {
            return true
        }
        return randomizer.random() < configProvider.journeySamplingRate
    }

    private fun storeSession(
        id: String,
        needsReporting: Boolean,
        trackJourney: Boolean,
    ) {
        try {
            ioExecutor.submit {
                val success = database.insertSession(
                    SessionEntity(
                        id,
                        processInfo.getPid(),
                        timeProvider.now(),
                        needsReporting = needsReporting,
                        supportsAppExit = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R,
                        appVersion = packageInfoProvider.appVersion,
                        appBuild = packageInfoProvider.getVersionCode(),
                        trackJourney = trackJourney,
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
            }
        } catch (e: RejectedExecutionException) {
            logger.log(LogLevel.Debug, "SessionManager: Failed to store session", e)
        }
    }

    private fun shouldStartNewSession(): Boolean = timeProvider.now() - appBackgroundTime > configProvider.sessionBackgroundTimeoutThresholdMs
}
