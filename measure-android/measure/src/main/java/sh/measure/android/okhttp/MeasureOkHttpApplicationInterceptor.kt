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
    private val eventProcessor: OkHttpEventProcessor,
) : Interceptor {

    constructor() : this(Measure.getOkHttpEventProcessor())

    override fun intercept(chain: Interceptor.Chain): Response {
        val call = chain.call()
        val request: Request = chain.request()
        eventProcessor.request(call, request)
        val response: Response = chain.proceed(request)
        eventProcessor.response(call, request, response)
        return response
    }

    private fun getIdentityHash(call: Call): String =
        Integer.toHexString(System.identityHashCode(call))
}
