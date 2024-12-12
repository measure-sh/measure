package sh.measure.android.attributes

import sh.measure.android.storage.PrefsStorage
import sh.measure.android.utils.IdProvider

/**
 * Generates the installation ID. The installation ID is stored in shared preferences and is
 * generated once during the first launch of the app with Measure SDK and is persisted across app
 * launches.
 */
internal class InstallationIdAttributeProcessor(
    private val prefsStorage: PrefsStorage,
    private val idProvider: IdProvider,
) : ComputeOnceAttributeProcessor() {

    override fun computeAttributes(): Map<String, Any?> {
        val installationId = prefsStorage.getInstallationId()
        if (installationId == null) {
            val newInstallationId = idProvider.uuid()
            prefsStorage.setInstallationId(newInstallationId)
            return mapOf(Attribute.INSTALLATION_ID_KEY to newInstallationId)
        }
        return mapOf(Attribute.INSTALLATION_ID_KEY to installationId)
    }
}
