package sh.measure.android.attributes

import sh.measure.android.utils.IdProvider

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
