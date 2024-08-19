package sh.measure.android.okhttp

internal interface HttpEventCollector

/**
 * No-op implementation of [HttpEventCollector] when OkHttp is not available as a runtime dependency.
 */
internal class NoOpHttpEventCollector : HttpEventCollector
