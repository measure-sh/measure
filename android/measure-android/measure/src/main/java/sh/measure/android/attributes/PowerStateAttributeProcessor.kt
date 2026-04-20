package sh.measure.android.attributes

import sh.measure.android.PowerStateProvider

internal class PowerStateAttributeProcessor(
    private val powerStateProvider: PowerStateProvider,
) : AttributeProcessor {
    override fun appendAttributes(attributes: MutableMap<String, Any?>) {
        powerStateProvider.lowPowerModeEnabled?.let {
            attributes.put(Attribute.DEVICE_LOW_POWER_ENABLED, it)
        }

        powerStateProvider.thermalThrottlingEnabled?.let {
            attributes.put(Attribute.DEVICE_THERMAL_THROTTLING_ENABLED, it)
        }
    }
}
