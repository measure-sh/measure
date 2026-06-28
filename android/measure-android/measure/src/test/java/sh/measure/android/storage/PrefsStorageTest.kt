package sh.measure.android.storage

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PrefsStorageTest {

    private lateinit var prefsStorage: PrefsStorageImpl

    @Before
    fun setUp() {
        prefsStorage =
            PrefsStorageImpl(InstrumentationRegistry.getInstrumentation().context)
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
    fun `returns null previous session when none has been recorded`() {
        assertNull(prefsStorage.getPreviousSession())
    }

    @Test
    fun `returns null previous session after only one session is recorded`() {
        prefsStorage.rotateSession("session-1", 1000L, 111, "1.0.0", "100")

        assertNull(prefsStorage.getPreviousSession())
    }

    @Test
    fun `rotateSession moves the prior current session into the previous slot`() {
        prefsStorage.rotateSession("session-1", 1000L, 111, "1.0.0", "100")
        prefsStorage.rotateSession("session-2", 2000L, 222, "2.0.0", "200")

        assertEquals(
            PreviousSession(
                id = "session-1",
                startTime = 1000L,
                pid = 111,
                appVersion = "1.0.0",
                appBuild = "100",
            ),
            prefsStorage.getPreviousSession(),
        )

        prefsStorage.rotateSession("session-3", 3000L, 333, "3.0.0", "300")

        assertEquals(
            PreviousSession(
                id = "session-2",
                startTime = 2000L,
                pid = 222,
                appVersion = "2.0.0",
                appBuild = "200",
            ),
            prefsStorage.getPreviousSession(),
        )
    }
}
