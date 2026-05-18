package sh.measure.asm

import com.android.build.api.instrumentation.AsmClassVisitorFactory
import com.android.build.api.instrumentation.ClassContext
import com.android.build.api.instrumentation.ClassData
import org.objectweb.asm.ClassVisitor
import org.objectweb.asm.MethodVisitor
import org.objectweb.asm.Opcodes
import sh.measure.SemVer

private const val URL_INTERNAL = "java/net/URL"
private const val URL_CONNECTION_INTERNAL = "java/net/URLConnection"
private const val INPUT_STREAM_INTERNAL = "java/io/InputStream"
private const val FACTORY_INTERNAL = "sh/measure/android/httpurl/MsrHttpUrlFactory"

private const val OPEN_CONNECTION_DESC = "()L$URL_CONNECTION_INTERNAL;"
private const val OPEN_CONNECTION_PROXY_DESC = "(Ljava/net/Proxy;)L$URL_CONNECTION_INTERNAL;"
private const val OPEN_STREAM_DESC = "()L$INPUT_STREAM_INTERNAL;"

private const val WRAP_DESC = "(L$URL_CONNECTION_INTERNAL;)L$URL_CONNECTION_INTERNAL;"
private const val OPEN_STREAM_WRAP_DESC = "(L$URL_INTERNAL;)L$INPUT_STREAM_INTERNAL;"

private const val MEASURE_SDK_PACKAGE_PREFIX = "sh.measure.android."

/**
 * Skip transforming any class in the SDK's runtime package so the SDK's own
 * `URL.openConnection()` callsites in `HttpUrlConnectionClient` and the
 * `MsrHttpUrlFactory.openStream` fallback are never wrapped, regardless of
 * destination URL.
 */
internal fun isInstrumentableForHttpUrlConnection(className: String): Boolean =
    !className.startsWith(MEASURE_SDK_PACKAGE_PREFIX)

/**
 * Auto-instruments `java.net.URL.openConnection()` and `URL.openStream()` so every
 * `HttpURLConnection` opened by the app — including those from third-party libraries —
 * gets wrapped by Measure to record HTTP events automatically. No user code changes
 * required.
 *
 * Each matching callsite is rewritten to route through
 * [sh.measure.android.httpurl.MsrHttpUrlFactory]:
 *
 * - `URL.openConnection()` and `URL.openConnection(Proxy)` — wrapped on return.
 * - `URL.openStream()` — replaced; the factory wraps the connection then opens the
 *   stream so the read path is captured too.
 *
 * The wrapper records start time, headers, status code, body, and finish, then
 * delegates every other call to the real connection.
 *
 * Classes in the Measure SDK's own runtime package (`sh.measure.android.*`)
 * are skipped so the SDK's outbound traffic is never auto-tracked.
 *
 * There is no version gating. `java.net.URL` is part of the JDK and stable across
 * every Android API level the SDK supports.
 */
class HttpUrlConnectionTransformer : AsmBytecodeTransformer() {
    override val visitorFactoryClass = HttpUrlConnectionVisitorFactory::class.java
    override val minVersion = SemVer(0, 0, 0)
    override val maxVersion = SemVer(Int.MAX_VALUE, Int.MAX_VALUE, Int.MAX_VALUE)
}

abstract class HttpUrlConnectionVisitorFactory :
    AsmClassVisitorFactory<TransformerParameters> {
    override fun isInstrumentable(classData: ClassData): Boolean =
        isInstrumentableForHttpUrlConnection(classData.className)

    override fun createClassVisitor(
        classContext: ClassContext,
        nextClassVisitor: ClassVisitor,
    ): ClassVisitor = HttpUrlConnectionClassVisitor(nextClassVisitor)
}

class HttpUrlConnectionClassVisitor(classVisitor: ClassVisitor) :
    ClassVisitor(Opcodes.ASM9, classVisitor) {
    override fun visitMethod(
        access: Int,
        name: String,
        descriptor: String,
        signature: String?,
        exceptions: Array<String>?,
    ): MethodVisitor {
        val mv = super.visitMethod(access, name, descriptor, signature, exceptions)
        return HttpUrlConnectionMethodVisitor(Opcodes.ASM9, mv)
    }
}

class HttpUrlConnectionMethodVisitor(api: Int, mv: MethodVisitor) :
    MethodVisitor(api, mv) {
    override fun visitMethodInsn(
        opcode: Int,
        owner: String,
        name: String,
        descriptor: String,
        isInterface: Boolean,
    ) {
        if (opcode == Opcodes.INVOKEVIRTUAL && owner == URL_INTERNAL) {
            when {
                name == "openConnection" && descriptor == OPEN_CONNECTION_DESC -> {
                    super.visitMethodInsn(opcode, owner, name, descriptor, isInterface)
                    super.visitMethodInsn(
                        Opcodes.INVOKESTATIC,
                        FACTORY_INTERNAL,
                        "wrap",
                        WRAP_DESC,
                        false,
                    )
                    return
                }
                name == "openConnection" && descriptor == OPEN_CONNECTION_PROXY_DESC -> {
                    super.visitMethodInsn(opcode, owner, name, descriptor, isInterface)
                    super.visitMethodInsn(
                        Opcodes.INVOKESTATIC,
                        FACTORY_INTERNAL,
                        "wrap",
                        WRAP_DESC,
                        false,
                    )
                    return
                }
                name == "openStream" && descriptor == OPEN_STREAM_DESC -> {
                    super.visitMethodInsn(
                        Opcodes.INVOKESTATIC,
                        FACTORY_INTERNAL,
                        "openStream",
                        OPEN_STREAM_WRAP_DESC,
                        false,
                    )
                    return
                }
            }
        }
        super.visitMethodInsn(opcode, owner, name, descriptor, isInterface)
    }
}
