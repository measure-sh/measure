package sh.measure.android.attributes

import org.junit.Assert.assertEquals
import org.junit.Test
import sh.measure.android.utils.ValidationLimits

class AttributeLimitsTest {
    @Test
    fun `truncates attributes that exceed their limits`() {
        val attributes = mutableMapOf<String, Any?>(
            Attribute.THREAD_NAME to "t".repeat(200),
            Attribute.USER_ID_KEY to "u".repeat(200),
            Attribute.DEVICE_NAME_KEY to "n".repeat(50),
            Attribute.DEVICE_MODEL_KEY to "m".repeat(50),
            Attribute.DEVICE_MANUFACTURER_KEY to "f".repeat(50),
            Attribute.DEVICE_LOCALE_KEY to "l".repeat(100),
            Attribute.APP_VERSION_KEY to "v".repeat(200),
            Attribute.APP_BUILD_KEY to "b".repeat(50),
            Attribute.NETWORK_PROVIDER_KEY to "p".repeat(100),
            Attribute.PATCH_VERSION_KEY to "x".repeat(300),
        )

        attributes.truncateToLimits()

        assertEquals(ValidationLimits.THREAD_NAME, (attributes[Attribute.THREAD_NAME] as String).length)
        assertEquals(ValidationLimits.USER_ID, (attributes[Attribute.USER_ID_KEY] as String).length)
        assertEquals(ValidationLimits.DEVICE_NAME, (attributes[Attribute.DEVICE_NAME_KEY] as String).length)
        assertEquals(ValidationLimits.DEVICE_MODEL, (attributes[Attribute.DEVICE_MODEL_KEY] as String).length)
        assertEquals(
            ValidationLimits.DEVICE_MANUFACTURER,
            (attributes[Attribute.DEVICE_MANUFACTURER_KEY] as String).length,
        )
        assertEquals(ValidationLimits.DEVICE_LOCALE, (attributes[Attribute.DEVICE_LOCALE_KEY] as String).length)
        assertEquals(ValidationLimits.APP_VERSION, (attributes[Attribute.APP_VERSION_KEY] as String).length)
        assertEquals(ValidationLimits.APP_BUILD, (attributes[Attribute.APP_BUILD_KEY] as String).length)
        assertEquals(
            ValidationLimits.NETWORK_PROVIDER,
            (attributes[Attribute.NETWORK_PROVIDER_KEY] as String).length,
        )
        assertEquals(ValidationLimits.PATCH_VERSION, (attributes[Attribute.PATCH_VERSION_KEY] as String).length)
    }

    @Test
    fun `keeps attributes within their limits unchanged`() {
        val attributes = mutableMapOf<String, Any?>(
            Attribute.THREAD_NAME to "main",
            Attribute.USER_ID_KEY to null,
            Attribute.DEVICE_WIDTH_PX_KEY to 1080,
            Attribute.APP_VERSION_KEY to "v".repeat(ValidationLimits.APP_VERSION),
        )
        val expected = attributes.toMap()

        attributes.truncateToLimits()

        assertEquals(expected, attributes)
    }
}
