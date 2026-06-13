package sh.measure

import com.android.build.api.artifact.SingleArtifact
import com.android.build.api.variant.AndroidComponentsExtension
import com.android.build.api.variant.Variant
import com.android.build.gradle.internal.tasks.factory.dependsOn
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.Directory
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFile
import org.gradle.api.provider.ListProperty
import org.gradle.api.provider.Property
import org.gradle.api.provider.Provider
import org.gradle.api.tasks.TaskProvider
import org.gradle.api.tasks.bundling.Compression
import org.gradle.api.tasks.bundling.Tar
import sh.measure.asm.BytecodeTransformationPipelineBuilder
import sh.measure.asm.BytecodeTransformer
import sh.measure.asm.HttpUrlConnectionTransformer
import sh.measure.asm.LogTransformer
import sh.measure.asm.NavigationTransformer
import sh.measure.asm.OkHttpTransformer
import sh.measure.utils.capitalize
import java.io.File
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
        val httpClientProvider =
            project.gradle.sharedServices.registerIfAbsent(
                SHARED_SERVICE_HTTP_CLIENT,
                MeasureHttpClient::class.java,
            ) { spec ->
                spec.parameters.timeout.set(Duration.ofMillis(DEFAULT_TIMEOUT_MS))
            }
        val bytecodeTransformer: BytecodeTransformer =
            BytecodeTransformationPipelineBuilder()
                .addTransformer(OkHttpTransformer())
                .addTransformer(NavigationTransformer())
                .addTransformer(HttpUrlConnectionTransformer())
                .addTransformer(LogTransformer())
                .build()

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
        val extractManifestDataProvider =
            project.tasks.register(
                extractManifestDataTaskName(variant),
                ExtractManifestDataTask::class.java,
            ) {
                it.manifestInputProperty.set(variant.artifacts.get(SingleArtifact.MERGED_MANIFEST))
                it.manifestOutputProperty.set(manifestDataFileProvider(project, variant))
            }

        val apkSizeProvider =
            project.tasks.register(
                extractApkSizeTaskName(variant),
                ApkSizeTask::class.java,
            ) {
                it.apkDirectoryProperty.set(variant.artifacts.get(SingleArtifact.APK))
                it.appSizeOutputFileProperty.set(appSizeFileProvider(project, variant))
            }

        val aabSizeProvider =
            project.tasks.register(
                extractAabSizeTaskName(variant),
                AabSizeTask::class.java,
            ) {
                it.androidSdkDir.set(sdkDirectory)
                it.bundleFileProperty.set(variant.artifacts.get(SingleArtifact.BUNDLE))
                it.apksOutputDir.set(apksDirProvider(project, variant))
                it.appSizeOutputFileProperty.set(appSizeFileProvider(project, variant))
            }

        val rnBundleArchives = project.objects.fileCollection()

        val uploadBuildProvider =
            project.tasks
                .register(
                    buildUploadTaskName(variant),
                    BuildUploadTask::class.java,
                ) {
                    it.manifestFileProperty.set(manifestDataFileProvider(project, variant))
                    // When R8 is disabled the obfuscation mapping artifact is absent or
                    // points to a file that is never produced. orElse keeps the collection
                    // (and task graph) resolvable in that case, while still depending on the
                    // R8 task when a mapping is produced; upload() filters to files that exist.
                    it.mappingFiles.from(
                        variant.artifacts.get(SingleArtifact.OBFUSCATION_MAPPING_FILE)
                            .map { mapping -> listOf(mapping.asFile) }
                            .orElse(emptyList()),
                    )
                    getFlutterSymbolsDirPath(project)?.let { dir ->
                        it.flutterSymbolsFiles.from(
                            project.fileTree(dir) { tree -> tree.include("**/*.symbols") },
                        )
                    }
                    it.reactNativeBundleArchives.setFrom(rnBundleArchives)
                    it.buildMetadataFileProperty.set(appSizeFileProvider(project, variant))
                    it.retriesProperty.set(DEFAULT_RETRIES)
                    it.usesService(httpClientProvider)
                    it.httpClientProvider.set(httpClientProvider)
                }.dependsOn(extractManifestDataProvider)
                .apply {
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
        wireReactNativeBundle(project, variant, rnBundleArchives)
    }

    private fun getFlutterExtension(project: Project): Any? = project.extensions.findByName("flutter")

    private fun appSizeFileProvider(
        project: Project,
        variant: Variant,
    ): Provider<RegularFile> = project.layout.buildDirectory.file("intermediates/measure/${variant.name}/appSize.txt")

    private fun apksDirProvider(
        project: Project,
        variant: Variant,
    ): Provider<RegularFile> = project.layout.buildDirectory.file("intermediates/measure/${variant.name}/bundle.apks")

    private fun extractApkSizeTaskName(variant: Variant) = "calculateApkSize${variant.name.capitalize()}"

    private fun extractAabSizeTaskName(variant: Variant) = "calculateAabSize${variant.name.capitalize()}"

    private fun manifestDataFileProvider(
        project: Project,
        variant: Variant,
    ): Provider<RegularFile> = project.layout.buildDirectory.file("intermediates/measure/${variant.name}/manifestData.json")

    private fun buildUploadTaskName(variant: Variant) = "upload${variant.name.capitalize()}BuildToMeasure"

    private fun extractManifestDataTaskName(variant: Variant) = "extract${variant.name.capitalize()}ManifestData"

    private fun packageReactNativeBundleTaskName(variant: Variant) = "packageReactNativeBundle${variant.name.capitalize()}"

    private fun packageReactNativeSourceMapTaskName(variant: Variant) = "packageReactNativeSourceMap${variant.name.capitalize()}"

    private fun rewriteReactNativeSourceMapTaskName(variant: Variant) = "rewriteReactNativeSourceMap${variant.name.capitalize()}"

    private fun emptyReactNativeBundleTaskName(variant: Variant) = "prepareEmptyReactNativeBundle${variant.name.capitalize()}"

    // The builds API expects the JS bundle and its source map as two separate
    // jsbundle mappings, each a .tgz wrapping a single file. Symbolication pairs
    // them server-side via the inner filename's .map suffix.
    //
    // With Hermes the bundle is bytecode that symbolication never reads, only the
    // source map matters, so we package an empty placeholder named after the bundle
    // asset instead of uploading the real (large) bytecode bundle. The placeholder
    // keeps the archive and inner filename intact so server-side pairing still works.
    private fun wireReactNativeBundle(
        project: Project,
        variant: Variant,
        rnBundleArchives: ConfigurableFileCollection,
    ) {
        if (!project.plugins.hasPlugin("com.facebook.react")) return

        val capName = variant.name.capitalize()
        val candidateNames = setOf(
            "createBundle${capName}JsAndAssets",
            "bundle${capName}JsAndAssets",
        )

        val bundleFile = project.objects.fileProperty()
        val sourceMapFile = project.objects.fileProperty()
        val emptyBundleAssetName = project.objects.property(String::class.java)
        val emptyBundleFile = project.layout.buildDirectory.file(
            emptyBundleAssetName.map { "intermediates/measure/${variant.name}/emptyBundle/$it" },
        )
        val emptyBundleTask = project.tasks.register(emptyReactNativeBundleTaskName(variant)) { task ->
            task.onlyIf { emptyBundleAssetName.isPresent }
            task.outputs.file(emptyBundleFile)
            task.doLast {
                emptyBundleFile.get().asFile.apply {
                    parentFile.mkdirs()
                    writeBytes(ByteArray(0))
                }
            }
        }

        val packageBundleTask = registerPackageArchiveTask(
            project,
            variant,
            packageReactNativeBundleTaskName(variant),
            bundleFile,
        )
        packageBundleTask.configure { it.dependsOn(emptyBundleTask) }
        val rewriteSourceMapTask = project.tasks.register(
            rewriteReactNativeSourceMapTaskName(variant),
            RewriteJsSourceMapTask::class.java,
        ) {
            it.sourceMapInputProperty.set(sourceMapFile)
            it.sourceMapOutputProperty.set(
                project.layout.buildDirectory.file(
                    sourceMapFile.map { map ->
                        "intermediates/measure/${variant.name}/rn-sourcemap/${map.asFile.name}"
                    },
                ),
            )
        }
        val packageSourceMapTask = registerPackageArchiveTask(
            project,
            variant,
            packageReactNativeSourceMapTaskName(variant),
            rewriteSourceMapTask.flatMap { it.sourceMapOutputProperty },
        )

        project.tasks.matching { it.name in candidateNames }.configureEach { bundleTask ->
            val paths = readReactNativeBundlePaths(project, bundleTask) ?: return@configureEach
            if (paths.hermesEnabled) {
                emptyBundleAssetName.set(paths.bundleAssetName)
                bundleFile.set(emptyBundleTask.flatMap { emptyBundleFile })
            } else {
                bundleFile.set(paths.bundle)
            }
            sourceMapFile.set(paths.sourceMap)
            rnBundleArchives.from(
                packageBundleTask.flatMap { it.archiveFile },
                packageSourceMapTask.flatMap { it.archiveFile },
            )
        }
    }

    private fun registerPackageArchiveTask(
        project: Project,
        variant: Variant,
        taskName: String,
        file: Provider<RegularFile>,
    ): TaskProvider<Tar> = project.tasks.register(taskName, Tar::class.java) {
        it.compression = Compression.GZIP
        it.archiveFileName.set(file.map { f -> "${f.asFile.name}.tgz" })
        it.destinationDirectory.set(
            project.layout.buildDirectory.dir("intermediates/measure/${variant.name}"),
        )
        it.from(file)
    }

    private data class ReactNativeBundlePaths(
        val bundle: Provider<RegularFile>,
        val sourceMap: Provider<RegularFile>,
        val bundleAssetName: Provider<String>,
        val hermesEnabled: Boolean,
    )

    private fun readReactNativeBundlePaths(
        project: Project,
        bundleTask: Task,
    ): ReactNativeBundlePaths? = try {
        val jsBundleDir = bundleTask::class.java.getMethod("getJsBundleDir")
            .invoke(bundleTask) as DirectoryProperty
        val jsSourceMapsDir = bundleTask::class.java.getMethod("getJsSourceMapsDir")
            .invoke(bundleTask) as DirectoryProperty

        @Suppress("UNCHECKED_CAST")
        val bundleAssetName = bundleTask::class.java.getMethod("getBundleAssetName")
            .invoke(bundleTask) as Property<String>

        @Suppress("UNCHECKED_CAST")
        val hermesEnabled = bundleTask::class.java.getMethod("getHermesEnabled")
            .invoke(bundleTask) as Property<Boolean>

        @Suppress("UNCHECKED_CAST")
        val hermesFlags = bundleTask::class.java.getMethod("getHermesFlags")
            .invoke(bundleTask) as ListProperty<String>

        if (hermesEnabled.get() && "-output-source-map" !in hermesFlags.get()) {
            project.logger.warn(
                "measure: Hermes is enabled but -output-source-map is missing from " +
                    "hermesFlags; no React Native source map will be uploaded. Add " +
                    "-output-source-map back to hermesFlags to enable symbolication.",
            )
            null
        } else {
            ReactNativeBundlePaths(
                bundle = jsBundleDir.file(bundleAssetName),
                sourceMap = jsSourceMapsDir.file(bundleAssetName.map { "$it.map" }),
                bundleAssetName = bundleAssetName,
                hermesEnabled = hermesEnabled.get(),
            )
        }
    } catch (e: Exception) {
        project.logger.warn(
            "measure: could not read React Native bundle config from $bundleTask, " +
                "bundle will not be uploaded: ${e.message}",
        )
        null
    }

    // Returns the path to the flutter symbols directory if it exists.
    // This function uses the flutter extension to get the source directory and then uses the
    // split-debug-info gradle property to get the symbols directory.
    //
    // In add-to-app setups, the flutter extension lives on a separate subproject (e.g. :flutter),
    // so we search all projects in the build. Multiple projects may have the flutter extension
    // (e.g. Flutter plugins), so we find the one whose source directory contains a pubspec.yaml,
    // which identifies it as the actual Flutter module.
    private fun getFlutterSymbolsDirPath(project: Project): File? {
        val splitDebugInfoPath =
            project.providers.gradleProperty("split-debug-info").orNull
                ?: return null

        val flutterProjects =
            project.rootProject.allprojects.filter {
                it.extensions.findByName("flutter") != null
            }
        if (flutterProjects.isEmpty()) return null

        for (flutterProject in flutterProjects) {
            try {
                val flutterExtension = flutterProject.extensions.findByName("flutter") ?: continue
                val source =
                    flutterExtension::class.java.getMethod("getSource").invoke(flutterExtension)
                        ?: continue
                val flutterSourceDir = flutterProject.file(source)
                if (!File(flutterSourceDir, "pubspec.yaml").exists()) continue
                val symbolsDir = File(splitDebugInfoPath)
                return if (symbolsDir.isAbsolute) symbolsDir else File(flutterSourceDir, splitDebugInfoPath)
            } catch (e: Exception) {
                project.logger.error("measure: Error accessing Flutter source directory: ${e.message}")
            }
        }
        return null
    }
}
