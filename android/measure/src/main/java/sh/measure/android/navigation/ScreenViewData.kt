package sh.measure.android.navigation

import kotlinx.serialization.Serializable

/**
 * Trigger when a screen is viewed by the user.
 */
@Serializable
internal data class ScreenViewData(
    val name: String,
)
