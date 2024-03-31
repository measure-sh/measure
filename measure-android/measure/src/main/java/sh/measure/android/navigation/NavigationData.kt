package sh.measure.android.navigation

import kotlinx.serialization.Serializable

@Serializable
internal data class NavigationData(
    /**
     * The route that was navigated to.
     */
    val route: String,
)
