package com.frankenstein.shared

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
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import io.ktor.client.HttpClient
import io.ktor.client.request.headers
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpMethod
import io.ktor.http.contentType
import kotlinx.coroutines.launch
import sh.measure.kmp.Measure
import sh.measure.kmp.tracing.SpanStatus

private const val BASE_URL = "https://postman-echo.com"
private const val REQUEST_BODY =
    """{"user":"test@example.com","action":"login","timestamp":1234567890}"""

private val RANDOM_PATHS = listOf(
    "/get",
    "/post",
    "/get?foo=bar&baz=qux",
    "/status/200",
    "/status/400",
    "/status/500",
    "/delay/2",
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HttpClientScreen(onBack: () -> Unit) {
    var path by remember { mutableStateOf("/get") }
    var method by remember { mutableStateOf("GET") }
    var headerKey by remember { mutableStateOf("") }
    var headerValue by remember { mutableStateOf("") }
    var includeBody by remember { mutableStateOf(false) }
    var response by remember { mutableStateOf("Ready") }
    var isLoading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

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
                    TextButton(onClick = onBack) { Text("Back") }
                },
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = {
                    if (isLoading) return@ExtendedFloatingActionButton
                    val effectivePath = path.ifBlank { "/get" }
                        .let { if (it.startsWith("/")) it else "/$it" }
                    val config = RequestConfig(
                        path = effectivePath,
                        method = method,
                        headerKey = headerKey,
                        headerValue = headerValue,
                        includeBody = includeBody,
                    )
                    isLoading = true
                    response = "Sending ${config.method} $BASE_URL${config.path}..."
                    scope.launch {
                        response = sendRequest(config)
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
                        modifier = Modifier.padding(end = 8.dp).height(16.dp).width(16.dp),
                    )
                    Text("Sending")
                } else {
                    Text("Send")
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
                        TextButton(onClick = { path = RANDOM_PATHS.random() }) {
                            Text("Random")
                        }
                    }
                    Text(
                        text = "$BASE_URL${path.ifBlank { "/get" }}",
                        style = MaterialTheme.typography.bodySmall,
                        fontFamily = FontFamily.Monospace,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                    if (method == "POST") {
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
            Spacer(modifier = Modifier.height(72.dp))
        }
    }
}

private data class RequestConfig(
    val path: String,
    val method: String,
    val headerKey: String,
    val headerValue: String,
    val includeBody: Boolean,
)

// HTTP events are auto-tracked at the transport layer — OkHttp on Android (via the
// measure gradle plugin) and NSURLSession on iOS (via swizzle). The span here is only
// for distributed tracing via the traceparent header.
private suspend fun sendRequest(config: RequestConfig): String {
    val url = "$BASE_URL${config.path}"
    val span = Measure.startSpan("http")
    val traceparentKey = Measure.getTraceParentHeaderKey()
    val traceparentValue = Measure.getTraceParentHeaderValue(span)

    val client = HttpClient()
    return try {
        val httpResponse: HttpResponse = client.request(url) {
            method = HttpMethod.parse(config.method)
            headers {
                append(traceparentKey, traceparentValue)
                if (config.headerKey.isNotBlank()) append(config.headerKey, config.headerValue)
            }
            if (config.method == "POST") {
                contentType(ContentType.Application.Json)
                if (config.includeBody) setBody(REQUEST_BODY)
            }
        }
        val statusCode = httpResponse.status.value
        val body = runCatching { httpResponse.bodyAsText() }.getOrDefault("(empty)")
        span.setStatus(if (statusCode in 200..299) SpanStatus.Ok else SpanStatus.Error).end()
        "Status: $statusCode\n\n$body"
    } catch (t: Throwable) {
        span.setStatus(SpanStatus.Error).end()
        "Failed\n\n${t.message}"
    } finally {
        client.close()
    }
}
