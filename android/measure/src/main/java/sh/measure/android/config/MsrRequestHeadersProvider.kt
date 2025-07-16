package sh.measure.android.config

/**
 * Provides custom HTTP headers for requests made by the Measure SDK to the Measure API.
 *
 * This interface is primarily intended for self-hosted deployments where additional
 * headers may be required for authentication, routing, or other infrastructure needs.
 *
 * Implementations **must** be thread-safe as [getRequestHeaders] may be called
 * concurrently from multiple threads.
 *
 * The following headers are reserved by the SDK and will be ignored if provided:
 * - `Content-Type`
 * - `msr-req-id`
 * - `Authorization`
 * - `Content-Length`
 *
 * Example implementation:
 *
 * ```kotlin
 * class CustomHeaderProvider : MsrRequestHeadersProvider {
 *     private val requestHeaders: ConcurrentMap<String, String> = ConcurrentHashMap()
 *
 *     fun addHeader(key: String, value: String) {
 *         requestHeaders[key] = value
 *     }
 *
 *     fun removeHeader(key: String) {
 *         requestHeaders.remove(key)
 *     }
 *
 *     override fun getRequestHeaders(): Map<String, String> {
 *         return requestHeaders.toMap() // Return immutable copy
 *     }
 * }
 * ```
 */
interface MsrRequestHeadersProvider {
    /**
     * Returns a map of custom HTTP headers to include in Measure SDK requests.
     *
     * This method may be called multiple times and from different threads.
     * Implementations should return a consistent snapshot of headers at the time of the call.
     *
     * @return Map of header names to values.
     */
    fun getRequestHeaders(): Map<String, String>
}
