package sh.measure.android.resource

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import kotlinx.serialization.Serializable
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger

/**
 * Factory to create a [Resource].
 */
internal class ResourceFactory private constructor(
    private val logger: Logger, private val context: Context, private val sessionId: String,
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
        fun create(logger: Logger, context: Context, sessionId: String): Resource {
            return ResourceFactory(logger, context, sessionId).create()
        }
    }

    private fun create(): Resource {
        return Resource(
            session_id = sessionId,
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

    private fun getMeasureVersion(): String? {
        // TODO(abhay): get measure SDK version using a gradle plugin
        return null
    }
}

/**
 * A resource represents the entity producing telemetry. This typically contains device, OS, app
 * identifiers, etc.
 */
@Serializable
data class Resource(
    // session info
    val session_id: String? = null,
    // device info
    val device_name: String? = null,
    val device_model: String? = null,
    val device_manufacturer: String? = null,
    val device_type: String? = null, // tablet, phone, tv, watch, etc.
    val device_is_foldable: Boolean? = null,
    val device_is_physical: Boolean? = null,
    val device_density_dpi: Int? = null,
    val device_width_px: Int? = null,
    val device_height_px: Int? = null,
    val device_density: Double? = null,
    // os info
    val os_name: String? = null,
    val os_version: String? = null,
    val platform: String? = null,
    // app info
    val app_version: String? = null,
    val app_build: String? = null,
    val app_unique_id: String? = null, // package name,
    val app_first_install_time: Long? = null,
    val app_last_update_time: Long? = null,
    val measure_sdk_version: String? = null,
)
