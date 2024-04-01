package sh.measure.android.events

internal class SessionIdAppender : EventTransformer {
    lateinit var sessionId: String

    override fun <T> transform(event: Event<T>): Event<T>? {
        assert(::sessionId.isInitialized) { "SessionIdAppender must have a sessionId set" }
        event.sessionId = sessionId
        return event
    }
}