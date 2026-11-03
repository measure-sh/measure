package sh.measure.android.utils

import org.junit.Assert.assertEquals
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.storage.PrefsStorage

class InstallationIdProviderTest {
    private val prefsStorage = mock<PrefsStorage>()
    private val idProvider = FakeIdProvider()
    private val installationIdProvider = InstallationIdProviderImpl(
        prefsStorage = prefsStorage,
        idProvider = idProvider,
    )

    @Test
    fun `given installation ID is not set, then creates, stores and returns installation ID`() {
        val installationId = idProvider.uuid()
        `when`(prefsStorage.getInstallationId()).thenReturn(null)

        assertEquals(installationId, installationIdProvider.installationId)
        verify(prefsStorage).setInstallationId(installationId)
    }

    @Test
    fun `given installation ID is already set, then returns the stored installation ID`() {
        val installationId = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"
        `when`(prefsStorage.getInstallationId()).thenReturn(installationId)

        assertEquals(installationId, installationIdProvider.installationId)
        verify(prefsStorage, never()).setInstallationId(installationId)
    }
}
