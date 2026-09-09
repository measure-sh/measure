package sh.measure.android.attributes

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import sh.measure.android.attributes.Attribute.PATCH_ID_KEY
import sh.measure.android.attributes.Attribute.PATCH_VERSION_KEY

class PatchAttributeProcessorTest {
    private val patchAttributeProcessor = PatchAttributeProcessor()

    @Test
    fun `does not append patch attributes when patch is not set`() {
        val attributes = mutableMapOf<String, Any?>()
        patchAttributeProcessor.appendAttributes(attributes)

        assertNull(attributes[PATCH_ID_KEY])
        assertNull(attributes[PATCH_VERSION_KEY])
    }

    @Test
    fun `appends patch id and version to attributes once set`() {
        patchAttributeProcessor.setPatch("patch-id", "v1.0.3-hotfix")

        val attributes = mutableMapOf<String, Any?>()
        patchAttributeProcessor.appendAttributes(attributes)

        assertEquals("patch-id", attributes[PATCH_ID_KEY])
        assertEquals("v1.0.3-hotfix", attributes[PATCH_VERSION_KEY])
    }

    @Test
    fun `appends patch id without version when version is not set`() {
        patchAttributeProcessor.setPatch("patch-id", null)

        val attributes = mutableMapOf<String, Any?>()
        patchAttributeProcessor.appendAttributes(attributes)

        assertEquals("patch-id", attributes[PATCH_ID_KEY])
        assertNull(attributes[PATCH_VERSION_KEY])
    }
}
