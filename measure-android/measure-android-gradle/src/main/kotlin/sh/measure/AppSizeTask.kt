package sh.measure

import com.android.SdkConstants
import com.android.build.gradle.internal.SdkLocator
import com.android.builder.errors.DefaultIssueReporter
import com.android.prefs.AndroidLocationsSingleton
import com.android.repository.api.ProgressIndicatorAdapter
import com.android.sdklib.repository.AndroidSdkHandler
import com.android.tools.apk.analyzer.internal.GzipSizeCalculator
import com.android.tools.build.bundletool.androidtools.Aapt2Command
import com.android.tools.build.bundletool.commands.BuildApksCommand
import com.android.tools.build.bundletool.commands.GetSizeCommand
import com.android.utils.StdLogger
import org.gradle.api.DefaultTask
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.OutputDirectory
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.TaskAction
import java.io.File
import java.io.PrintStream
import java.nio.file.Path

/**
 * Task to measure the size of an app bundle or APK.
 *
 * APK size is measured using Apk Analyzer, while AAB size is measured using bundletool.
 * APK size represents the download size of the APK, while AAB size represents the minimum and
 * maximum size of the APK splits generated from the AAB.
 *
 * The output is written to [appSizeOutputFileProperty] file in the following format:
 * app_size
 * build_type
 *
 * Example:
 * 466456
 * apk
 */
abstract class AppSizeTask : DefaultTask() {
    @get:InputFile
    abstract val bundleFileProperty: RegularFileProperty

    @get:InputFile
    abstract val apkFileProperty: RegularFileProperty

    @get:OutputDirectory
    abstract val buildApksOutputDirProperty: DirectoryProperty

    @get:OutputFile
    abstract val appSizeOutputFileProperty: RegularFileProperty

    @TaskAction
    fun calculateAppSize() {
        val apkFile = apkFileProperty.getOrNull()?.asFile
        val bundleFile = bundleFileProperty.getOrNull()?.asFile
        val appSizeOutputFile = appSizeOutputFileProperty.get().asFile

        if (bundleFile != null) {
            writeAabSize(bundleFile, appSizeOutputFile)
        }
        if (apkFile != null) {
            writeApkSize(apkFile, appSizeOutputFile)
        }
    }

    private fun writeApkSize(apkFile: File, apkSizeOutputFile: File) {
        val size = GzipSizeCalculator().getFullApkDownloadSize(apkFile.toPath())
        apkSizeOutputFile.writeText(
            """
            $size
            apk
        """.trimIndent()
        )
    }

    private fun writeAabSize(bundleFile: File, appSizeOutputFile: File) {
        // Effectively runs the following command:
        // bundletool build-apks --bundle=app.aab --output=bundle.apks
        val path = BuildApksCommand.builder().setBundlePath(bundleFile.toPath())
            .setOutputFile(buildApksOutputDirProperty.asFile.get().toPath())
            .setAapt2Command(Aapt2Command.createFromExecutablePath(getAapt2Location()))
            .setOutputFormat(BuildApksCommand.OutputFormat.APK_SET).build().execute()

        // Effectively runs the following command:
        // bundletool get-size total --apks=~bundle.apks
        // The output is of the format:
        // MIN,MAX
        // 323,456
        GetSizeCommand.builder().setApksArchivePath(path)
            .setGetSizeSubCommand(GetSizeCommand.GetSizeSubcommand.TOTAL).build()
            .getSizeTotal(PrintStream(appSizeOutputFile.outputStream()))
        rewriteAabSizeOutput(appSizeOutputFile)
    }

    /**
     * Rewrites the output from GetSizeCommand to include
     * the maximum size and the type of build: aab or apk
     */
    private fun rewriteAabSizeOutput(appSizeOutputFile: File) {
        val lines = appSizeOutputFile.readLines()
        appSizeOutputFile.writeText(
            """
            ${lines[1].split(",")[1]}
            aab
            """.trimIndent()
        )
    }

    /**
     * Finds and returns the location of the aapt2 executable.
     */
    private fun getAapt2Location(): Path {
        val sdkLocation = getAndroidSdkLocation()
        val sdkHandler = AndroidSdkHandler.getInstance(AndroidLocationsSingleton, sdkLocation)
        val progressIndicator = object : ProgressIndicatorAdapter() {}
        val buildToolInfo = sdkHandler.getLatestBuildTool(progressIndicator, true)
        return buildToolInfo.location.resolve(SdkConstants.FN_AAPT2)
    }

    /**
     * Finds and returns the location of the Android SDK.
     */
    private fun getAndroidSdkLocation(): Path {
        val logger = StdLogger(StdLogger.Level.WARNING)
        val issueReporter = DefaultIssueReporter(logger)
        return SdkLocator.getSdkDirectory(project.rootDir, issueReporter).toPath()
    }
}