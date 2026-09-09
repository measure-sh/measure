package sh.measure.android.attributes

import sh.measure.android.attributes.Attribute.PATCH_ID_KEY
import sh.measure.android.attributes.Attribute.PATCH_VERSION_KEY

/**
 * Maintains the state for the patch ID and patch version attributes. These are set once by the
 * React Native SDK when it initializes and are attached to every event and span generated after
 * that point, including native events. The values are held in memory only and are not persisted
 * across app restarts.
 */
internal class PatchAttributeProcessor : AttributeProcessor {
    private var patchId: String? = null
    private var patchVersion: String? = null

    override fun appendAttributes(attributes: MutableMap<String, Any?>) {
        patchId?.let { attributes[PATCH_ID_KEY] = it }
        patchVersion?.let { attributes[PATCH_VERSION_KEY] = it }
    }

    fun setPatch(patchId: String, patchVersion: String?) {
        this.patchId = patchId
        this.patchVersion = patchVersion
    }
}
