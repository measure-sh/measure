package sh.measure.sample

import android.os.Bundle
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import sh.measure.android.Measure
import sh.measure.android.tracing.Span
import sh.measure.android.tracing.SpanStatus
import java.util.concurrent.TimeUnit

class OkHttpActivity : AppCompatActivity() {
    private val okHttpClient by lazy {
        OkHttpClient.Builder().connectTimeout(10, TimeUnit.SECONDS)
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            })
            .readTimeout(10, TimeUnit.SECONDS)
            .build()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_second)

        val httpSpan = Measure.startSpan("http")
        try {
            okHttpClient.newCall(
                okhttp3.Request.Builder().url("https://httpbin.org/")
                    .header(
                        Measure.getTraceParentHeaderKey(),
                        Measure.getTraceParentHeaderValue(httpSpan),
                    )
                    .get().build()
            ).enqueue(object : okhttp3.Callback {
                override fun onFailure(call: okhttp3.Call, e: java.io.IOException) {
                    Log.e("OkHttpActivity", "onFailure", e)
                    httpSpan.setStatus(SpanStatus.Error).end()
                }

                override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                    Log.i("OkHttpActivity", "onResponse")
                    httpSpan.setStatus(SpanStatus.Ok).end()
                }
            })
        } catch (e: IllegalStateException) {
            httpSpan.setStatus(SpanStatus.Error).end()
        }
    }
}