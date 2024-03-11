package sh.measure

import org.gradle.api.DefaultTask
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.TaskAction

abstract class AppSizeTask: DefaultTask() {

    @get:InputFile
    abstract val bundleFileProperty: RegularFileProperty

    @get:OutputFile
    abstract val appSizeFileProperty: RegularFileProperty

    @TaskAction
    fun measureAppSize() {
        val bundleFile = bundleFileProperty.get().asFile
        val appSizeFile = appSizeFileProperty.get().asFile

        val appSize = bundleFile.length()
        appSizeFile.writeText(appSize.toString())
    }
}