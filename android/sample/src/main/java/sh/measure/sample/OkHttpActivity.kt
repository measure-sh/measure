package sh.measure.sample

import android.os.Bundle
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
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

        okHttpClient.newCall(
            okhttp3.Request.Builder().url("https://httpbin.org/").get().build()
        ).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: java.io.IOException) {
                Log.e("OkHttpActivity", "onFailure", e)
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                Log.i("OkHttpActivity", "onResponse")
            }
        })
    }
}