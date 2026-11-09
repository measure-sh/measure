package sh.measure.android.utils

import sh.measure.android.storage.PrefsStorage

/**
 * Provides the installation ID. The installation ID is stored in shared preferences and is
 * generated once during the first launch of the app with Measure SDK and is persisted across app
 * launches.
 */
internal interface InstallationIdProvider {
    val installationId: String
}

internal class InstallationIdProviderImpl(
    private val prefsStorage: PrefsStorage,
    private val idProvider: IdProvider,
) : InstallationIdProvider {
    override val installationId: String by lazy {
        prefsStorage.getInstallationId() ?: idProvider.uuid().also {
            prefsStorage.setInstallationId(it)
        }
    }
}
