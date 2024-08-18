package sh.measure.asm

import com.android.build.api.instrumentation.AsmClassVisitorFactory
import com.android.build.api.instrumentation.FramesComputationMode
import com.android.build.api.instrumentation.InstrumentationScope
import com.android.build.api.variant.Instrumentation
import org.gradle.api.provider.MapProperty
import sh.measure.SemVer

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

    override fun transform(
        instrumentation: Instrumentation,
        versions: MapProperty<ModuleInfo, SemVer>,
    ) {
        instrumentation.transformClassesWith(
            visitorFactoryClass, InstrumentationScope.ALL
        ) {
            it.minVersion.set(minVersion)
            it.maxVersion.set(maxVersion)
            it.versions.set(versions)
        }
        instrumentation.setAsmFramesComputationMode(
            FramesComputationMode.COMPUTE_FRAMES_FOR_INSTRUMENTED_METHODS
        )
    }
}