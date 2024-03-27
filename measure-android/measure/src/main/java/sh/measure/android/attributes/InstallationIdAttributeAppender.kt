package sh.measure.android.attributes

import sh.measure.android.storage.PrefsStorage
import sh.measure.android.utils.UUIDProvider

/**
 * Generates the installation ID. The installation ID is stored in shared preferences and is
 * generated once during the first launch of the app with Measure SDK and is persisted across app
 * launches.
 */
internal class InstallationIdAttributeAppender(
    private val prefsStorage: PrefsStorage, private val idProvider: UUIDProvider
) : ComputeOnceAttributeAppender() {
    private val installationIdKey = "installation_id"

    override fun computeAttributes(): Map<String, Any?> {
        val installationId = prefsStorage.getInstallationId()
        if (installationId == null) {
            val newInstallationId = idProvider.createId()
            prefsStorage.setInstallationId(newInstallationId)
            return mapOf(installationIdKey to newInstallationId)
        }
        return mapOf(installationIdKey to installationId)
    }
}