package sh.measure.android.attributes

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import sh.measure.android.BuildConfig

/**
 * Generates the attributes for the app. The attributes include the app version, build version, and
 * the unique ID of the app.
 */
internal class AppAttributeAppender(private val context: Context) :
    ComputeOnceAttributeAppender() {
    private val appVersionKey = "app_version"
    private val appBuildKey = "app_build"
    private val appUniqueIdKey = "app_unique_id"
    private val measureSdkVersion = "measure_sdk_version"

    private val packageManager = context.packageManager
    private val packageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        packageManager.getPackageInfo(
            context.packageName,
            PackageManager.PackageInfoFlags.of(0),
        )
    } else {
        packageManager.getPackageInfo(context.packageName, 0)
    }

    override fun computeAttributes(): Map<String, Any?> {
        return mapOf(
            appVersionKey to packageInfo.versionName,
            appBuildKey to getBuildVersionCode(),
            appUniqueIdKey to context.packageName,
            measureSdkVersion to BuildConfig.MEASURE_SDK_VERSION,
        )
    }

    private fun getBuildVersionCode() = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        packageInfo.longVersionCode.toString()
    } else {
        packageInfo.versionCode.toString()
    }
}