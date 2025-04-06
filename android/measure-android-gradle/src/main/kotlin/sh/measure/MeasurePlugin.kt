package sh.measure

import com.android.build.api.artifact.SingleArtifact
import com.android.build.api.variant.AndroidComponentsExtension
import com.android.build.api.variant.Variant
import com.android.build.gradle.internal.tasks.factory.dependsOn
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.file.Directory
import org.gradle.api.file.RegularFile
import org.gradle.api.provider.Provider
import sh.measure.asm.BytecodeTransformationPipelineBuilder
import sh.measure.asm.BytecodeTransformer
import sh.measure.asm.NavigationTransformer
import sh.measure.asm.OkHttpTransformer
import sh.measure.utils.capitalize
import java.time.Duration

class MeasurePlugin : Plugin<Project> {
    companion object {
        const val GROUP_NAME = "measure"
        const val SHARED_SERVICE_HTTP_CLIENT = "measure-http-client"
        const val DEFAULT_TIMEOUT_MS = 60_000L
        const val DEFAULT_RETRIES = 3
    }

    @Suppress("UnstableApiUsage")
    override fun apply(project: Project) {
        if (!project.plugins.hasPlugin("com.android.application")) {
            project.logger.warn(
                """
                WARNING: Measure gradle plugin can only be applied to Android application projects, 
                that is, projects that have the com.android.application plugin applied. 
                Applying the plugin to other project types has no effect.
                """.trimIndent(),
            )
            return
        }

        val measure = project.extensions.create("measure", MeasurePluginExtension::class.java)
        val androidComponents = project.extensions.getByType(AndroidComponentsExtension::class.java)
        val sdkDirectory = androidComponents.sdkComponents.sdkDirectory
        val httpClientProvider = project.gradle.sharedServices.registerIfAbsent(
            SHARED_SERVICE_HTTP_CLIENT,
            MeasureHttpClient::class.java,
        ) { spec ->
            spec.parameters.timeout.set(Duration.ofMillis(DEFAULT_TIMEOUT_MS))
        }
        val bytecodeTransformer: BytecodeTransformer =
            BytecodeTransformationPipelineBuilder().addTransformer(OkHttpTransformer())
                .addTransformer(NavigationTransformer()).build()

        androidComponents.onVariants { variant ->
            val variantFilter = VariantFilterImpl(variant.name)
            measure.filter.execute(variantFilter)
            if (!variantFilter.enabled) {
                project.logger.info("Measure gradle plugin is disabled for ${variant.name}")
                return@onVariants
            }
            bytecodeTransformer.transform(variant, project)
            registerBuildTasks(variant, project, httpClientProvider, sdkDirectory)
        }
    }

    private fun registerBuildTasks(
        variant: Variant,
        project: Project,
        httpClientProvider: Provider<MeasureHttpClient>,
        sdkDirectory: Provider<Directory>,
    ) {
        val extractManifestDataProvider = project.tasks.register(
            extractManifestDataTaskName(variant),
            ExtractManifestDataTask::class.java,
        ) {
            it.manifestInputProperty.set(variant.artifacts.get(SingleArtifact.MERGED_MANIFEST))
            it.manifestOutputProperty.set(manifestDataFileProvider(project, variant))
        }

        val apkSizeProvider = project.tasks.register(
            extractApkSizeTaskName(variant),
            ApkSizeTask::class.java,
        ) {
            it.apkDirectoryProperty.set(variant.artifacts.get(SingleArtifact.APK))
            it.appSizeOutputFileProperty.set(appSizeFileProvider(project, variant))
        }

        val aabSizeProvider = project.tasks.register(
            extractAabSizeTaskName(variant),
            AabSizeTask::class.java,
        ) {
            it.androidSdkDir.set(sdkDirectory)
            it.bundleFileProperty.set(variant.artifacts.get(SingleArtifact.BUNDLE))
            it.apksOutputDir.set(apksDirProvider(project, variant))
            it.appSizeOutputFileProperty.set(appSizeFileProvider(project, variant))
        }

        val uploadBuildProvider = project.tasks.register(
            buildUploadTaskName(variant),
            BuildUploadTask::class.java,
        ) {
            it.manifestDataProperty.set(manifestDataFileProvider(project, variant))
            it.mappingFileProperty.set(variant.artifacts.get(SingleArtifact.OBFUSCATION_MAPPING_FILE))
            it.appSizeFileProperty.set(appSizeFileProvider(project, variant))
            it.retriesProperty.set(DEFAULT_RETRIES)
            it.usesService(httpClientProvider)
            it.httpClientProvider.set(httpClientProvider)
        }.dependsOn(extractManifestDataProvider).apply {
            configure {
                val manifestDataFileProvider = manifestDataFileProvider(project, variant)
                it.onlyIf {
                    manifestDataFileProvider.get().asFile.exists()
                }
                // using dependsOn would not work as apkSizeProvider and aabSizeProvider will both
                // end up running and overwriting each other's output.
                it.mustRunAfter(apkSizeProvider, aabSizeProvider)
            }
        }

        // hook up the upload task to run after any assemble<variant> or bundle<variant>
        // apkSizeProvider should only run for assemble tasks, while aabSizeProvider should only
        // run for bundle tasks.
        project.afterEvaluate {
            it.tasks.named("assemble${variant.name.capitalize()}").configure { task ->
                task.finalizedBy(apkSizeProvider, uploadBuildProvider)
            }
            it.tasks.named("bundle${variant.name.capitalize()}").configure { task ->
                task.finalizedBy(aabSizeProvider, uploadBuildProvider)
            }
        }
    }

    private fun appSizeFileProvider(project: Project, variant: Variant): Provider<RegularFile> {
        return project.layout.buildDirectory.file("intermediates/measure/${variant.name}/appSize.txt")
    }

    private fun apksDirProvider(project: Project, variant: Variant): Provider<RegularFile> {
        return project.layout.buildDirectory.file("intermediates/measure/${variant.name}/bundle.apks")
    }

    private fun extractApkSizeTaskName(variant: Variant) =
        "calculateApkSize${variant.name.capitalize()}"

    private fun extractAabSizeTaskName(variant: Variant) =
        "calculateAabSize${variant.name.capitalize()}"

    private fun manifestDataFileProvider(
        project: Project,
        variant: Variant,
    ): Provider<RegularFile> {
        return project.layout.buildDirectory.file("intermediates/measure/${variant.name}/manifestData.json")
    }

    private fun buildUploadTaskName(variant: Variant) =
        "upload${variant.name.capitalize()}BuildToMeasure"

    private fun extractManifestDataTaskName(variant: Variant) =
        "extract${variant.name.capitalize()}ManifestData"
}
