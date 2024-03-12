package sh.measure

import org.gradle.internal.impldep.org.junit.rules.TemporaryFolder
import org.gradle.testfixtures.ProjectBuilder
import org.junit.After
import org.junit.Assert
import org.junit.Test
import java.io.File

internal class AppSizeTaskTest {
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
        val task = project.tasks.create("appSizeTask", AppSizeTask::class.java)
        task.buildApksOutputDirProperty.set(apksDir)
        task.bundleFileProperty.set(bundleFile)
        task.appSizeOutputFileProperty.set(outputFile)

        // execute task
        task.calculateAppSize()

        // assert
        Assert.assertEquals(listOf("1797367"), outputFile.readLines())
    }

    @Test
    fun `calculates apk size and writes to output file`() {
        // setup project directory
        val project = ProjectBuilder.builder().withProjectDir(temporaryFolder.root).build()
        val apkFile = loadApk(project.rootDir)
        val outputFile = createOutputApkSizeFile()

        // configure task
        val task = project.tasks.create("appSizeTask", AppSizeTask::class.java)
        task.apkFileProperty.set(apkFile)
        task.appSizeOutputFileProperty.set(outputFile)

        // execute task
        task.calculateAppSize()

        // assert
        Assert.assertEquals("11108716", outputFile.readText())
    }

    private fun createOutputAabSizeFile(): File {
        return temporaryFolder.newFile("aabSize.txt")
    }

    private fun createOutputApkSizeFile(): File {
        return temporaryFolder.newFile("apkSize.txt")
    }

    /**
     * Copies the bundle file from resources to the project root directory.
     */
    private fun loadAab(rootDir: File): File {
        val bundleFile = File("src/test/resources/test.aab")
        return bundleFile.copyTo(File(rootDir, "test.aab"))
    }

    private fun loadApk(rootDir: File): File {
        val bundleFile = File("src/test/resources/test.apk")
        return bundleFile.copyTo(File(rootDir, "test.apk"))
    }
}