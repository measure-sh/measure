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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import sh.measure.android.Measure
import sh.measure.android.attributes.AttributesBuilder
import sh.measure.android.bugreport.MsrShakeListener
import java.io.IOException

private class CustomException(override val message: String? = null) : Exception()

private enum class DemoCategory(val label: String) {
    CRASHES("Crashes"),
    ANRS("ANRs"),
    BUG_REPORTS("Bug Reports"),
    NAVIGATION("Navigation"),
    SCREENSHOTS("Screenshots"),
    MISC("Misc"),
}

private data class DemoItem(
    val title: String,
    val description: String,
    val category: DemoCategory,
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
            description = "Captures layout snapshot and submits report",
            category = DemoCategory.BUG_REPORTS,
            action = {
                Measure.captureLayoutSnapshot(context as Activity, onComplete = { snapshot ->
                    Measure.trackBugReport(
                        "Custom bug report",
                        attachments = listOf(snapshot),
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
            title = "Out of Memory",
            description = "Allocates memory until OOM",
            category = DemoCategory.CRASHES,

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
            category = DemoCategory.CRASHES,

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
            title = "OkHttp Client",
            description = "Send HTTP requests with tracing",
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
            title = "Set User ID",
            description = "Sets a dummy user ID on the SDK",
            category = DemoCategory.MISC,
            action = {
                Measure.setUserId("dummy-user-id")
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
            if (category == DemoCategory.BUG_REPORTS) {
                item(key = "shake_toggle") {
                    ShakeToggleCard(
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
private fun ShakeToggleCard(enabled: Boolean, onToggle: (Boolean) -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
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
                    text = "Shake to Report",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = "Shake device to open bug report",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Switch(
                checked = enabled,
                onCheckedChange = onToggle,
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
            .clickable { demo.action() },
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
