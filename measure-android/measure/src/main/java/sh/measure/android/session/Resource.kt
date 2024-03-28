package sh.measure.android.session

import kotlinx.serialization.Serializable

/**
 * A resource represents the entity producing telemetry. This typically contains device, OS, app
 * identifiers, etc.
 */
@Serializable
@Deprecated("This class is deprecated and will be removed in a future release.")
internal data class Resource(
    // device info
    val device_name: String? = null,
    val device_model: String? = null,
    val device_manufacturer: String? = null,
    // tablet, phone, tv, watch, etc.
    val device_type: String? = null,
    val device_is_foldable: Boolean? = null,
    val device_is_physical: Boolean? = null,
    val device_density_dpi: Int? = null,
    val device_width_px: Int? = null,
    val device_height_px: Int? = null,
    val device_density: Float? = null,
    val device_locale: String? = null,
    // os info
    val os_name: String? = null,
    val os_version: String? = null,
    val platform: String? = null,
    // app info
    val app_version: String? = null,
    val app_build: String? = null,
    // package name
    val app_unique_id: String? = null,
    val network_type: String? = null,
    val network_generation: String? = null,
    val network_provider_name: String? = null,
    val measure_sdk_version: String? = null,
)
