package sh.measure

import com.android.SdkConstants
import com.android.prefs.AndroidLocationsSingleton
import com.android.repository.api.ProgressIndicatorAdapter
import com.android.sdklib.repository.AndroidSdkHandler
import com.android.tools.build.bundletool.androidtools.Aapt2Command
import com.android.tools.build.bundletool.commands.BuildApksCommand
import com.android.tools.build.bundletool.commands.GetSizeCommand
import org.gradle.api.DefaultTask
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.InputDirectory
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.Optional
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.TaskAction
import java.io.File
import java.io.PrintStream
import java.nio.file.Path

/**
 * Task to measure the size of an app bundle.
 *
 * AAB size is measured using bundletool. AAB size represents maximum size of the APK splits
 * generated from the AAB.
 *
 * The output is written to [appSizeOutputFileProperty] file in the following format:
 * app_size
 * build_type
 *
 * Example:
 * 466456
 * aab
 *
 * Also see, [ApkSizeTask]
 */
abstract class AabSizeTask : DefaultTask() {

    @get:Optional
    @get:InputDirectory
    abstract val androidSdkDir: DirectoryProperty

    @get:InputFile
    abstract val bundleFileProperty: RegularFileProperty

    @get:OutputFile
    abstract val apksOutputDir: RegularFileProperty

    @get:OutputFile
    abstract val appSizeOutputFileProperty: RegularFileProperty

    @TaskAction
    fun calculateAppSize() {
        val bundleFile = bundleFileProperty.getOrNull()?.asFile
        val appSizeOutputFile = appSizeOutputFileProperty.get().asFile
        val sdkDirectory = androidSdkDir.getOrNull()?.asFile
        if (bundleFile != null) {
            writeAabSize(bundleFile, appSizeOutputFile, sdkDirectory)
        }
    }

    private fun writeAabSize(bundleFile: File, appSizeOutputFile: File, sdkDirectory: File?) {
        val apksFile = apksOutputDir.get().asFile.apply {
            deleteRecursively()
        }
        // Effectively runs the following command:
        // bundletool build-apks --bundle=app.aab --output=bundle.apks
        val path = BuildApksCommand.builder().setBundlePath(bundleFile.toPath())
            .setOutputFile(apksFile.toPath())
            .setAapt2Command(Aapt2Command.createFromExecutablePath(getAapt2Location(sdkDirectory)))
            .setOutputFormat(BuildApksCommand.OutputFormat.APK_SET).build().execute()

        // Effectively runs the following command:
        // bundletool get-size total --apks=~bundle.apks
        // The output is of the format:
        // MIN,MAX
        // 323,456
        GetSizeCommand.builder().setApksArchivePath(path)
            .setGetSizeSubCommand(GetSizeCommand.GetSizeSubcommand.TOTAL).build()
            .getSizeTotal(PrintStream(appSizeOutputFile.outputStream()))

        // TODO: creating a custom event stream would be a better solution
        rewriteAabSizeOutput(appSizeOutputFile)
    }

    /**
     * Rewrites the output from GetSizeCommand to include the maximum size and the
     * type of build.
     */
    private fun rewriteAabSizeOutput(appSizeOutputFile: File) {
        val lines = appSizeOutputFile.readLines()
        appSizeOutputFile.writeText(
            """
            ${lines[1].split(",")[1]}
            aab
            """.trimIndent(),
        )
    }

    /**
     * Finds and returns the location of the aapt2 executable.
     */
    private fun getAapt2Location(sdkDirectory: File?): Path {
        val sdkLocation = sdkDirectory ?: File(checkNotNull(System.getenv("ANDROID_HOME")) {
            "Missing 'ANDROID_HOME' environment variable"
        })
        val sdkHandler =
            AndroidSdkHandler.getInstance(AndroidLocationsSingleton, sdkLocation.toPath())
        val progressIndicator = object : ProgressIndicatorAdapter() { /* No progress reporting */ }
        val buildToolInfo = sdkHandler.getLatestBuildTool(progressIndicator, true)
        return buildToolInfo.location.resolve(SdkConstants.FN_AAPT2)
    }
}
