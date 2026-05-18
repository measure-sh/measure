package sh.frankenstein.android

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Settings
import android.widget.Toast
import com.frankenstein.shared.CmpScreen
import io.flutter.embedding.android.FlutterActivity
import sh.measure.android.Measure
import kotlin.math.PI
import kotlin.math.sin

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MeasureTheme {
                AppNavigation()
            }
        }
    }
}

enum class Screen(val title: String, val tech: String) {
    HOME("measure", ""),
    NATIVE_ANDROID("Native Android", "Kotlin + Jetpack Compose"),
    CMP("Compose Multiplatform", "KMP + CMP"),
    FLUTTER("Flutter", "Dart + Flutter Engine"),
    REACT_NATIVE("React Native", "JavaScript + RN Bridge"),
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppNavigation() {
    var currentScreen by remember { mutableStateOf(Screen.HOME) }
    var isMeasureRunning by remember { mutableStateOf(true) }
    val context = LocalContext.current

    BackHandler(enabled = currentScreen != Screen.HOME) {
        currentScreen = Screen.HOME
    }

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            if (currentScreen != Screen.HOME && currentScreen != Screen.CMP) {
                TopAppBar(
                    title = { Text(currentScreen.title) },
                    navigationIcon = {
                        IconButton(onClick = { currentScreen = Screen.HOME }) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                        }
                    }
                )
            }
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            when (currentScreen) {
                Screen.HOME -> HomeScreen(
                    isMeasureRunning = isMeasureRunning,
                    onMeasureToggle = { running ->
                        isMeasureRunning = running
                        if (running) Measure.start() else Measure.stop()
                    },
                    onNavigate = { screen ->
                        when (screen) {
                            Screen.FLUTTER -> launchFlutter(context)
                            Screen.REACT_NATIVE -> launchReactNative(context)
                            else -> currentScreen = screen
                        }
                    },
                )
                Screen.NATIVE_ANDROID -> NativeAndroidScreen()
                Screen.CMP -> CmpScreen(onClose = { currentScreen = Screen.HOME })
                Screen.FLUTTER -> {}
                Screen.REACT_NATIVE -> {}
            }
        }
    }
}

private fun launchFlutter(context: Context) {
    context.startActivity(
        Intent(context, FlutterScreenActivity::class.java)
    )
}

private fun launchReactNative(context: Context) {
    context.startActivity(
        Intent(context, ReactNativeScreenActivity::class.java)
    )
}

private data class OrbSpec(
    val centerXRatio: Float,
    val centerYRatio: Float,
    val baseRadiusDp: Float,
    val driftXDp: Float,
    val driftYDp: Float,
    val periodX: Float,
    val periodY: Float,
    val pulsePeriod: Float,
)

private val orbs = listOf(
    OrbSpec(0.20f, 0.15f, 140f, 60f, 40f, 15f, 19f, 10f),
    OrbSpec(0.80f, 0.25f, 100f, 50f, 55f, 18f, 13f, 12f),
    OrbSpec(0.35f, 0.55f, 160f, 45f, 50f, 20f, 17f, 8f),
    OrbSpec(0.70f, 0.80f, 120f, 55f, 35f, 14f, 22f, 14f),
)

@Composable
fun FloatingOrbsBackground() {
    val orbColor = MaterialTheme.colorScheme.primary
    val density = LocalDensity.current
    val transition = rememberInfiniteTransition(label = "orbs")
    val time by transition.animateFloat(
        initialValue = 0f,
        targetValue = (2.0 * PI * 60.0).toFloat(),
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 60_000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "orbTime",
    )

    Canvas(modifier = Modifier.fillMaxSize()) {
        val w = size.width
        val h = size.height
        for (orb in orbs) {
            val dpToPx = density.density
            val x = w * orb.centerXRatio +
                orb.driftXDp * dpToPx * sin(time / orb.periodX).toFloat()
            val y = h * orb.centerYRatio +
                orb.driftYDp * dpToPx * sin(time / orb.periodY + 0.5f).toFloat()
            val r = orb.baseRadiusDp * dpToPx *
                (1f + 0.15f * sin(time / orb.pulsePeriod).toFloat())
            val center = Offset(x, y)
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(orbColor.copy(alpha = 0.25f), Color.Transparent),
                    center = center,
                    radius = r,
                ),
                radius = r,
                center = center,
            )
        }
    }
}

@Composable
fun HomeScreen(
    isMeasureRunning: Boolean,
    onMeasureToggle: (Boolean) -> Unit,
    onNavigate: (Screen) -> Unit,
) {
    val screens = Screen.entries.filter { it != Screen.HOME }
    var showCredentialsDialog by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        FloatingOrbsBackground()
        Column(modifier = Modifier.fillMaxSize()) {
            Surface(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                shape = MaterialTheme.shapes.medium,
                color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.7f),
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column {
                        Text(
                            text = "Measure SDK",
                            style = MaterialTheme.typography.titleSmall,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                        )
                        Text(
                            text = if (isMeasureRunning) "Running" else "Stopped",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f),
                        )
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = { showCredentialsDialog = true }) {
                            Icon(
                                imageVector = Icons.Filled.Settings,
                                contentDescription = "Configure credentials",
                                tint = MaterialTheme.colorScheme.onPrimaryContainer,
                            )
                        }
                        Switch(
                            checked = isMeasureRunning,
                            onCheckedChange = onMeasureToggle,
                            colors = SwitchDefaults.colors(
                                checkedTrackColor = MaterialTheme.colorScheme.primary,
                            ),
                        )
                    }
                }
            }
            if (showCredentialsDialog) {
                ConfigureCredentialsDialog(onDismiss = { showCredentialsDialog = false })
            }
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(screens) { screen ->
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onNavigate(screen) },
                        shape = MaterialTheme.shapes.medium,
                        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.6f),
                        contentColor = MaterialTheme.colorScheme.onSurface,
                    ) {
                        Column(modifier = Modifier.padding(20.dp)) {
                            Text(
                                text = screen.title,
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                            Text(
                                text = screen.tech,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
        }
        Text(
            text = BuildConfig.APPLICATION_ID,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.align(Alignment.BottomStart).padding(16.dp),
        )
        Text(
            text = "v${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp),
        )
    }
}

@Composable
fun ConfigureCredentialsDialog(onDismiss: () -> Unit) {
    val context = LocalContext.current
    val (initialUrl, initialKey) = remember {
        val savedUrl = CredentialOverrides.getSavedApiUrl(context)
        val savedKey = CredentialOverrides.getSavedApiKey(context)
        if (savedUrl != null && savedKey != null) {
            savedUrl to savedKey
        } else {
            val (manifestUrl, manifestKey) = CredentialOverrides.readManifestCredentials(context)
            (manifestUrl ?: "") to (manifestKey ?: "")
        }
    }

    var apiUrl by remember { mutableStateOf(initialUrl) }
    var apiKey by remember { mutableStateOf(initialKey) }
    var urlError by remember { mutableStateOf<String?>(null) }
    var keyError by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Configure credentials") },
        text = {
            Column {
                OutlinedTextField(
                    value = apiUrl,
                    onValueChange = {
                        apiUrl = it
                        urlError = null
                    },
                    label = { Text("API URL") },
                    isError = urlError != null,
                    supportingText = { urlError?.let { Text(it) } },
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = apiKey,
                    onValueChange = {
                        apiKey = it
                        keyError = null
                    },
                    label = { Text("API key") },
                    isError = keyError != null,
                    supportingText = { keyError?.let { Text(it) } },
                    modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                )
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val trimmedUrl = apiUrl.trim()
                val trimmedKey = apiKey.trim()
                if (trimmedUrl.isEmpty()) {
                    urlError = "API URL cannot be empty"
                    return@TextButton
                }
                if (!trimmedKey.startsWith("msrsh")) {
                    keyError = "API Key must start with \"msrsh\""
                    return@TextButton
                }
                CredentialOverrides.save(context, trimmedUrl, trimmedKey)
                val applied = MeasureConfigurator.swapCredentials(trimmedUrl, trimmedKey)
                val message = if (applied) {
                    "Credentials saved and applied"
                } else {
                    "Saved, but failed to apply (SDK not initialized?)"
                }
                Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
                onDismiss()
            }) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}
