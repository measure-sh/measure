package sh.measure.asm

import com.android.build.api.variant.Variant
import org.gradle.api.Project

/**
 * Defines a bytecode transformer that can be applied to a variant.
 */
interface BytecodeTransformer {
    fun transform(
        variant: Variant,
        project: Project,
    )
}
