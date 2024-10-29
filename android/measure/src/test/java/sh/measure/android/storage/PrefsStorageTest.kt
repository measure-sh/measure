package sh.measure.android.storage

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import sh.measure.android.RecentSession
import sh.measure.android.fakes.NoopLogger
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class PrefsStorageTest {

    private lateinit var prefsStorage: PrefsStorageImpl

    @Before
    fun setUp() {
        prefsStorage =
            PrefsStorageImpl(NoopLogger(), InstrumentationRegistry.getInstrumentation().context)
    }

    @Test
    fun `allows setting and retrieving installation ID`() {
        prefsStorage.setInstallationId("installation-id")
        val result = prefsStorage.getInstallationId()

        assertEquals("installation-id", result)
    }

    @Test
    fun `returns null installation ID when it has not been set`() {
        val result = prefsStorage.getInstallationId()

        assertNull(result)
    }

    @Test
    fun `allows setting and retrieving user ID`() {
        prefsStorage.setUserId("user-123")
        val result = prefsStorage.getUserId()

        assertEquals("user-123", result)
    }

    @Test
    fun `returns null user ID when it has not been set`() {
        val result = prefsStorage.getUserId()

        assertNull(result)
    }

    @Test
    fun `allows clearing user ID`() {
        prefsStorage.setUserId("user-123")
        prefsStorage.setUserId(null)
        val result = prefsStorage.getUserId()

        assertNull(result)
    }

    @Test
    fun `allows setting and retrieving recent session`() {
        val recentSession = RecentSession(
            id = UUID.randomUUID().toString(),
            lastEventTime = 1000,
            createdAt = 98765432,
            crashed = false,
            versionCode = "app-version",
        )
        prefsStorage.setRecentSession(recentSession)
        val result = prefsStorage.getRecentSession()

        assertEquals(recentSession, result)
    }

    @Test
    fun `returns null recent session when it has not been set`() {
        val result = prefsStorage.getRecentSession()

        assertNull(result)
    }
}
