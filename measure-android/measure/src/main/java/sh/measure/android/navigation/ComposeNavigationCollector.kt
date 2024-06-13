package sh.measure.android.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.LifecycleOwner
import androidx.navigation.NavController
import androidx.navigation.NavHostController
import sh.measure.android.Measure
import sh.measure.android.events.EventType

@Composable
fun NavHostController.withMeasureNavigationListener(): NavHostController {
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    DisposableEffect(lifecycle, this) {
        val observer = MeasureNavigationObserver(
            this@withMeasureNavigationListener,
        )
        lifecycle.addObserver(observer)

        onDispose {
            observer.dispose()
            lifecycle.removeObserver(observer)
        }
    }
    return this
}

private class MeasureNavigationObserver(
    private val navController: NavController,
) : LifecycleEventObserver {
    var lastDestinationRoute: String? = null

    private companion object {
        private const val SOURCE_ANDROIDX_NAVIGATION = "androidx-navigation"
    }

    override fun onStateChanged(source: LifecycleOwner, event: Lifecycle.Event) {
        if (event == Lifecycle.Event.ON_RESUME) {
            navController.addOnDestinationChangedListener(destinationChangedListener)
        } else if (event == Lifecycle.Event.ON_PAUSE) {
            navController.removeOnDestinationChangedListener(destinationChangedListener)
        }
    }

    fun dispose() {
        navController.removeOnDestinationChangedListener(destinationChangedListener)
    }

    private val destinationChangedListener =
        NavController.OnDestinationChangedListener { controller, _, _ ->
            controller.currentDestination?.route?.let { to ->
                val timeProvider = Measure.getTimeProvider() ?: return@let
                val eventProcessor = Measure.getEventProcessor() ?: return@let
                eventProcessor.track(
                    type = EventType.NAVIGATION,
                    timestamp = timeProvider.currentTimeSinceEpochInMillis,
                    data = NavigationData(
                        source = SOURCE_ANDROIDX_NAVIGATION,
                        from = lastDestinationRoute,
                        to = to,
                    ),
                )
                lastDestinationRoute = to
            }
        }
}
