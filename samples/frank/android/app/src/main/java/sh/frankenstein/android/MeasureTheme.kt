package sh.frankenstein.android

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val MeasurePrimary = Color(0xFF2E7D32)
private val MeasureOnPrimary = Color(0xFFFFFFFF)
private val MeasurePrimaryContainer = Color(0xFFB8F5B0)
private val MeasureOnPrimaryContainer = Color(0xFF002204)

private val MeasurePrimaryDark = Color(0xFF66BB6A)
private val MeasureOnPrimaryDark = Color(0xFF003909)
private val MeasurePrimaryContainerDark = Color(0xFF1B5E20)
private val MeasureOnPrimaryContainerDark = Color(0xFFB8F5B0)

private val LightColorScheme = lightColorScheme(
    primary = MeasurePrimary,
    onPrimary = MeasureOnPrimary,
    primaryContainer = MeasurePrimaryContainer,
    onPrimaryContainer = MeasureOnPrimaryContainer,
    background = Color(0xFFFAFAFA),
    onBackground = Color(0xFF1C1B1F),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF1C1B1F),
    surfaceVariant = Color(0xFFF0F0F0),
    onSurfaceVariant = Color(0xFF49454F),
)

private val DarkColorScheme = darkColorScheme(
    primary = MeasurePrimaryDark,
    onPrimary = MeasureOnPrimaryDark,
    primaryContainer = MeasurePrimaryContainerDark,
    onPrimaryContainer = MeasureOnPrimaryContainerDark,
    background = Color(0xFF121212),
    onBackground = Color(0xFFE6E1E5),
    surface = Color(0xFF1E1E1E),
    onSurface = Color(0xFFE6E1E5),
    surfaceVariant = Color(0xFF2C2C2C),
    onSurfaceVariant = Color(0xFFCAC4D0),
)

@Composable
fun MeasureTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.surface.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        content = content,
    )
}
