package sh.measure.android.fakes

import sh.measure.android.network_change.NetworkGeneration
import sh.measure.android.network_change.NetworkType
import sh.measure.android.session.Resource
import sh.measure.android.session.ResourceFactory

internal class FakeResourceFactory(
    val resource: Resource = fakeResource()
) : ResourceFactory {
    override fun create(): Resource {
        return resource
    }
}

private fun fakeResource() = Resource(
    device_name = "device_name",
    device_model = "device_model",
    device_manufacturer = "device_manufacturer",
    device_type = "device_type",
    device_is_foldable = false,
    device_is_physical = true,
    device_density_dpi = 0,
    device_width_px = 0,
    device_height_px = 0,
    device_density = 0F,
    os_name = "os_name",
    os_version = "os_version",
    platform = "platform",
    app_version = "app_version",
    app_build = "app_build",
    app_unique_id = "app_unique_id",
    network_type = NetworkType.WIFI,
    network_generation = NetworkGeneration.FIFTH_GEN,
    network_provider_name = "Android",
    measure_sdk_version = "measure_sdk_version"
)