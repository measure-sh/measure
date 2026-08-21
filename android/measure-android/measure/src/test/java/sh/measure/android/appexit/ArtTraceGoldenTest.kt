package sh.measure.android.appexit

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.kotlin.mock
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.utils.SystemServiceProvider
import java.io.File

private val CAPTURES = File("src/test/resources/artdump/raw")
private val GOLDENS = File("src/test/resources/artdump/golden")

/**
 * Reads every ART trace captured off a device and compares what the SDK
 * would send against the golden of the same name. Testing a new kind of
 * trace is dropping the capture into raw/ and regenerating:
 *
 *     ./gradlew :measure:testDebugUnitTest -Partdump.update=true
 *
 * The goldens are reviewed manually.
 */
@RunWith(AndroidJUnit4::class)
class ArtTraceGoldenTest {
    private val systemServiceProvider: SystemServiceProvider = mock()
    private val appExitProvider = AppExitProviderImpl(NoopLogger(), systemServiceProvider)
    private val updating = System.getProperty("artdump.update") == "true"

    @Test
    fun `every captured trace reads to its golden`() {
        val captures = CAPTURES.listFiles()?.sortedBy { it.name }.orEmpty()
        assertTrue("no captures in ${CAPTURES.absolutePath}", captures.isNotEmpty())

        for (capture in captures) {
            val golden = File(GOLDENS, capture.name)
            val read = render(capture.inputStream().use { appExitProvider.readTrace(it) })

            if (updating) {
                golden.parentFile.mkdirs()
                golden.writeText(read)
                continue
            }

            assertTrue("${capture.name} has no golden, regenerate", golden.exists())
            assertEquals(capture.name, golden.readText(), read)
        }

        assertFalse("goldens rewritten, drop -Partdump.update and review the diff", updating)
    }

    private fun render(trace: ArtTrace?): String {
        if (trace == null) {
            return "(no thread section)\n"
        }

        return "Subject: ${trace.subject ?: "(none)"}\n\n${trace.threads}"
    }
}
