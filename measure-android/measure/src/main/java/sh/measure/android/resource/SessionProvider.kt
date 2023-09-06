package sh.measure.android.resource

import sh.measure.android.id.IdProvider

/**
 * Manages the session ID. The session ID is created lazily, and is immutable.
 */
internal class SessionProvider(private val idProvider: IdProvider) {
    val sessionId by lazy { createSession() }

    private fun createSession(): String {
        return idProvider.createId()
    }
}
