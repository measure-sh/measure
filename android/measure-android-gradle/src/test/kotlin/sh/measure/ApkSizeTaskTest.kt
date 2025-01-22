package sh.measure

import com.android.build.api.artifact.SingleArtifact
import org.gradle.internal.impldep.org.junit.rules.TemporaryFolder
import org.gradle.testfixtures.ProjectBuilder
import org.junit.After
import org.junit.Assert
import org.junit.Test
import java.io.File

internal class ApkSizeTaskTest {
    private val temporaryFolder: TemporaryFolder = TemporaryFolder().apply { create() }

    @After
    fun tearDown() {
        temporaryFolder.delete()
    }

    @Test
    fun `calculates apk size and writes to output file`() {
        // setup project directory
        val project = ProjectBuilder.builder().withProjectDir(temporaryFolder.root).build()
        val apkFile = loadApk(project.rootDir)
        val outputFile = createOutputApkSizeFile()

        // configure task
        val task = project.tasks.create("appSizeTask", ApkSizeTask::class.java)
        task.apkDirectoryProperty.set(apkFile)
        task.appSizeOutputFileProperty.set(outputFile)

        // execute task
        task.calculateAppSize()

        // assert
        Assert.assertEquals("11108716\napk", outputFile.readText())
    }

    private fun createOutputApkSizeFile(): File {
        return temporaryFolder.newFile("apkSize.txt")
    }

    /**
     * Copies the apk file from resources to the project root directory.
     *
     * @return the directory where the apk file is copied to, this is to match the behavior of
     * [SingleArtifact.APK] which returns the directory containing the apk file.
     */
    private fun loadApk(rootDir: File): File {
        val bundleFile = File("src/test/resources/test.apk")
        bundleFile.copyTo(File(rootDir, "test.apk"))
        return rootDir
    }
}
