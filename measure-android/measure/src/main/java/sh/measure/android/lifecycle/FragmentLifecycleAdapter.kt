package sh.measure.android.lifecycle

import android.app.Application
import android.content.Context
import android.os.Bundle
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentManager
import androidx.fragment.app.FragmentManager.FragmentLifecycleCallbacks

/**
 * An empty implementation of [Application.ActivityLifecycleCallbacks] that can be used to
 * keep it's implementors clean.
 */
internal abstract class FragmentLifecycleAdapter : FragmentLifecycleCallbacks() {
    override fun onFragmentAttached(fm: FragmentManager, f: Fragment, context: Context) {}
    override fun onFragmentCreated(fm: FragmentManager, f: Fragment, savedInstanceState: Bundle?) {}
    override fun onFragmentResumed(fm: FragmentManager, f: Fragment) {}
    override fun onFragmentPaused(fm: FragmentManager, f: Fragment) {}
    override fun onFragmentSaveInstanceState(fm: FragmentManager, f: Fragment, outState: Bundle) {}
    override fun onFragmentDestroyed(fm: FragmentManager, f: Fragment) {}
    override fun onFragmentDetached(fm: FragmentManager, f: Fragment) {}
}
