package sh.measure.asm

import com.android.build.api.variant.Instrumentation
import org.gradle.api.provider.MapProperty
import sh.measure.SemVer

/**
 * Defines a bytecode transformer that can be applied to a variant.
 */
interface BytecodeTransformer {
    fun transform(
        instrumentation: Instrumentation,
        versions: MapProperty<ModuleInfo, SemVer>,
    )
}