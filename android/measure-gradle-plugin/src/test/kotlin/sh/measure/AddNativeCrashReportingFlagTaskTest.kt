package sh.measure

import org.gradle.testfixtures.ProjectBuilder
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.w3c.dom.Element
import java.io.File
import javax.xml.parsers.DocumentBuilderFactory

internal class AddNativeCrashReportingFlagTaskTest {

    @get:Rule
    val temporaryFolder = TemporaryFolder()

    @Test
    fun `adds the native crash reporting flag next to the existing meta-data`() {
        val mergedManifest = temporaryFolder.newFile("AndroidManifest.xml").apply {
            writeText(
                """
                <manifest xmlns:android="http://schemas.android.com/apk/res/android" package="sh.measure.sample">
                    <application>
                        <meta-data android:name="sh.measure.android.API_KEY" android:value="msrsh-api-key" />
                    </application>
                </manifest>
                """.trimIndent(),
            )
        }
        val updatedManifest = File(temporaryFolder.root, "updated/AndroidManifest.xml").apply { parentFile.mkdirs() }
        val task = ProjectBuilder.builder().build().tasks
            .register("addNativeCrashReportingFlag", AddNativeCrashReportingFlagTask::class.java)
            .get()
        task.mergedManifest.set(mergedManifest)
        task.updatedManifest.set(updatedManifest)

        task.addNativeCrashReportingFlag()

        assertEquals(
            listOf(
                "sh.measure.android.API_KEY" to "msrsh-api-key",
                "sh.measure.android.NATIVE_CRASH_REPORTING" to "true",
            ),
            applicationMetaData(updatedManifest),
        )
    }

    private fun applicationMetaData(manifest: File): List<Pair<String, String>> {
        val factory = DocumentBuilderFactory.newInstance().apply { isNamespaceAware = true }
        val application = factory.newDocumentBuilder().parse(manifest).getElementsByTagName("application").item(0) as Element
        val metaData = application.getElementsByTagName("meta-data")
        return (0 until metaData.length).map { index ->
            val element = metaData.item(index) as Element
            element.getAttribute("android:name") to element.getAttribute("android:value")
        }
    }
}
