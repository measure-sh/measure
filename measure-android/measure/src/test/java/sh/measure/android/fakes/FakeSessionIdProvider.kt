package sh.measure.android.fakes

import sh.measure.android.attributes.SessionIdProvider

internal class FakeSessionIdProvider : SessionIdProvider {
    override val sessionId: String = "fake-session-id"
}