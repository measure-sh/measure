package sh.measure.android.navigation

import kotlinx.serialization.Serializable

@Serializable
@Deprecated("This class is deprecated and will be removed in the next version. Use ScreenViewData instead.")
internal data class NavigationData(
    /**
     * Adds context on how the event was collected.
     * Example: `androidx-navigation` if the event was collected from `androidx.navigation` library.
     */
    val source: String?,
    /**
     * The source page or screen from where the navigation was triggered, if available, null otherwise.
     */
    val from: String?,
    /**
     * The destination page or screen where the navigation led to.
     */
    val to: String,
)
