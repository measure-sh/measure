package sh.measure.android.utils

internal interface SessionIdProvider {
    val sessionId: String
}

internal class SessionIdProviderImpl(
    private val idProvider: IdProvider
) : SessionIdProvider {
    override val sessionId: String by lazy {
        idProvider.createId()
    }
}
