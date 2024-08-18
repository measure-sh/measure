package sh.measure.asm

import com.android.build.api.variant.Instrumentation
import org.gradle.api.provider.MapProperty
import sh.measure.SemVer

/**
 * Applies multiple bytecode transformers to a variant. Transformers are applied in
 * the order they were added to the pipeline.
 */
class BytecodeTransformationPipeline : BytecodeTransformer {
    private val transformers = mutableListOf<BytecodeTransformer>()

    fun addTransformer(transformer: BytecodeTransformer) {
        transformers.add(transformer)
    }

    override fun transform(
        instrumentation: Instrumentation,
        versions: MapProperty<ModuleInfo, SemVer>,
    ) {
        transformers.forEach { it.transform(instrumentation, versions) }
    }
}