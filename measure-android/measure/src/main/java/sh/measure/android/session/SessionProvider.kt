package sh.measure.android.session

import sh.measure.android.id.IdProvider
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.time.TimeProvider

internal interface ISessionManager {
    val session: Session
    fun createSession()
}

internal class SessionProvider(
    private val logger: Logger,
    private val timeProvider: TimeProvider,
    private val idProvider: IdProvider,
    private val resourceFactory: ResourceFactory,
) : ISessionManager {
    override lateinit var session: Session
        private set

    override fun createSession() {
        session = Session(
            id = idProvider.createId(),
            startTime = timeProvider.currentTimeSinceEpochInMillis,
            resource = resourceFactory.create()
        )
        logger.log(LogLevel.Debug, "Session created: ${session.id}")
    }
}
