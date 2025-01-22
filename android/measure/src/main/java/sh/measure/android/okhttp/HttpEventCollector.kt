package sh.measure.android.okhttp

internal interface HttpEventCollector {
    fun unregister()
    fun register()
}

/**
 * No-op implementation of [HttpEventCollector] when OkHttp is not available as a runtime dependency.
 */
internal class NoOpHttpEventCollector : HttpEventCollector {
    override fun unregister() {
        // No-op
    }

    override fun register() {
        // No-op
    }
}
