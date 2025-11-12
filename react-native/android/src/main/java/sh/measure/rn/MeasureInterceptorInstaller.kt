package sh.measure.rn

import com.facebook.react.modules.network.OkHttpClientProvider
import com.facebook.react.modules.network.ReactCookieJarContainer
import okhttp3.OkHttpClient
import sh.measure.android.okhttp.MeasureOkHttpApplicationInterceptor

object MeasureInterceptorInstaller {
    fun install() {
        try {
            OkHttpClientProvider.setOkHttpClientFactory {
                OkHttpClient.Builder()
                    .addInterceptor(MeasureOkHttpApplicationInterceptor())
                    .cookieJar(ReactCookieJarContainer())
                    .build()
            }
            android.util.Log.i("MeasureRN", "✅ Measure interceptor injected via RN package")
        } catch (e: Exception) {
            android.util.Log.e("MeasureRN", "⚠️ Failed to inject Measure interceptor", e)
        }
    }
}