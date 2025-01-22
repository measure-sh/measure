package sh.measure

import org.gradle.internal.impldep.org.junit.rules.TemporaryFolder
import org.gradle.testfixtures.ProjectBuilder
import org.junit.After
import org.junit.Assert
import org.junit.Test
import java.io.File

internal class AabSizeTaskTest {
    private val temporaryFolder: TemporaryFolder = TemporaryFolder().apply { create() }

    @After
    fun tearDown() {
        temporaryFolder.delete()
    }

    @Test
    fun `calculates aab size and writes to output file`() {
        // setup project directory
        val project = ProjectBuilder.builder().withProjectDir(temporaryFolder.root).build()
        val bundleFile = loadAab(project.rootDir)
        val outputFile = createOutputAabSizeFile()
        val apksDir = File(temporaryFolder.root, "bundle.apks")

        // configure task
        val task = project.tasks.create("aabSizeTask", AabSizeTask::class.java)
        task.apksOutputDir.set(apksDir)
        task.bundleFileProperty.set(bundleFile)
        task.appSizeOutputFileProperty.set(outputFile)

        // execute task
        task.calculateAppSize()

        // assert
        Assert.assertTrue(outputFile.readText().contains("aab"))
    }

    private fun createOutputAabSizeFile(): File {
        return temporaryFolder.newFile("aabSize.txt")
    }

    /**
     * Copies the bundle file from resources to the project root directory.
     *
     * @return The aab file.
     */
    private fun loadAab(rootDir: File): File {
        val bundleFile = File("src/test/resources/test.aab")
        return bundleFile.copyTo(File(rootDir, "test.aab"))
    }
}
