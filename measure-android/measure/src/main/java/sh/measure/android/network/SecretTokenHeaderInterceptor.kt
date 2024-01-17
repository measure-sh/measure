package sh.measure.android.network

import okhttp3.Interceptor
import okhttp3.Response
import java.io.IOException

internal class SecretTokenHeaderInterceptor(
    private val secretToken: String
) : Interceptor {

    @Throws(IOException::class)
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val authenticatedRequest =
            request.newBuilder().header("Authorization", "Bearer $secretToken").build()
        return chain.proceed(authenticatedRequest)
    }
}