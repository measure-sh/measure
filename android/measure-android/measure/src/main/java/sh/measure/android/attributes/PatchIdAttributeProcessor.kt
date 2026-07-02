package sh.measure.android.attributes

import sh.measure.android.attributes.Attribute.PATCH_ID_KEY
import sh.measure.android.attributes.Attribute.PATCH_VERSION_KEY

/**
 * Maintains the state for the patch_id and patch_version attributes. Both are set once at SDK
 * initialization and identify the current OTA patch for sourcemap symbolication.
 */
internal class PatchIdAttributeProcessor : AttributeProcessor {
    private var patchId: String? = null
    private var patchVersion: String? = null

    override fun appendAttributes(attributes: MutableMap<String, Any?>) {
        attributes[PATCH_ID_KEY] = patchId
        attributes[PATCH_VERSION_KEY] = patchVersion
    }

    fun setPatchId(patchId: String) {
        this.patchId = patchId
    }

    fun setPatchVersion(patchVersion: String) {
        this.patchVersion = patchVersion
    }
}
