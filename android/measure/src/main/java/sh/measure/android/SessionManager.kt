package sh.measure.android

import android.os.Build
import androidx.annotation.VisibleForTesting
import sh.measure.android.config.ConfigProvider
import sh.measure.android.config.DefaultConfig
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.Database
import sh.measure.android.storage.SessionEntity
import sh.measure.android.tracing.InternalTrace
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.PackageInfoProvider
import sh.measure.android.utils.ProcessInfoProvider
import sh.measure.android.utils.Sampler
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
    private var sessionId: String? = null

    @VisibleForTesting
    internal var appBackgroundTime: Long = 0

    override fun init(): String {
        val sessionId = createNewSession()
        logger.log(LogLevel.Debug, "SessionManager: New session created $sessionId")
        return sessionId
    }

    override fun onAppForeground() {
        if (appBackgroundTime == 0L) {
            // happens when app hasn't gone to background yet
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

    override fun onConfigLoaded() {
        val currentSessionId = sessionId
        if (currentSessionId == null) {
            return
        }
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

    private fun createNewSession(): String {
        val id = idProvider.uuid()
        this.sessionId = id
        storeSession(id)
        return id
    }

    private fun storeSession(id: String) {
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
                                timeProvider.now(),
                                supportsAppExit = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R,
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
