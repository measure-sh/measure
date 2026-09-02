package sh.frankenstein.android

import android.app.Activity
import android.app.Application
import android.os.Bundle

private const val ASSET_BYTES = 512 * 1024
private const val ASSETS_PER_SCREEN = 32

object AssetPrefetcher : Application.ActivityLifecycleCallbacks {
    private val assets = mutableMapOf<String, ByteArray>()
    private var requestId = 0

    var enabled: Boolean = false

    fun prefetch(screenName: String) {
        if (!enabled) return
        requestId++
        repeat(ASSETS_PER_SCREEN) { index ->
            assets["$screenName/$requestId/$index"] = ByteArray(ASSET_BYTES)
        }
    }

    fun clear() {
        assets.clear()
        requestId = 0
    }

    override fun onActivityResumed(activity: Activity) {
        prefetch(activity::class.java.simpleName)
    }

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit
    override fun onActivityStarted(activity: Activity) = Unit
    override fun onActivityPaused(activity: Activity) = Unit
    override fun onActivityStopped(activity: Activity) = Unit
    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit
    override fun onActivityDestroyed(activity: Activity) = Unit
}
