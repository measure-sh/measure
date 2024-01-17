package sh.measure.android.session

import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.PidProvider
import sh.measure.android.utils.TimeProvider

internal interface ISessionProvider {
    val session: Session
    fun createSession()
}

internal class SessionProvider(
    private val timeProvider: TimeProvider,
    private val idProvider: IdProvider,
    private val pidProvider: PidProvider,
    private val resourceFactory: ResourceFactory,
) : ISessionProvider {
    override lateinit var session: Session
        private set

    override fun createSession() {
        session = Session(
            id = idProvider.createId(),
            startTime = timeProvider.currentTimeSinceEpochInMillis,
            resource = resourceFactory.create(),
            pid = pidProvider.getPid(),
        )
    }
}
