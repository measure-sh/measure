package sh.measure.android.lifecycle

import android.content.Context
import android.content.res.Resources
import android.os.Bundle
import android.view.View
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentManager
import androidx.navigation.NavController
import androidx.navigation.NavDestination
import androidx.navigation.fragment.NavHostFragment
import androidx.navigation.fragment.findNavController
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.navigation.ScreenViewData
import sh.measure.android.utils.TimeProvider
import sh.measure.android.utils.isClassAvailable

internal class AndroidXFragmentNavigationCollector(
    private val signalProcessor: SignalProcessor,
    private val timeProvider: TimeProvider,
) : FragmentLifecycleAdapter(),
    NavController.OnDestinationChangedListener {

    override fun onFragmentViewCreated(
        fm: FragmentManager,
        f: Fragment,
        v: View,
        savedInstanceState: Bundle?,
    ) {
        safelyTrackAndroidxNavChanges(f)
    }

    override fun onFragmentViewDestroyed(fm: FragmentManager, f: Fragment) {
        safelyRemoveAndroidxNavChanges(f)
    }

    override fun onDestinationChanged(
        controller: NavController,
        destination: NavDestination,
        arguments: Bundle?,
    ) {
        val displayName = getDisplayName(controller.context, destination.id)
        signalProcessor.track(
            type = EventType.SCREEN_VIEW,
            timestamp = timeProvider.now(),
            data = ScreenViewData(name = displayName),
        )
    }

    private fun safelyTrackAndroidxNavChanges(f: Fragment) {
        try {
            if (hasAndroidxFragmentNavigation() && f is NavHostFragment) {
                f.findNavController().addOnDestinationChangedListener(this)
            }
        } catch (e: IllegalStateException) {
            // ignore
        }
    }

    private fun safelyRemoveAndroidxNavChanges(f: Fragment) {
        try {
            if (hasAndroidxFragmentNavigation() && f is NavHostFragment) {
                f.findNavController().removeOnDestinationChangedListener(this)
            }
        } catch (e: IllegalStateException) {
            // ignore
        }
    }

    private fun getDisplayName(context: Context, id: Int): String = if (id <= 0x00FFFFFF) {
        id.toString()
    } else {
        try {
            context.resources.getResourceName(id)
        } catch (e: Resources.NotFoundException) {
            id.toString()
        }
    }

    private fun hasAndroidxFragmentNavigation() = isClassAvailable("androidx.navigation.fragment.NavHostFragment")
}
