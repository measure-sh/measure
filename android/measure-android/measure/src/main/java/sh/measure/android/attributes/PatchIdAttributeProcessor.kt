package sh.measure.android.attributes

import sh.measure.android.attributes.Attribute.PATCH_ID_KEY

/**
 * Maintains the state for the patch_id attribute. The patch ID is set once at SDK initialization
 * and identifies the current OTA patch for sourcemap symbolication.
 */
internal class PatchIdAttributeProcessor : AttributeProcessor {
    private var patchId: String? = null

    override fun appendAttributes(attributes: MutableMap<String, Any?>) {
        attributes[PATCH_ID_KEY] = patchId
    }

    fun setPatchId(patchId: String) {
        this.patchId = patchId
    }
}
