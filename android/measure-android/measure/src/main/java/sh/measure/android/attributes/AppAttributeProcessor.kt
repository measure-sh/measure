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

    override fun computeAttributes(): Map<String, Any?> = mapOf(
        Attribute.APP_VERSION_KEY to packageInfoProvider.appVersion,
        Attribute.APP_BUILD_KEY to packageInfoProvider.getVersionCode(),
        Attribute.APP_UNIQUE_ID_KEY to context.packageName,
        Attribute.MEASURE_SDK_VERSION to BuildConfig.MEASURE_SDK_VERSION,
    )
}
