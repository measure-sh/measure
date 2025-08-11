package sh.measure.asm

import com.android.build.api.instrumentation.AsmClassVisitorFactory
import com.android.build.api.instrumentation.ClassContext
import org.objectweb.asm.ClassVisitor
import sh.measure.SemVer

/**
 * A common base class for creating [AsmClassVisitorFactory] depending on the version of the
 * dependency being instrumented. It applies the class visitor only if the version of the dependency
 * is within the specified range.
 */
interface VersionAwareVisitor<T : TransformerParameters> : AsmClassVisitorFactory<T> {
    fun isVersionCompatible(
        versions: Map<ModuleInfo, SemVer>,
        minVersion: SemVer,
        maxVersion: SemVer,
    ): Boolean

    override fun createClassVisitor(
        classContext: ClassContext,
        nextClassVisitor: ClassVisitor,
    ): ClassVisitor {
        val versions = parameters.get().versions.get().get()
        val minVersion = parameters.get().minVersion.get()
        val maxVersion = parameters.get().maxVersion.get()

        return if (isVersionCompatible(versions, minVersion, maxVersion)) {
            createClassVisitor(nextClassVisitor)
        } else {
            println("[Measure] ASM instrumentation skipped for ${classContext.currentClassData.className} - version compatibility check failed")
            nextClassVisitor
        }
    }

    fun createClassVisitor(nextClassVisitor: ClassVisitor): ClassVisitor
}
