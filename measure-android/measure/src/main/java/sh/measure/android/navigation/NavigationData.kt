package sh.measure.android.navigation

import kotlinx.serialization.Serializable

@Serializable
internal data class NavigationData(
    /**
     *
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
