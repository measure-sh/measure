package com.frankenstein.shared

import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import sh.measure.kmp.Measure
import sh.measure.kmp.attributes.StringAttr

private val MeasureLightColors = lightColorScheme(
    primary = Color(0xFF2E7D32),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFB8F5B0),
    onPrimaryContainer = Color(0xFF002204),
    background = Color(0xFFFAFAFA),
    onBackground = Color(0xFF1C1B1F),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF1C1B1F),
    surfaceVariant = Color(0xFFF0F0F0),
    onSurfaceVariant = Color(0xFF49454F),
)

private val MeasureDarkColors = darkColorScheme(
    primary = Color(0xFF66BB6A),
    onPrimary = Color(0xFF003909),
    primaryContainer = Color(0xFF1B5E20),
    onPrimaryContainer = Color(0xFFB8F5B0),
    background = Color(0xFF121212),
    onBackground = Color(0xFFE6E1E5),
    surface = Color(0xFF1E1E1E),
    onSurface = Color(0xFFE6E1E5),
    surfaceVariant = Color(0xFF2C2C2C),
    onSurfaceVariant = Color(0xFFCAC4D0),
)

private sealed interface DemoItem {
    val title: String
    val description: String
}

private data class ActionDemo(
    override val title: String,
    override val description: String,
    val action: (Notify) -> Unit,
) : DemoItem

private typealias Notify = (String) -> Unit

private sealed interface CmpRoute {
    data object Demos : CmpRoute
    data object Http : CmpRoute
}

@Composable
fun CmpScreen(onClose: (() -> Unit)? = null) {
    val colorScheme = if (isSystemInDarkTheme()) MeasureDarkColors else MeasureLightColors
    var route by remember { mutableStateOf<CmpRoute>(CmpRoute.Demos) }

    MaterialTheme(colorScheme = colorScheme) {
        when (route) {
            CmpRoute.Demos -> DemoListScreen(
                onOpenHttp = { route = CmpRoute.Http },
                onClose = onClose,
            )
            CmpRoute.Http -> HttpClientScreen(onBack = { route = CmpRoute.Demos })
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DemoListScreen(onOpenHttp: () -> Unit, onClose: (() -> Unit)?) {
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val notify: Notify = { msg -> showSnackbar(scope, snackbarHostState, msg) }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            if (onClose != null) {
                TopAppBar(
                    title = { Text("Compose Multiplatform") },
                    navigationIcon = {
                        TextButton(onClick = onClose) { Text("Back") }
                    },
                )
            }
        },
    ) { padding ->
        Surface(
            modifier = Modifier.fillMaxSize().padding(padding),
            color = MaterialTheme.colorScheme.background,
        ) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(demos(onOpenHttp), key = { it.title }) { demo ->
                    when (demo) {
                        is ActionDemo -> ActionCard(demo, notify)
                    }
                }
            }
        }
    }
}

private fun showSnackbar(scope: CoroutineScope, host: SnackbarHostState, message: String) {
    scope.launch {
        host.currentSnackbarData?.dismiss()
        host.showSnackbar(message)
    }
}

@Composable
private fun ActionCard(demo: ActionDemo, notify: Notify) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { demo.action(notify) },
        shape = MaterialTheme.shapes.medium,
        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.6f),
        contentColor = MaterialTheme.colorScheme.onSurface,
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = demo.title,
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                text = demo.description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

private fun demos(onOpenHttp: () -> Unit): List<DemoItem> = listOf(
    ActionDemo(
        title = "Set User ID",
        description = "Sets a dummy user ID on the SDK",
    ) { _ ->
        Measure.setUserId("kmp-user-42")
    },
    ActionDemo(
        title = "Clear User ID",
        description = "Clears the current user ID",
    ) { _ ->
        Measure.clearUserId()
    },
    ActionDemo(
        title = "Show Session ID",
        description = "Reads the current session ID",
    ) { notify ->
        notify("Session: ${Measure.getSessionId() ?: "none"}")
    },
    ActionDemo(
        title = "Track Event",
        description = "Records a custom event with attributes",
    ) { _ ->
        Measure.trackEvent(
            name = "kmp_event",
            attributes = mapOf("from" to StringAttr("kmp")),
        )
    },
    ActionDemo(
        title = "Track Screen View",
        description = "Records a screen view for KmpDemoScreen",
    ) { _ ->
        Measure.trackScreenView(
            screenName = "KmpDemoScreen",
            attributes = mapOf("source" to StringAttr("kmp")),
        )
    },
    ActionDemo(
        title = "Handled Exception",
        description = "Reports a handled RuntimeException",
    ) { _ ->
        Measure.trackHandledException(RuntimeException("handled-from-kmp"))
    },
    ActionDemo(
        title = "Create Span",
        description = "Generates a span hierarchy with attributes",
    ) { _ ->
        val root = Measure.startSpan("root")
        root.setAttribute("user_segment_premium", true)
        val start = Measure.getCurrentTime()
        val interests = Measure.startSpan("screen.interests").setParent(root)
        val forYou = Measure.startSpan("screen.for_you").setParent(root)
        interests.end()
        forYou.end()
        Measure.startSpan("http", timestamp = start).setParent(root).end()
        Measure.createSpanBuilder("screen.main")?.setParent(root)?.startSpan(start)?.end()
        root.end()
    },
    ActionDemo(
        title = "Traceparent Header",
        description = "Builds a traceparent header from a new span",
    ) { notify ->
        val span = Measure.startSpan("kmp_traceparent_span")
        val value = "${Measure.getTraceParentHeaderKey()}: ${Measure.getTraceParentHeaderValue(span)}"
        span.end()
        notify(value)
    },
    ActionDemo(
        title = "Track Bug Report",
        description = "Submits a bug report with attributes",
    ) { _ ->
        Measure.trackBugReport(
            description = "kmp-bug-report",
            attributes = mapOf("flow" to StringAttr("demo")),
        )
    },
    ActionDemo(
        title = "Launch Bug Report",
        description = "Opens the SDK's built-in bug report screen",
    ) { _ -> Measure.launchBugReport() },
    ActionDemo(
        title = "HTTP Client",
        description = "Open a screen to send HTTP requests against a sample endpoint",
    ) { _ -> onOpenHttp() },
    ActionDemo(
        title = "Track HTTP Event (success)",
        description = "Records a synthetic successful HTTP event",
    ) { _ ->
        val now = Measure.getCurrentTime()
        Measure.trackHttpEvent(
            url = "https://api.example.com/users/42",
            method = "GET",
            startTime = now,
            endTime = now + 123,
            statusCode = 200,
            requestHeaders = mapOf("Content-Type" to "application/json"),
            responseHeaders = mapOf("Content-Type" to "application/json"),
            responseBody = """{"id":42,"name":"kmp"}""",
            client = "ktor",
        )
    },
    ActionDemo(
        title = "Track HTTP Event (error)",
        description = "Records a synthetic failed HTTP event with an error",
    ) { _ ->
        val now = Measure.getCurrentTime()
        Measure.trackHttpEvent(
            url = "https://api.example.com/timeout",
            method = "POST",
            startTime = now,
            endTime = now + 5000,
            error = RuntimeException("connection-timeout"),
            client = "ktor",
        )
    },
    ActionDemo(
        title = "Unhandled Exception",
        description = "Throws from shared Kotlin code",
    ) { _ ->
        throw IllegalStateException("Crash from shared Kotlin code")
    },
)
