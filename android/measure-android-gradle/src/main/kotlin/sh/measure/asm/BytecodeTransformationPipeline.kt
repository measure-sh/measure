package sh.measure.asm

import com.android.build.api.variant.Variant
import org.gradle.api.Project

/**
 * Applies multiple bytecode transformers to a variant. Transformers are applied in
 * the order they were added to the pipeline.
 */
class BytecodeTransformationPipeline : BytecodeTransformer {
    private val transformers = mutableListOf<BytecodeTransformer>()

    fun addTransformer(transformer: BytecodeTransformer) {
        transformers.add(transformer)
    }

    override fun transform(variant: Variant, project: Project) {
        transformers.forEach { it.transform(variant, project) }
    }
}
