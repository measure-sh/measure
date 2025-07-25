package sh.measure.asm

import com.android.build.api.instrumentation.AsmClassVisitorFactory
import com.android.build.api.instrumentation.ClassData
import org.objectweb.asm.ClassVisitor
import org.objectweb.asm.MethodVisitor
import org.objectweb.asm.Opcodes
import org.objectweb.asm.commons.AdviceAdapter
import sh.measure.SemVer
import sh.measure.isVersionCompatible

class NavigationTransformer : AsmBytecodeTransformer() {
    override val visitorFactoryClass = NavigationVisitorFactory::class.java

    // Tested from 2.4.0, 2.3.5 does not have navigation-compose package
    override val minVersion = SemVer(2, 4, 0)

    // Tested up-to 2.9.2
    override val maxVersion = SemVer(2, 9, 2)
}

abstract class NavigationVisitorFactory :
    AsmClassVisitorFactory<TransformerParameters>,
    VersionAwareVisitor<TransformerParameters> {
    override fun isVersionCompatible(
        versions: Map<ModuleInfo, SemVer>,
        minVersion: SemVer,
        maxVersion: SemVer,
    ): Boolean {
        return versions.isVersionCompatible(
            "androidx.navigation",
            "navigation-compose",
            minVersion,
            maxVersion,
        )
    }

    override fun createClassVisitor(nextClassVisitor: ClassVisitor): ClassVisitor {
        return NavigationClassVisitor(nextClassVisitor)
    }

    override fun isInstrumentable(classData: ClassData): Boolean {
        return classData.className == "androidx.navigation.compose.NavHostControllerKt"
    }
}

class NavigationClassVisitor(classVisitor: ClassVisitor) :
    ClassVisitor(Opcodes.ASM9, classVisitor) {
    override fun visitMethod(
        access: Int,
        name: String,
        descriptor: String,
        signature: String?,
        exceptions: Array<String>?,
    ): MethodVisitor {
        val methodVisitor = super.visitMethod(access, name, descriptor, signature, exceptions)
        return if (name == "rememberNavController") {
            NavigationMethodVisitor(Opcodes.ASM9, methodVisitor, access, name, descriptor)
        } else {
            methodVisitor
        }
    }
}

/**
 * There are two transformations happening at compile time for `withMeasureNavigationListener`
 * function:
 * 1. Extension functions are compiled as static methods with the receiver as the first argument.
 * The receiver is passed as the first argument to the method.
 *
 * 2. Kotlin compiler plugin takes transforms @Composable functions like the following
 * example:
 *
 * ```kotlin
 * @Composable
 * fun Greeting(name: String)
 * ```
 *
 * is transformed to:
 *
 * ```kotlin
 * fun Greeting(composer: Composer<*>, name: String, key: Int)
 * ```
 *
 * Therefore, the `withMeasureNavigationListener` function is transformed to:
 * ```java
 * static final NavHostController withMeasureNavigationListener(NavHostController $this$withMeasureNavigationListener, Composer composer, int key)
 * ```
 */
class NavigationMethodVisitor(
    apiVersion: Int,
    originalVisitor: MethodVisitor,
    access: Int,
    name: String,
    descriptor: String,
) : AdviceAdapter(
    apiVersion,
    originalVisitor,
    access,
    name,
    descriptor,
) {
    override fun onMethodExit(opcode: Int) {
        // loadArg(0) -> not needed as NavHostController is already on the stack.
        loadArg(1)
        loadArg(2)

        visitMethodInsn(
            Opcodes.INVOKESTATIC,
            "sh/measure/android/navigation/ComposeNavigationCollectorKt",
            "withMeasureNavigationListener",
            "(Landroidx/navigation/NavHostController;Landroidx/compose/runtime/Composer;I)Landroidx/navigation/NavHostController;",
            false,
        )
        super.onMethodExit(opcode)
    }
}
