package com.frankenstein.shared

import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
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

private data class ToggleDemo(
    override val title: String,
    override val description: String,
    val onChange: (Boolean, Notify) -> Unit,
) : DemoItem

private typealias Notify = (String) -> Unit

@Composable
fun CmpScreen() {
    val colorScheme = if (isSystemInDarkTheme()) MeasureDarkColors else MeasureLightColors
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val notify: Notify = { msg -> showSnackbar(scope, snackbarHostState, msg) }

    MaterialTheme(colorScheme = colorScheme) {
        Scaffold(
            snackbarHost = { SnackbarHost(snackbarHostState) },
            containerColor = MaterialTheme.colorScheme.background,
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
                    items(demos(), key = { it.title }) { demo ->
                        when (demo) {
                            is ActionDemo -> ActionCard(demo, notify)
                            is ToggleDemo -> ToggleCard(demo, notify)
                        }
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

@Composable
private fun ToggleCard(demo: ToggleDemo, notify: Notify) {
    var checked by remember { mutableStateOf(false) }
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.6f),
        contentColor = MaterialTheme.colorScheme.onSurface,
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
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
            Switch(
                checked = checked,
                onCheckedChange = {
                    checked = it
                    demo.onChange(it, notify)
                },
            )
        }
    }
}

private fun demos(): List<DemoItem> = listOf(
    ToggleDemo(
        title = "Tracking",
        description = "Start and stop the SDK",
        onChange = { on, notify ->
            if (on) Measure.start() else Measure.stop()
            notify(if (on) "SDK started" else "SDK stopped")
        },
    ),
    ActionDemo(
        title = "Set User ID",
        description = "Sets a dummy user ID on the SDK",
    ) { notify ->
        Measure.setUserId("kmp-user-42")
        notify("User ID set")
    },
    ActionDemo(
        title = "Clear User ID",
        description = "Clears the current user ID",
    ) { notify ->
        Measure.clearUserId()
        notify("User ID cleared")
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
    ) { notify ->
        Measure.trackEvent(
            name = "kmp_event",
            attributes = mapOf("from" to StringAttr("kmp")),
        )
        notify("Event tracked")
    },
    ActionDemo(
        title = "Track Screen View",
        description = "Records a screen view for KmpDemoScreen",
    ) { notify ->
        Measure.trackScreenView(
            screenName = "KmpDemoScreen",
            attributes = mapOf("source" to StringAttr("kmp")),
        )
        notify("Screen view tracked")
    },
    ActionDemo(
        title = "Handled Exception",
        description = "Reports a handled RuntimeException",
    ) { notify ->
        Measure.trackHandledException(RuntimeException("handled-from-kmp"))
        notify("Exception tracked")
    },
    ActionDemo(
        title = "Create Span",
        description = "Generates a span hierarchy with attributes (iOS pending)",
    ) { notify ->
        try {
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
            notify("Span hierarchy created")
        } catch (t: Throwable) {
            notify("Spans unavailable: ${t.message ?: t::class.simpleName}")
        }
    },
    ActionDemo(
        title = "Traceparent Header",
        description = "Builds a traceparent header from a new span (iOS pending)",
    ) { notify ->
        try {
            val span = Measure.startSpan("kmp_traceparent_span")
            val value = "${Measure.getTraceParentHeaderKey()}: ${Measure.getTraceParentHeaderValue(span)}"
            span.end()
            notify(value)
        } catch (t: Throwable) {
            notify("Traceparent unavailable: ${t.message ?: t::class.simpleName}")
        }
    },
    ActionDemo(
        title = "Track Bug Report",
        description = "Submits a bug report with attributes",
    ) { notify ->
        Measure.trackBugReport(
            description = "kmp-bug-report",
            attributes = mapOf("flow" to StringAttr("demo")),
        )
        notify("Bug report submitted")
    },
    ActionDemo(
        title = "Unhandled Exception",
        description = "Throws from shared Kotlin code",
    ) { _ ->
        throw IllegalStateException("Crash from shared Kotlin code")
    },
)
