package sh.measure.android.utils

import sh.measure.android.lifecycle.ActivityLifecycleCollector

class NoopActivityLifecycleController : ActivityLifecycleCollector {
    override fun register() {}
    override fun unregister() {}
}
