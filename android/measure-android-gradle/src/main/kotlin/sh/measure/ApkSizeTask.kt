package sh.measure

import com.android.tools.apk.analyzer.internal.GzipSizeCalculator
import org.gradle.api.DefaultTask
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.InputDirectory
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.TaskAction
import java.io.File

/**
 * Task to measure the size of an  APK.
 *
 * APK size is measured using Apk Analyzer. APK size represents the download size of the APK.
 *
 * The output is written to [appSizeOutputFileProperty] file in the following format:
 * app_size
 * build_type
 *
 * Example:
 * 466456
 * apk
 *
 * Also see, [AabSizeTask]
 */
abstract class ApkSizeTask : DefaultTask() {

    @get:InputDirectory
    abstract val apkDirectoryProperty: DirectoryProperty

    @get:OutputFile
    abstract val appSizeOutputFileProperty: RegularFileProperty

    @TaskAction
    fun calculateAppSize() {
        val apkOutputDir = apkDirectoryProperty.getOrNull()?.asFile
        val apkFile = apkOutputDir?.listFiles()?.find { it.extension == "apk" }
        val appSizeOutputFile = appSizeOutputFileProperty.get().asFile
        if (apkFile?.exists() == true) {
            writeApkSize(apkFile, appSizeOutputFile)
        }
    }

    private fun writeApkSize(apkFile: File, apkSizeOutputFile: File) {
        val size = GzipSizeCalculator().getFullApkDownloadSize(apkFile.toPath())
        apkSizeOutputFile.writeText(
            """
            $size
            apk
            """.trimIndent(),
        )
    }
}
