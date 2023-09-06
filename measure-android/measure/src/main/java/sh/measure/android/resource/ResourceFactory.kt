package sh.measure.android.resource

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import sh.measure.android.Config
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger

/**
 * Factory to create a [Resource].
 */
internal class ResourceFactory private constructor(
    private val logger: Logger,
    private val context: Context,
    private val sessionProvider: SessionProvider,
    private val config: Config
) {
    private val configuration = context.resources.configuration
    private val packageManager = context.packageManager
    private val resources = context.resources
    private val packageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        packageManager.getPackageInfo(
            context.packageName, PackageManager.PackageInfoFlags.of(0)
        )
    } else {
        packageManager.getPackageInfo(context.packageName, 0)
    }

    companion object {
        /**
         * Generates a new session ID and initializes all the fields of the [Resource].
         */
        fun create(
            logger: Logger,
            context: Context,
            sessionProvider: SessionProvider,
            config: Config
        ): Resource {
            return ResourceFactory(logger, context, sessionProvider, config).create()
        }
    }

    private fun create(): Resource {
        return Resource(
            session_id = sessionProvider.sessionId,
            device_name = Build.DEVICE,
            device_model = Build.MODEL,
            device_manufacturer = Build.MANUFACTURER,
            device_type = getDeviceType(),
            device_is_foldable = isFoldable(),
            device_is_physical = isEmulator() == false,
            device_density_dpi = configuration.densityDpi,
            device_width_px = resources.displayMetrics.widthPixels,
            device_height_px = resources.displayMetrics.heightPixels,
            device_density = resources.displayMetrics.density.toDouble(),
            os_name = "android",
            os_version = Build.VERSION.SDK_INT.toString(),
            platform = "android",
            app_version = packageInfo.versionName,
            app_build = getBuildVersionCode(),
            app_unique_id = context.packageName,
            measure_sdk_version = getMeasureVersion()
        )
    }

    // Using heuristics from:
    // https://android-developers.googleblog.com/2023/06/detecting-if-device-is-foldable-tablet.html
    private fun getDeviceType(): String? {
        val sw = configuration.smallestScreenWidthDp
        return when {
            sw == 0 -> null
            sw < 600 -> "phone"
            sw >= 600 -> "tablet"
            else -> null
        }
    }

    // Using heuristics from:
    // https://android-developers.googleblog.com/2023/06/detecting-if-device-is-foldable-tablet.html
    private fun isFoldable(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return context.packageManager.hasSystemFeature(PackageManager.FEATURE_SENSOR_HINGE_ANGLE)
        }
        return false
    }

    private fun getBuildVersionCode() = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        packageInfo.longVersionCode.toString()
    } else {
        packageInfo.versionCode.toString()
    }

    /**
     * A simple emulator-detection based on the flutter tools detection logic and a couple of legacy
     * detection systems.
     * Copied from: https://github.com/fluttercommunity/plus_plugins/blob/main/packages/device_info_plus/device_info_plus/android/src/main/kotlin/dev/fluttercommunity/plus/device_info/MethodCallHandlerImpl.kt#L109
     */
    private fun isEmulator(): Boolean? {
        return try {
            ((Build.BRAND.startsWith("generic") && Build.DEVICE.startsWith("generic")) || Build.FINGERPRINT.startsWith(
                "generic"
            ) || Build.FINGERPRINT.startsWith("unknown") || Build.HARDWARE.contains("goldfish") || Build.HARDWARE.contains(
                "ranchu"
            ) || Build.MODEL.contains("google_sdk") || Build.MODEL.contains("Emulator") || Build.MODEL.contains(
                "Android SDK built for x86"
            ) || Build.MANUFACTURER.contains("Genymotion") || Build.PRODUCT.contains("sdk") || Build.PRODUCT.contains(
                "vbox86p"
            ) || Build.PRODUCT.contains("emulator") || Build.PRODUCT.contains("simulator"))
        } catch (e: Exception) {
            logger.log(LogLevel.Error, "Error detecting emulator", e)
            null
        }
    }

    private fun getMeasureVersion(): String {
        return config.MEASURE_SDK_VERSION
    }
}