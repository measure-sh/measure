package sh.frankenstein.android

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
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
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

class OkHttpActivity : ComponentActivity() {
    private val okHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            })
            .build()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MeasureTheme {
                OkHttpScreen(
                    onBack = { finish() },
                    onSendRequest = ::sendRequest,
                )
            }
        }
    }

    private fun sendRequest(
        config: RequestConfig,
        onResult: (String) -> Unit,
    ) {
        val url = "$BASE_URL${config.path}"
        onResult("Sending ${config.method} $url via ${config.client.label}...")

        val span = Measure.startSpan("http")
        when (config.client) {
            HttpClient.OK_HTTP -> sendViaOkHttp(url, config, span, onResult)
            HttpClient.URL_CONNECTION -> sendViaUrlConnection(url, config, span, onResult)
        }
    }

    private fun sendViaOkHttp(
        url: String,
        config: RequestConfig,
        span: Span,
        onResult: (String) -> Unit,
    ) {
        val requestBuilder = Request.Builder()
            .url(url)
            .header(Measure.getTraceParentHeaderKey(), Measure.getTraceParentHeaderValue(span))

        if (config.headerKey.isNotBlank()) {
            requestBuilder.header(config.headerKey, config.headerValue)
        }

        if (config.method == "POST") {
            val body = if (config.includeBody) REQUEST_BODY else ""
            requestBuilder.post(body.toRequestBody("application/json".toMediaType()))
        } else {
            requestBuilder.get()
        }

        executeOkHttpRequest(requestBuilder.build(), span, onResult)
    }

    private fun sendViaUrlConnection(
        url: String,
        config: RequestConfig,
        span: Span,
        onResult: (String) -> Unit,
    ) {
        // HttpURLConnection blocks on connect/read, so run off the main thread.
        thread(name = "frank-urlconn") {
            try {
                val conn = URL(url).openConnection() as HttpURLConnection
                try {
                    conn.requestMethod = config.method
                    conn.connectTimeout = TIMEOUT_MS
                    conn.readTimeout = TIMEOUT_MS
                    conn.setRequestProperty(
                        Measure.getTraceParentHeaderKey(),
                        Measure.getTraceParentHeaderValue(span),
                    )
                    if (config.headerKey.isNotBlank()) {
                        conn.setRequestProperty(config.headerKey, config.headerValue)
                    }
                    if (config.method == "POST") {
                        conn.doOutput = true
                        conn.setRequestProperty("Content-Type", "application/json")
                        val payload = if (config.includeBody) REQUEST_BODY else ""
                        conn.outputStream.use { it.write(payload.toByteArray()) }
                    }

                    val code = conn.responseCode
                    val body = (conn.errorStream ?: conn.inputStream)
                        .bufferedReader().use { it.readText() }
                    if (code in 200..299) {
                        span.setStatus(SpanStatus.Ok).end()
                    } else {
                        span.setStatus(SpanStatus.Error).end()
                    }
                    runOnUiThread { onResult("Status: $code\n\n$body") }
                } finally {
                    conn.disconnect()
                }
            } catch (e: IOException) {
                Log.e(TAG, "urlconn failure", e)
                span.setStatus(SpanStatus.Error).end()
                runOnUiThread { onResult("Failed\n\n${e.message}") }
            }
        }
    }

    private fun executeOkHttpRequest(request: Request, span: Span, onResult: (String) -> Unit) {
        try {
            okHttpClient.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    Log.e(TAG, "onFailure", e)
                    span.setStatus(SpanStatus.Error).end()
                    runOnUiThread { onResult("Failed\n\n${e.message}") }
                }

                override fun onResponse(call: Call, response: Response) {
                    val code = response.code
                    val body = response.body?.string() ?: "(empty)"
                    if (response.isSuccessful) {
                        span.setStatus(SpanStatus.Ok).end()
                    } else {
                        span.setStatus(SpanStatus.Error).end()
                    }
                    runOnUiThread { onResult("Status: $code\n\n$body") }
                    response.close()
                }
            })
        } catch (e: Exception) {
            Log.e(TAG, "exception", e)
            span.setStatus(SpanStatus.Error).end()
            onResult("Exception\n\n${e.message}")
        }
    }

    companion object {
        private const val TAG = "OkHttpActivity"
        private const val BASE_URL = "https://postman-echo.com"
        private const val TIMEOUT_MS = 10_000
        private const val REQUEST_BODY =
            """{"user":"test@example.com","action":"login","timestamp":1234567890}"""

        internal val RANDOM_PATHS = listOf(
            "/get",
            "/post",
            "/get?foo=bar&baz=qux",
            "/status/200",
            "/status/400",
            "/status/500",
            "/delay/2",
        )
    }
}

private enum class HttpClient(val label: String) {
    OK_HTTP("OkHttp"),
    URL_CONNECTION("HttpURLConnection"),
}

private data class RequestConfig(
    val path: String,
    val method: String,
    val headerKey: String,
    val headerValue: String,
    val includeBody: Boolean,
    val client: HttpClient,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun OkHttpScreen(
    onBack: () -> Unit,
    onSendRequest: (RequestConfig, (String) -> Unit) -> Unit,
) {
    var path by remember { mutableStateOf("/get") }
    var method by remember { mutableStateOf("GET") }
    var headerKey by remember { mutableStateOf("") }
    var headerValue by remember { mutableStateOf("") }
    var includeBody by remember { mutableStateOf(false) }
    var client by remember { mutableStateOf(HttpClient.OK_HTTP) }
    var response by remember { mutableStateOf("Ready") }
    var isLoading by remember { mutableStateOf(false) }

    val textFieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = MaterialTheme.colorScheme.primary,
        focusedLabelColor = MaterialTheme.colorScheme.primary,
        cursorColor = MaterialTheme.colorScheme.primary,
    )

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("HTTP Client") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    isLoading = true
                    val config = RequestConfig(
                        path = path.ifBlank { "/get" }.let { if (it.startsWith("/")) it else "/$it" },
                        method = method,
                        headerKey = headerKey,
                        headerValue = headerValue,
                        includeBody = includeBody,
                        client = client,
                    )
                    onSendRequest(config) { result ->
                        response = result
                        isLoading = false
                    }
                },
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ) {
                if (isLoading) {
                    CircularProgressIndicator(
                        color = MaterialTheme.colorScheme.onPrimary,
                        strokeWidth = 2.dp,
                        modifier = Modifier.padding(12.dp),
                    )
                } else {
                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send")
                }
            }
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // URL section
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.medium,
                color = MaterialTheme.colorScheme.surface.copy(alpha = 0.6f),
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Request",
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    // Client chips
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        HttpClient.values().forEach { c ->
                            FilterChip(
                                selected = client == c,
                                onClick = { client = c },
                                label = { Text(c.label) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = MaterialTheme.colorScheme.primary,
                                    selectedLabelColor = MaterialTheme.colorScheme.onPrimary,
                                ),
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // Method chips
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("GET", "POST").forEach { m ->
                            FilterChip(
                                selected = method == m,
                                onClick = { method = m },
                                label = { Text(m) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = MaterialTheme.colorScheme.primary,
                                    selectedLabelColor = MaterialTheme.colorScheme.onPrimary,
                                ),
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // Path input
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        OutlinedTextField(
                            value = path,
                            onValueChange = { path = it },
                            label = { Text("Path") },
                            placeholder = { Text("/get") },
                            singleLine = true,
                            colors = textFieldColors,
                            modifier = Modifier.weight(1f),
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        IconButton(onClick = {
                            path = OkHttpActivity.RANDOM_PATHS.random()
                        }) {
                            Icon(
                                Icons.Default.Refresh,
                                contentDescription = "Random path",
                                tint = MaterialTheme.colorScheme.primary,
                            )
                        }
                    }

                    // URL preview
                    Text(
                        text = "https://postman-echo.com${path.ifBlank { "/get" }}",
                        style = MaterialTheme.typography.bodySmall,
                        fontFamily = FontFamily.Monospace,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 4.dp),
                    )

                    // Include body checkbox (visible for POST)
                    AnimatedVisibility(
                        visible = method == "POST",
                        enter = fadeIn(),
                        exit = fadeOut(),
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(top = 8.dp),
                        ) {
                            Checkbox(
                                checked = includeBody,
                                onCheckedChange = { includeBody = it },
                                colors = CheckboxDefaults.colors(
                                    checkedColor = MaterialTheme.colorScheme.primary,
                                ),
                            )
                            Text(
                                text = "Include JSON body",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                        }
                    }
                }
            }

            // Headers section
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.medium,
                color = MaterialTheme.colorScheme.surface.copy(alpha = 0.6f),
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Custom Header",
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = headerKey,
                            onValueChange = { headerKey = it },
                            label = { Text("Key") },
                            singleLine = true,
                            colors = textFieldColors,
                            modifier = Modifier.weight(1f),
                        )
                        OutlinedTextField(
                            value = headerValue,
                            onValueChange = { headerValue = it },
                            label = { Text("Value") },
                            singleLine = true,
                            colors = textFieldColors,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }

            // Response section
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.medium,
                color = MaterialTheme.colorScheme.surface.copy(alpha = 0.6f),
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Response",
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = MaterialTheme.shapes.small,
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                    ) {
                        Text(
                            text = response,
                            style = MaterialTheme.typography.bodySmall,
                            fontFamily = FontFamily.Monospace,
                            color = MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier
                                .padding(12.dp)
                                .horizontalScroll(rememberScrollState()),
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(72.dp)) // space for FAB
        }
    }
}
