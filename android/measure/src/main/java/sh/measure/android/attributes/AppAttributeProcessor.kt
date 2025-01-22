package sh.measure.android.attributes

import android.content.Context
import sh.measure.android.BuildConfig
import sh.measure.android.utils.PackageInfoProvider

/**
 * Generates the attributes for the app. The attributes include the app version, build version, and
 * the unique ID of the app.
 */
internal class AppAttributeProcessor(
    private val packageInfoProvider: PackageInfoProvider,
    private val context: Context,
) : ComputeOnceAttributeProcessor() {
    private val appVersionKey = "app_version"
    private val appBuildKey = "app_build"
    private val appUniqueIdKey = "app_unique_id"
    private val measureSdkVersion = "measure_sdk_version"

    override fun computeAttributes(): Map<String, Any?> {
        return mapOf(
            appVersionKey to packageInfoProvider.appVersion,
            appBuildKey to packageInfoProvider.getVersionCode(),
            appUniqueIdKey to context.packageName,
            measureSdkVersion to BuildConfig.MEASURE_SDK_VERSION,
        )
    }
}
