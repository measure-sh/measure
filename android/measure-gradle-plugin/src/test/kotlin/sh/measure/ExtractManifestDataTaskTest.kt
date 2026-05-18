package sh.measure

import org.gradle.api.Project
import org.gradle.internal.impldep.org.junit.Rule
import org.gradle.internal.impldep.org.junit.rules.TemporaryFolder
import org.gradle.testfixtures.ProjectBuilder
import org.junit.Assert
import org.junit.Before
import org.junit.Test
import java.io.File

internal class ExtractManifestDataTaskTest {

    @field:Rule
    lateinit var temporaryFolder: TemporaryFolder
    private lateinit var manifestFile: File
    private lateinit var outputFile: File
    private lateinit var project: Project
    private lateinit var task: ExtractManifestDataTask

    @Before
    fun setup() {
        temporaryFolder = TemporaryFolder()
        temporaryFolder.create()
        manifestFile = temporaryFolder.newFile("AndroidManifest.xml")
        outputFile = temporaryFolder.newFile("manifestData.json")
    }

    @Test
    fun `ExtractManifestDataTask produces correct output from a valid manifest file`() {
        manifestFile.writeText(validManifest)
        configureTask()
        task.extractManifestData()
        val validManifestOutput = """
                {"apiKey":"msrsh-api-key","apiUrl":"api-url","versionCode":"100","appUniqueId":"sh.measure.sample","versionName":"1.0.0"}
        """.trimIndent()
        Assert.assertEquals(validManifestOutput, outputFile.readText())
    }

    @Test
    fun `ExtractManifestDataTask does not output the file when API key is missing in manifest`() {
        manifestFile.writeText(manifestWithoutApiKey)
        configureTask()
        task.extractManifestData()
        Assert.assertTrue(outputFile.readText().isEmpty())
    }

    @Test
    fun `ExtractManifestDataTask does not output the file when API URL is missing in manifest`() {
        manifestFile.writeText(manifestWithoutApiUrl)
        configureTask()
        task.extractManifestData()
        Assert.assertTrue(outputFile.readText().isEmpty())
    }

    @Test
    fun `ExtractManifestDataTask does not output the file when API KEY is invalid`() {
        manifestFile.writeText(manifestWithInvalidApiKey)
        configureTask()
        task.extractManifestData()
        Assert.assertTrue(outputFile.readText().isEmpty())
    }

    private fun configureTask() {
        project = ProjectBuilder.builder().withProjectDir(temporaryFolder.root).build()
        task = project.tasks.create("task", ExtractManifestDataTask::class.java)
        task.manifestInputProperty.set(manifestFile)
        task.manifestOutputProperty.set(outputFile)
    }

    private val validManifest = """
            <?xml version="1.0" encoding="utf-8"?>
            <manifest xmlns:android="http://schemas.android.com/apk/res/android"
                package="sh.measure.sample"
                android:versionCode="100"
                android:versionName="1.0.0">
            
                <application>
                    <meta-data
                        android:name="sh.measure.android.API_KEY"
                        android:value="msrsh-api-key" />
                        
                    <meta-data
                        android:name="sh.measure.android.API_URL"
                        android:value="api-url" />
                </application>
            </manifest>
    """.trimIndent()

    private val manifestWithoutApiKey = """
            <?xml version="1.0" encoding="utf-8"?>
            <manifest xmlns:android="http://schemas.android.com/apk/res/android"
                package="sh.measure.sample"
                android:versionCode="100"
                android:versionName="1.0.0">
                <application>
                      <meta-data
                        android:name="sh.measure.android.API_URL"
                        android:value="api-url" />
                </application>
            </manifest>
    """.trimIndent()

    private val manifestWithInvalidApiKey = """
            <?xml version="1.0" encoding="utf-8"?>
            <manifest xmlns:android="http://schemas.android.com/apk/res/android"
                package="sh.measure.sample"
                android:versionCode="100"
                android:versionName="1.0.0">
                <application>
                      <meta-data
                        android:name="sh.measure.android.API_URL"
                        android:value="invalid-api-key" />
                </application>
            </manifest>
    """.trimIndent()

    private val manifestWithoutApiUrl = """
            <?xml version="1.0" encoding="utf-8"?>
            <manifest xmlns:android="http://schemas.android.com/apk/res/android"
                package="sh.measure.sample"
                android:versionCode="100"
                android:versionName="1.0.0">
                <application>
                      <meta-data
                        android:name="sh.measure.android.API_KEY"
                        android:value="api-key" />
                </application>
            </manifest>
    """.trimIndent()
}
