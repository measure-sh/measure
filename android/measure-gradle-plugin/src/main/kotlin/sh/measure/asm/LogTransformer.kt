package sh.measure.asm

import com.android.build.api.instrumentation.AsmClassVisitorFactory
import com.android.build.api.instrumentation.ClassContext
import com.android.build.api.instrumentation.ClassData
import com.android.build.api.variant.Variant
import org.gradle.api.Project
import org.objectweb.asm.ClassVisitor
import org.objectweb.asm.MethodVisitor
import org.objectweb.asm.Opcodes
import sh.measure.MeasurePluginExtension
import sh.measure.SemVer

private const val LOG_INTERNAL = "android/util/Log"
private const val MSR_LOG_INTERNAL = "sh/measure/android/logs/MsrLog"

private const val TAG_MSG_DESC = "(Ljava/lang/String;Ljava/lang/String;)I"
private const val TAG_MSG_THROWABLE_DESC =
    "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/Throwable;)I"
private const val TAG_THROWABLE_DESC = "(Ljava/lang/String;Ljava/lang/Throwable;)I"
private const val PRINTLN_DESC = "(ILjava/lang/String;Ljava/lang/String;)I"

/**
 * `android.util.Log` methods mirrored by `sh.measure.android.logs.MsrLog` with
 * identical signatures, allowing callsites to be redirected by swapping the call
 * owner without touching arguments.
 */
private val interceptedLogMethods = setOf(
    "v" to TAG_MSG_DESC,
    "v" to TAG_MSG_THROWABLE_DESC,
    "d" to TAG_MSG_DESC,
    "d" to TAG_MSG_THROWABLE_DESC,
    "i" to TAG_MSG_DESC,
    "i" to TAG_MSG_THROWABLE_DESC,
    "w" to TAG_MSG_DESC,
    "w" to TAG_MSG_THROWABLE_DESC,
    "w" to TAG_THROWABLE_DESC,
    "e" to TAG_MSG_DESC,
    "e" to TAG_MSG_THROWABLE_DESC,
    "wtf" to TAG_MSG_DESC,
    "wtf" to TAG_MSG_THROWABLE_DESC,
    "wtf" to TAG_THROWABLE_DESC,
    "println" to PRINTLN_DESC,
)

private const val MEASURE_SDK_PACKAGE_PREFIX = "sh.measure.android."

/**
 * Decides whether a class should have its `android.util.Log` calls redirected.
 *
 * The SDK's own runtime package is always skipped so its logging (`AndroidLogger`) and the
 * `MsrLog` forwarding calls are never redirected back into the SDK. When [packagePrefixes]
 * is non-empty, only classes under one of those packages are instrumented; an empty list
 * instruments every class.
 */
internal fun isInstrumentableForLog(
    className: String,
    packagePrefixes: List<String> = emptyList(),
): Boolean {
    if (className.startsWith(MEASURE_SDK_PACKAGE_PREFIX)) {
        return false
    }
    if (packagePrefixes.isEmpty()) {
        return true
    }
    return packagePrefixes.any { prefix ->
        className == prefix || className.startsWith("$prefix.")
    }
}

/**
 * Resolves which package prefixes have their logs auto-collected. The app's own [namespace]
 * is always included; packages set via [MeasurePluginExtension.logsAutoCollectPackageNames]
 * extend collection to additional (e.g. third-party) packages.
 */
internal fun resolveLogPackagePrefixes(
    configuredPackageNames: List<String>,
    namespace: String,
): List<String> {
    return (listOf(namespace) + configuredPackageNames).distinct()
}

/**
 * Auto-collects logs by redirecting `android.util.Log` callsites to
 * [sh.measure.android.logs.MsrLog], which forwards to the real `Log` and additionally
 * tracks the message as a log event. All code is instrumented (app and dependencies), but
 * callsites are only redirected in the app's own package plus any additional packages listed
 * by [MeasurePluginExtension.logsAutoCollectPackageNames], so third-party library logs are opt-in.
 *
 * There is no version gating. `android.util.Log` is a framework class available on
 * every Android API level the SDK supports.
 */
class LogTransformer : AsmBytecodeTransformer() {
    override val visitorFactoryClass = LogVisitorFactory::class.java
    override val minVersion = SemVer(0, 0, 0)
    override val maxVersion = SemVer(Int.MAX_VALUE, Int.MAX_VALUE, Int.MAX_VALUE)

    override fun configureParameters(
        params: TransformerParameters,
        variant: Variant,
        project: Project,
    ) {
        val configured = project.extensions
            .getByType(MeasurePluginExtension::class.java)
            .logsAutoCollectPackageNames
        params.packagePrefixes.set(
            variant.namespace.map { resolveLogPackagePrefixes(configured, it) },
        )
    }
}

abstract class LogVisitorFactory : AsmClassVisitorFactory<TransformerParameters> {
    override fun isInstrumentable(classData: ClassData): Boolean =
        isInstrumentableForLog(classData.className, parameters.get().packagePrefixes.get())

    override fun createClassVisitor(
        classContext: ClassContext,
        nextClassVisitor: ClassVisitor,
    ): ClassVisitor = LogClassVisitor(nextClassVisitor)
}

class LogClassVisitor(classVisitor: ClassVisitor) :
    ClassVisitor(Opcodes.ASM9, classVisitor) {
    override fun visitMethod(
        access: Int,
        name: String,
        descriptor: String,
        signature: String?,
        exceptions: Array<String>?,
    ): MethodVisitor {
        val mv = super.visitMethod(access, name, descriptor, signature, exceptions)
        return LogMethodVisitor(Opcodes.ASM9, mv)
    }
}

class LogMethodVisitor(api: Int, mv: MethodVisitor) : MethodVisitor(api, mv) {
    override fun visitMethodInsn(
        opcode: Int,
        owner: String,
        name: String,
        descriptor: String,
        isInterface: Boolean,
    ) {
        if (opcode == Opcodes.INVOKESTATIC &&
            owner == LOG_INTERNAL &&
            (name to descriptor) in interceptedLogMethods
        ) {
            super.visitMethodInsn(Opcodes.INVOKESTATIC, MSR_LOG_INTERNAL, name, descriptor, false)
            return
        }
        super.visitMethodInsn(opcode, owner, name, descriptor, isInterface)
    }
}
