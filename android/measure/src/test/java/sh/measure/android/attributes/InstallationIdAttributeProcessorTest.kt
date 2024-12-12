package sh.measure.android.attributes

import org.junit.Assert.assertEquals
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import sh.measure.android.events.EventType
import sh.measure.android.fakes.FakeIdProvider
import sh.measure.android.fakes.TestData
import sh.measure.android.fakes.TestData.toEvent
import sh.measure.android.storage.PrefsStorage

class InstallationIdAttributeProcessorTest {
    private val prefsStorage = mock<PrefsStorage>()
    private val idProvider = FakeIdProvider()
    private val installationIdAttributeProcessor = InstallationIdAttributeProcessor(
        prefsStorage = prefsStorage,
        idProvider = idProvider,
    )

    @Test
    fun `given installation ID is not set, then creates, stores and returns installation ID in shared preferences`() {
        val installationIdKey = "installation_id"
        val installationId = idProvider.uuid()
        `when`(prefsStorage.getInstallationId()).thenReturn(null)
        val event = TestData.getExceptionData().toEvent(type = EventType.EXCEPTION)

        // When
        event.appendAttributes(listOf(installationIdAttributeProcessor))

        // Then
        verify(prefsStorage).setInstallationId(installationId)
        assertEquals(installationId, event.attributes[installationIdKey])
    }

    @Test
    fun `given installation ID is already set, then returns the stored installation ID`() {
        val installationIdKey = "installation_id"
        val installationId = idProvider.uuid()
        `when`(prefsStorage.getInstallationId()).thenReturn(installationId)
        val event = TestData.getExceptionData().toEvent(type = EventType.EXCEPTION)

        // When
        event.appendAttributes(listOf(installationIdAttributeProcessor))

        // Then
        verify(prefsStorage, never()).setInstallationId(installationId)
        assertEquals(installationId, event.attributes[installationIdKey])
    }
}
