package sh.frankenstein.android

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.widget.Toast
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import sh.measure.android.Measure
import sh.measure.android.attributes.AttributesBuilder
import sh.measure.android.bugreport.MsrShakeListener
import java.io.IOException

private class CustomException(override val message: String? = null) : Exception()

private object HeldMemory {
    val allocations = mutableListOf<ByteArray>()
}

private enum class DemoCategory(val label: String) {
    CRASHES("Crashes"),
    ANRS("ANRs"),
    BUG_REPORTS("Bug Reports"),
    NAVIGATION("Navigation"),
    SCREENSHOTS("Screenshots"),
    LOGS("Logs"),
    MEMORY("Memory"),
    MISC("Misc"),
}

private data class DemoItem(
    val title: String,
    val description: String,
    val category: DemoCategory,
    val enabled: Boolean = true,
    val action: () -> Unit,
)

private fun launchActivity(context: Context, activityClass: Class<*>) {
    context.startActivity(Intent(context, activityClass))
}

@Composable
fun NativeAndroidScreen() {
    val context = LocalContext.current
    val mutex = Any()

    var shakeEnabled by remember { mutableStateOf(false) }
    var heavyMediaEnabled by remember { mutableStateOf(AssetPrefetcher.enabled) }
    var foregroundServiceMemoryEnabled by remember { mutableStateOf(false) }
    var backgroundServiceMemoryEnabled by remember { mutableStateOf(false) }
    var nativeMemoryBusy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    DisposableEffect(Unit) {
        onDispose {
            Measure.setShakeListener(null)
        }
    }

    val demos = listOf(
        DemoItem(
            title = "Compose Navigation",
            description = "NavHost with multiple routes",
            category = DemoCategory.NAVIGATION,
            action = { launchActivity(context, ComposeNavigationActivity::class.java) },
        ),
        DemoItem(
            title = "Fragment Navigation",
            description = "FragmentManager with ViewPager2",
            category = DemoCategory.NAVIGATION,
            action = { launchActivity(context, FragmentNavigationActivity::class.java) },
        ),
        DemoItem(
            title = "Nested Fragments",
            description = "Parent and child fragments",
            category = DemoCategory.NAVIGATION,
            action = { launchActivity(context, NestedFragmentActivity::class.java) },
        ),
        DemoItem(
            title = "Launch Bug Report",
            description = "Opens bug report UI with custom attributes",
            category = DemoCategory.BUG_REPORTS,
            action = {
                val attributes = AttributesBuilder().put("is_premium", true).build()
                Measure.launchBugReportActivity(attributes = attributes)
            },
        ),
        DemoItem(
            title = "Submit Bug Report",
            description = "Captures screenshot and submits report",
            category = DemoCategory.BUG_REPORTS,
            action = {
                Measure.captureScreenshot(context as Activity, onComplete = { screenshot ->
                    Measure.trackBugReport(
                        "Custom bug report",
                        attachments = listOf(screenshot),
                        attributes = AttributesBuilder().put("is_premium", true).build(),
                    )
                    Toast.makeText(context, "Bug report submitted", Toast.LENGTH_SHORT).show()
                })
            },
        ),
        DemoItem(
            title = "Compose Screenshot",
            description = "Compose UI with form fields and actions",
            category = DemoCategory.SCREENSHOTS,
            action = { launchActivity(context, ComposeScreenshotActivity::class.java) },
        ),
        DemoItem(
            title = "View Screenshot",
            description = "XML views with form fields and actions",
            category = DemoCategory.SCREENSHOTS,
            action = { launchActivity(context, ViewScreenshotActivity::class.java) },
        ),
        DemoItem(
            title = "Single Exception",
            description = "Throws an IllegalAccessException",
            category = DemoCategory.CRASHES,

            action = { throw IllegalAccessException("This is a new exception") },
        ),
        DemoItem(
            title = "Chained Exception",
            description = "IOException wrapping a custom cause",
            category = DemoCategory.CRASHES,

            action = {
                throw IOException("This is a test exception").initCause(
                    CustomException(message = "This is a nested custom exception")
                )
            },
        ),
        DemoItem(
            title = "Java Out of Memory",
            description = "Allocates Java arrays until OOM",
            category = DemoCategory.MEMORY,

            action = {
                val list = mutableListOf<ByteArray>()
                while (true) {
                    list.add(ByteArray(1024 * 1024 * 100))
                }
            },
        ),
        DemoItem(
            title = "Stack Overflow",
            description = "Infinite recursion",
            category = DemoCategory.MEMORY,

            action = {
                fun recurse(): Unit = recurse()
                recurse()
            },
        ),
        DemoItem(
            title = "Infinite Loop",
            description = "Blocks the main thread forever",
            category = DemoCategory.ANRS,

            action = {
                @Suppress("ControlFlowWithEmptyBody")
                while (true) {
                }
            },
        ),
        DemoItem(
            title = "Deadlock",
            description = "Acquires a lock that never releases",
            category = DemoCategory.ANRS,

            action = {
                val thread = Thread {
                    synchronized(mutex) {
                        try {
                            Thread.sleep(Long.MAX_VALUE)
                        } catch (_: InterruptedException) {
                        }
                    }
                }
                thread.name = "APP: Locker"
                thread.start()
                Handler(Looper.getMainLooper()).postDelayed({
                    synchronized(mutex) {
                        Log.e("Measure", "There should be a dead lock before this message")
                    }
                }, 1000)
            },
        ),
        DemoItem(
            title = "Thread Sleep",
            description = "Sleeps the main thread for 10 seconds",
            category = DemoCategory.ANRS,

            action = { Thread.sleep(10_000) },
        ),
        DemoItem(
            title = "HTTP Client",
            description = "Send requests via OkHttp or HttpURLConnection",
            category = DemoCategory.MISC,
            action = { launchActivity(context, OkHttpActivity::class.java) },
        ),
        DemoItem(
            title = "Create Span",
            description = "Generates a span hierarchy with attributes",
            category = DemoCategory.MISC,
            action = {
                val rootSpan = Measure.startSpan("root")
                rootSpan.setAttribute("user_segment_premium", true)
                val startTime = System.currentTimeMillis()
                val interestsSpan = Measure.startSpan("screen.interests").setParent(rootSpan)
                val forYou = Measure.startSpan("screen.for_you").setParent(rootSpan)
                interestsSpan.end()
                forYou.end()
                Measure.startSpan("http", timestamp = startTime).setParent(rootSpan).end()
                Measure.startSpan("screen.main", timestamp = startTime).setParent(rootSpan).end()
                rootSpan.end()
                Toast.makeText(context, "Span hierarchy created", Toast.LENGTH_SHORT).show()
            },
        ),
        DemoItem(
            title = "Track Custom Event",
            description = "Fires a custom event with all attribute types",
            category = DemoCategory.MISC,
            action = {
                val attributes = AttributesBuilder()
                    .put("string_attr", "hello")
                    .put("int_attr", 42)
                    .put("long_attr", 9_000_000_000L)
                    .put("double_attr", 3.141592653589793)
                    .put("float_attr", 2.718f)
                    .put("boolean_attr", true)
                    .build()
                Measure.trackEvent(name = "custom_event_all_attrs", attributes = attributes)
                Toast.makeText(context, "Custom event tracked", Toast.LENGTH_SHORT).show()
            },
        ),
        DemoItem(
            title = "Track Handled Exception",
            description = "Catches a chained exception and reports it with custom attributes",
            category = DemoCategory.MISC,
            action = {
                try {
                    throw IOException("This is a handled exception").initCause(
                        CustomException(message = "Caused by a custom nested exception")
                    )
                } catch (e: Exception) {
                    val attributes = AttributesBuilder()
                        .put("string_attr", "hello")
                        .put("int_attr", 42)
                        .put("long_attr", 9_000_000_000L)
                        .put("double_attr", 3.141592653589793)
                        .put("float_attr", 2.718f)
                        .put("boolean_attr", true)
                        .build()
                    Measure.trackHandledException(e, attributes)
                    Toast.makeText(context, "Handled exception tracked", Toast.LENGTH_SHORT).show()
                }
            },
        ),
        DemoItem(
            title = "Track Logs",
            description = "Enter a body, pick a severity, and send",
            category = DemoCategory.LOGS,
            action = { launchActivity(context, LogActivity::class.java) },
        ),
        DemoItem(
            title = "Set User ID",
            description = "Sets a dummy user ID on the SDK",
            category = DemoCategory.MISC,
            action = {
                Measure.setUserId("session_timeline_test_user")
                Toast.makeText(context, "User ID set", Toast.LENGTH_SHORT).show()
            },
        ),
        DemoItem(
            title = "Clear User ID",
            description = "Clears the current user ID",
            category = DemoCategory.MISC,
            action = {
                Measure.clearUserId()
                Toast.makeText(context, "User ID cleared", Toast.LENGTH_SHORT).show()
            },
        ),
        DemoItem(
            title = "Hold 100 MB Native",
            description = if (nativeMemoryBusy) "Working…" else "Adds 100 MB to native memory per tap",
            category = DemoCategory.MEMORY,
            enabled = !nativeMemoryBusy,
            action = {
                nativeMemoryBusy = true
                scope.launch {
                    try {
                        val total = withContext(Dispatchers.Default) {
                            NativeMemory.allocate100Mb()
                        }
                        val message = if (total >= 0) {
                            "$total MB native memory held"
                        } else {
                            "Could not allocate another 100 MB"
                        }
                        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
                    } finally {
                        nativeMemoryBusy = false
                    }
                }
            },
        ),
        DemoItem(
            title = "Release Native Memory",
            description = "Frees the held native allocations",
            category = DemoCategory.MEMORY,
            enabled = !nativeMemoryBusy,
            action = {
                nativeMemoryBusy = true
                scope.launch {
                    try {
                        withContext(Dispatchers.Default) { NativeMemory.release() }
                        Toast.makeText(context, "Native memory released", Toast.LENGTH_SHORT).show()
                    } finally {
                        nativeMemoryBusy = false
                    }
                }
            },
        ),
        DemoItem(
            title = "Hold 50 MB Java",
            description = "Adds 50 MB to the Java heap per tap",
            category = DemoCategory.MEMORY,
            action = {
                try {
                    val allocation = ByteArray(50 * 1024 * 1024)
                    // Touch each page so the allocation contributes to resident memory.
                    for (index in allocation.indices step 4096) {
                        allocation[index] = 1
                    }
                    HeldMemory.allocations += allocation
                    val totalMegabytes = HeldMemory.allocations.size * 50
                    Toast.makeText(context, "$totalMegabytes MB allocated", Toast.LENGTH_SHORT).show()
                } catch (_: OutOfMemoryError) {
                    Toast.makeText(context, "Could not allocate another 50 MB", Toast.LENGTH_SHORT).show()
                }
            },
        ),
        DemoItem(
            title = "Release Held Java Memory",
            description = "Releases the held Java arrays",
            category = DemoCategory.MEMORY,
            action = {
                HeldMemory.allocations.clear()
                Toast.makeText(context, "Held Java arrays released", Toast.LENGTH_SHORT).show()
            },
        ),
    )

    val grouped = demos.groupBy { it.category }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        DemoCategory.entries.forEach { category ->
            val categoryItems = grouped[category] ?: return@forEach
            item(key = "header_${category.name}") {
                Text(
                    text = category.label,
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
                )
            }
            items(categoryItems, key = { it.title }) { demo ->
                DemoCard(demo)
            }
            if (category == DemoCategory.MEMORY) {
                item(key = "slow_memory_leak_toggle") {
                    ToggleCard(
                        title = "Slow Memory Leak",
                        description = "Gradually fills the Java heap as you navigate",
                        enabled = heavyMediaEnabled,
                        onToggle = { enabled ->
                            heavyMediaEnabled = enabled
                            AssetPrefetcher.enabled = enabled
                            ScreenMedia.enabled = enabled
                            if (!enabled) {
                                AssetPrefetcher.clear()
                            }
                        },
                    )
                }
                item(key = "foreground_service_memory_toggle") {
                    ToggleCard(
                        title = "Foreground Service Memory",
                        description = "Allocates up to 150 MB in a foreground service",
                        enabled = foregroundServiceMemoryEnabled,
                        onToggle = { enabled ->
                            foregroundServiceMemoryEnabled = enabled
                            val intent = Intent(context, ForegroundMemoryService::class.java)
                            if (enabled) {
                                ContextCompat.startForegroundService(context, intent)
                            } else {
                                context.stopService(intent)
                            }
                        },
                    )
                }
                item(key = "background_service_memory_toggle") {
                    ToggleCard(
                        title = "Background Service Memory",
                        description = "Allocates up to 150 MB in a background service",
                        enabled = backgroundServiceMemoryEnabled,
                        onToggle = { enabled ->
                            backgroundServiceMemoryEnabled = enabled
                            val intent = Intent(context, BackgroundMemoryService::class.java)
                            if (enabled) {
                                context.startService(intent)
                            } else {
                                context.stopService(intent)
                            }
                        },
                    )
                }
            }
            if (category == DemoCategory.BUG_REPORTS) {
                item(key = "shake_toggle") {
                    ToggleCard(
                        title = "Shake to Report",
                        description = "Shake device to open bug report",
                        enabled = shakeEnabled,
                        onToggle = { enabled ->
                            shakeEnabled = enabled
                            if (enabled) {
                                Measure.setShakeListener(object : MsrShakeListener {
                                    override fun onShake() {
                                        Measure.launchBugReportActivity(
                                            true,
                                            AttributesBuilder().put("platform", "native").build(),
                                        )
                                    }
                                })
                            } else {
                                Measure.setShakeListener(null)
                            }
                        },
                    )
                }
            }
        }
        item { Spacer(modifier = Modifier.height(8.dp)) }
    }
}

@Composable
private fun ToggleCard(
    title: String,
    description: String,
    enabled: Boolean,
    onToggle: (Boolean) -> Unit,
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .toggleable(value = enabled, role = Role.Switch, onValueChange = onToggle),
        shape = MaterialTheme.shapes.medium,
        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.6f),
        contentColor = MaterialTheme.colorScheme.onSurface,
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Switch(
                checked = enabled,
                onCheckedChange = null,
                colors = SwitchDefaults.colors(
                    checkedTrackColor = MaterialTheme.colorScheme.primary,
                ),
            )
        }
    }
}

@Composable
private fun DemoCard(demo: DemoItem) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = demo.enabled) { demo.action() },
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
