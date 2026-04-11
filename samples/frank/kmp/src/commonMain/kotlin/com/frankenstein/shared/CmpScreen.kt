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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

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

private data class DemoItem(
    val title: String,
    val description: String,
    val action: () -> Unit,
)

private val demos = listOf(
    DemoItem(
        title = "Unhandled Exception",
        description = "Throws from shared Kotlin code",
        action = { throw IllegalStateException("Crash from shared Kotlin code") },
    ),
)

@Composable
fun CmpScreen() {
    val colorScheme = if (isSystemInDarkTheme()) MeasureDarkColors else MeasureLightColors

    MaterialTheme(colorScheme = colorScheme) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = MaterialTheme.colorScheme.background
        ) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(demos, key = { it.title }) { demo ->
                    DemoCard(demo)
                }
            }
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
