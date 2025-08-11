package sh.measure.android.okhttp

import okhttp3.Call
import okhttp3.Interceptor
import okhttp3.Request
import okhttp3.Response
import sh.measure.android.Measure

/**
 * An OkHttp interceptor that allows tracking headers, body for both request and response.
 */
@Suppress("unused")
class MeasureOkHttpApplicationInterceptor internal constructor(
    private val okHttpEventCollector: OkHttpEventCollector?,
) : Interceptor {

    /**
     * Default constructor for production use and ASM bytecode transformation.
     *
     * Passes null to force lazy evaluation of the collector in intercept().
     * This prevents issues where Measure.getOkHttpEventCollector() returns null
     * during early initialization but becomes available later.
     *
     * The ASM transformation in OkHttpMethodVisitor calls this no-arg constructor
     * when injecting the interceptor into OkHttpClient.Builder.
     */
    constructor() : this(null)

    override fun intercept(chain: Interceptor.Chain): Response {
        val call = chain.call()
        val request: Request = chain.request()

        // Use injected collector if provided (for tests), otherwise get it fresh each time.
        // This lazy evaluation ensures we get the collector even if it wasn't available
        // when this interceptor was constructed.
        val collector = okHttpEventCollector ?: Measure.getOkHttpEventCollector()

        collector?.request(call, request)
        val response: Response = chain.proceed(request)
        collector?.response(call, request, response)
        return response
    }

    private fun getIdentityHash(call: Call): String =
        Integer.toHexString(System.identityHashCode(call))
}