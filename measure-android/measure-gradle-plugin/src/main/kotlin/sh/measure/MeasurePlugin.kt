package sh.measure

import com.android.build.api.artifact.SingleArtifact
import com.android.build.api.instrumentation.FramesComputationMode
import com.android.build.api.instrumentation.InstrumentationScope
import com.android.build.api.variant.AndroidComponentsExtension
import com.android.build.api.variant.CanMinifyCode
import com.android.build.api.variant.Variant
import com.android.build.gradle.internal.tasks.factory.dependsOn
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.file.RegularFile
import org.gradle.api.provider.Provider
import sh.measure.okhttp.OkHttpVisitorFactory
import sh.measure.utils.capitalize
import java.time.Duration

class MeasurePlugin : Plugin<Project> {

    companion object {
        const val GROUP_NAME = "measure"
        const val SHARED_SERVICE_HTTP_CLIENT = "measure-http-client"
        const val DEFAULT_ENDPOINT = "http://localhost:8080"
        const val ROUTE_MAPPINGS = "/mappings"
        const val DEFAULT_TIMEOUT_MS = 60_000L
        const val DEFAULT_RETRIES = 3
    }

    override fun apply(project: Project) {
        val androidComponents = project.extensions.getByType(AndroidComponentsExtension::class.java)
        val httpClientProvider = project.gradle.sharedServices.registerIfAbsent(
            SHARED_SERVICE_HTTP_CLIENT, MeasureHttpClient::class.java
        ) { spec ->
            spec.parameters.timeout.set(Duration.ofMillis(DEFAULT_TIMEOUT_MS))
        }
        androidComponents.onVariants { variant ->
            registerProguardMappingUploadTask(variant, project, httpClientProvider)
            injectOkHttpListener(variant)
        }
    }

    private fun injectOkHttpListener(variant: Variant) {
        variant.instrumentation.transformClassesWith(
            OkHttpVisitorFactory::class.java,
            InstrumentationScope.ALL
        ) {}
        variant.instrumentation.setAsmFramesComputationMode(FramesComputationMode.COMPUTE_FRAMES_FOR_INSTRUMENTED_METHODS)
    }

    private fun registerProguardMappingUploadTask(
        variant: Variant, project: Project, httpClientProvider: Provider<MeasureHttpClient>
    ) {
        @Suppress("UnstableApiUsage") val isMinifyEnabled =
            (variant as? CanMinifyCode)?.isMinifyEnabled == true
        if (!isMinifyEnabled) {
            return
        }
        val extractManifestDataProvider = project.tasks.register(
            extractManifestDataTaskName(variant), ExtractManifestDataTask::class.java
        ) {
            it.manifestInputProperty.set(variant.artifacts.get(SingleArtifact.MERGED_MANIFEST))
            it.manifestOutputProperty.set(manifestDataFileProvider(project, variant))
        }

        val uploadProguardMappingProvider = project.tasks.register(
            uploadProguardMappingTaskName(variant), UploadProguardMappingTask::class.java
        ) {
            it.manifestDataProperty.set(manifestDataFileProvider(project, variant))
            it.mappingFileProperty.set(variant.artifacts.get(SingleArtifact.OBFUSCATION_MAPPING_FILE))
            it.mappingEndpointProperty.set(DEFAULT_ENDPOINT + ROUTE_MAPPINGS)
            it.retriesProperty.set(DEFAULT_RETRIES)
            it.usesService(httpClientProvider)
            it.httpClientProvider.set(httpClientProvider)
        }.dependsOn(extractManifestDataProvider)

        // hook up the upload task to run after any assemble<variant> which has minification enabled
        // and is not explicitly filtered.
        project.afterEvaluate {
            it.tasks.named("assemble${variant.name.capitalize()}").configure { task ->
                task.finalizedBy(uploadProguardMappingProvider)
            }
        }
    }

    private fun manifestDataFileProvider(
        project: Project, variant: Variant
    ): Provider<RegularFile> {
        return project.layout.buildDirectory.file("intermediates/measure/${variant.name}/manifestData.json")
    }

    private fun uploadProguardMappingTaskName(variant: Variant) =
        "upload${variant.name.capitalize()}ProguardMappingToMeasure"

    private fun extractManifestDataTaskName(variant: Variant) =
        "extract${variant.name.capitalize()}ManifestData"
}
