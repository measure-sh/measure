package sh.measure.android.storage

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PrefsStorageTest {

    @Test
    fun `allows setting and retrieving installation ID`() {
        val prefsStorage = PrefsStorageImpl(InstrumentationRegistry.getInstrumentation().context)
        prefsStorage.setInstallationId("installation-id")
        val result = prefsStorage.getInstallationId()

        assertEquals("installation-id", result)
    }

    @Test
    fun `returns null installation ID when it has not been set`() {
        val prefsStorage = PrefsStorageImpl(InstrumentationRegistry.getInstrumentation().context)
        val result = prefsStorage.getInstallationId()

        assertNull(result)
    }
}
