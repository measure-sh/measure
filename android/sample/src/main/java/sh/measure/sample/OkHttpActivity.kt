package sh.measure.sample

import android.annotation.SuppressLint
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.util.Log
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.RadioGroup
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import sh.measure.android.Measure
import sh.measure.android.tracing.Span
import sh.measure.android.tracing.SpanStatus
import java.io.IOException
import java.util.concurrent.TimeUnit

class OkHttpActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "OkHttpActivity"
        private const val BASE_URL = "https://postman-echo.com"
        private const val REQUEST_BODY = """{"user":"test@example.com","action":"login","timestamp":1234567890}"""

        private val RANDOM_PATHS = listOf(
            "/get",
            "/post",
            "/get?foo=bar&baz=qux",
            "/status/200",
            "/status/400",
            "/status/500",
            "/delay/2",
        )
    }

    private val okHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            })
            .build()
    }

    private lateinit var etPath: EditText
    private lateinit var tvUrlPreview: TextView
    private lateinit var etHeaderKey: EditText
    private lateinit var etHeaderValue: EditText
    private lateinit var rgMethod: RadioGroup
    private lateinit var cbRequestBody: CheckBox
    private lateinit var tvStatus: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_http)

        etPath = findViewById(R.id.et_path)
        tvUrlPreview = findViewById(R.id.tv_url_preview)
        etHeaderKey = findViewById(R.id.et_header_key)
        etHeaderValue = findViewById(R.id.et_header_value)
        rgMethod = findViewById(R.id.rg_method)
        cbRequestBody = findViewById(R.id.cb_request_body)
        tvStatus = findViewById(R.id.tv_status)

        // Update URL preview as path changes
        etPath.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                updateUrlPreview()
            }
        })

        findViewById<Button>(R.id.btn_random).setOnClickListener {
            val randomPath = RANDOM_PATHS.random()
            etPath.setText(randomPath)
        }

        findViewById<Button>(R.id.btn_send).setOnClickListener {
            sendRequest()
        }

        updateUrlPreview()
    }

    private fun updateUrlPreview() {
        val path = getPath()
        tvUrlPreview.text = "$BASE_URL$path"
    }

    private fun getPath(): String {
        return etPath.text.toString().takeIf { it.isNotBlank() }?.let {
            if (it.startsWith("/")) it else "/$it"
        } ?: "/get"
    }

    private fun sendRequest() {
        val path = getPath()
        val url = "$BASE_URL$path"
        val isPost = rgMethod.checkedRadioButtonId == R.id.rb_post
        val includeBody = cbRequestBody.isChecked

        val headerKey = etHeaderKey.text.toString().takeIf { it.isNotBlank() }
        val headerValue = etHeaderValue.text.toString()

        updateStatus("⏳ ${if (isPost) "POST" else "GET"} $url\nSending...")

        val span = Measure.startSpan("http")

        val requestBuilder = Request.Builder()
            .url(url)
            .header(Measure.getTraceParentHeaderKey(), Measure.getTraceParentHeaderValue(span))

        if (headerKey != null) {
            requestBuilder.header(headerKey, headerValue)
        }

        if (isPost) {
            val body = if (includeBody) REQUEST_BODY else ""
            requestBuilder.post(body.toRequestBody("application/json".toMediaType()))
        } else {
            requestBuilder.get()
        }

        executeRequest(requestBuilder.build(), span)
    }

    private fun executeRequest(request: Request, span: Span) {
        try {
            okHttpClient.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    Log.e(TAG, "onFailure", e)
                    span.setStatus(SpanStatus.Error).end()
                    updateStatus("❌ Failed\n\n${e.message}")
                }

                override fun onResponse(call: Call, response: Response) {
                    val code = response.code
                    val body = response.body?.string() ?: "(empty)"
                    Log.i(TAG, "onResponse: $code")

                    if (response.isSuccessful) {
                        span.setStatus(SpanStatus.Ok).end()
                    } else {
                        span.setStatus(SpanStatus.Error).end()
                    }

                    updateStatus("✅ Status: $code\n\nResponse:\n$body")
                    response.close()
                }
            })
        } catch (e: Exception) {
            Log.e(TAG, "exception", e)
            span.setStatus(SpanStatus.Error).end()
            updateStatus("❌ Exception\n\n${e.message}")
        }
    }

    private fun updateStatus(message: String) {
        runOnUiThread {
            tvStatus.text = message
        }
    }
}