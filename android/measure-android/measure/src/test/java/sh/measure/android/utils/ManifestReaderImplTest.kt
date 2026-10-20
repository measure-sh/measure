package sh.measure.android.utils

import android.content.Context
import android.os.Bundle
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Shadows.shadowOf
import sh.measure.android.fakes.NoopLogger

@RunWith(AndroidJUnit4::class)
class ManifestReaderImplTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val reader = ManifestReaderImpl(context, NoopLogger())

    @Test
    fun `native crash reporting is off when the flag is missing`() {
        setMetaData(Bundle())

        assertFalse(reader.load()!!.nativeCrashReporting)
    }

    @Test
    fun `native crash reporting is on when the flag is set`() {
        setMetaData(Bundle().apply { putBoolean("sh.measure.android.NATIVE_CRASH_REPORTING", true) })

        assertTrue(reader.load()!!.nativeCrashReporting)
    }

    private fun setMetaData(metaData: Bundle) {
        shadowOf(context.packageManager)
            .getInternalMutablePackageInfo(context.packageName)
            .applicationInfo!!
            .metaData = metaData
    }
}
