package sh.measure.asm

/**
 * Allows for construction multiple [BytecodeTransformer]s.
 */
class BytecodeTransformationPipelineBuilder {
    private val pipeline = BytecodeTransformationPipeline()

    fun addTransformer(transformer: BytecodeTransformer): BytecodeTransformationPipelineBuilder {
        pipeline.addTransformer(transformer)
        return this
    }

    fun build(): BytecodeTransformer = pipeline
}
