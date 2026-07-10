package sh.measure.asm

import com.android.build.api.instrumentation.AsmClassVisitorFactory
import com.android.build.api.instrumentation.FramesComputationMode
import com.android.build.api.instrumentation.InstrumentationScope
import com.android.build.api.variant.Variant
import org.gradle.api.Project
import sh.measure.SemVer
import sh.measure.versionsMap

/**
 * A bytecode transformer that uses ASM to transform classes using
 * Android Gradle Plugin's [com.android.build.api.variant.Instrumentation] API.
 *
 * This class is meant to be subclassed to provide the necessary configuration for
 * the transformation including the [visitorFactoryClass], [minVersion], and [maxVersion].
 *
 * Example usage:
 *
 * ```kotlin
 * class MyTransformer : AsmBytecodeTransformer() {
 *    override val visitorFactoryClass = MyVisitorFactory::class.java
 *    override val minVersion = SemVer(1, 0, 0)
 *    override val maxVersion = SemVer(2, 0, 0)
 * }
 * ```
 *
 * @property visitorFactoryClass The [AsmClassVisitorFactory] class that will be used to create
 * the [org.objectweb.asm.ClassVisitor] instances.
 * @property minVersion The minimum version of the library that this transformer is compatible with.
 * @property maxVersion The maximum version of the library that this transformer is compatible with.
 */
abstract class AsmBytecodeTransformer : BytecodeTransformer {
    abstract val visitorFactoryClass: Class<out AsmClassVisitorFactory<TransformerParameters>>
    abstract val minVersion: SemVer
    abstract val maxVersion: SemVer

    /**
     * Hook for subclasses to set transformer-specific instrumentation [params]. Called for
     * each variant while the instrumentation is configured, so the values may depend on the
     * [variant] or [project] (e.g. the app's namespace or plugin extension). Default no-op.
     */
    protected open fun configureParameters(
        params: TransformerParameters,
        variant: Variant,
        project: Project,
    ) {
    }

    override fun transform(
        variant: Variant,
        project: Project,
    ) {
        variant.instrumentation.transformClassesWith(
            visitorFactoryClass,
            InstrumentationScope.ALL,
        ) {
            it.minVersion.set(minVersion)
            it.maxVersion.set(maxVersion)
            configureParameters(it, variant, project)
            project.configurations.named("${variant.name}RuntimeClasspath")
                .configure { configuration ->
                    val map = configuration.incoming.resolutionResult.rootComponent.map { result ->
                        result.versionsMap(project)
                    }
                    it.versions.set(map)
                }
        }
        variant.instrumentation.setAsmFramesComputationMode(
            FramesComputationMode.COMPUTE_FRAMES_FOR_INSTRUMENTED_METHODS,
        )
    }
}
