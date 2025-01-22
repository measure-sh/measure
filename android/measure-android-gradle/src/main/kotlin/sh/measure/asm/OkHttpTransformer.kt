package sh.measure.asm

import com.android.build.api.instrumentation.AsmClassVisitorFactory
import com.android.build.api.instrumentation.ClassData
import org.objectweb.asm.ClassVisitor
import org.objectweb.asm.MethodVisitor
import org.objectweb.asm.Opcodes
import org.objectweb.asm.commons.AdviceAdapter
import sh.measure.SemVer
import sh.measure.isVersionCompatible

class OkHttpTransformer : AsmBytecodeTransformer() {
    override val visitorFactoryClass = OkHttpVisitorFactory::class.java

    // Tested from 4.7.0, earlier versions do not have all required event factory overrides
    override val minVersion = SemVer(4, 7, 0)

    // Tested up-to 5.0.0-alpha.14 which is the latest version at the time of writing
    override val maxVersion = SemVer(5, 0, 0)
}

abstract class OkHttpVisitorFactory :
    AsmClassVisitorFactory<TransformerParameters>,
    VersionAwareVisitor<TransformerParameters> {
    override fun isVersionCompatible(
        versions: Map<ModuleInfo, SemVer>,
        minVersion: SemVer,
        maxVersion: SemVer,
    ): Boolean {
        return versions.isVersionCompatible(
            "com.squareup.okhttp3",
            "okhttp",
            minVersion,
            maxVersion,
        )
    }

    override fun createClassVisitor(nextClassVisitor: ClassVisitor): ClassVisitor {
        return OkHttpClassVisitor(nextClassVisitor)
    }

    override fun isInstrumentable(classData: ClassData): Boolean {
        return classData.className == "okhttp3.OkHttpClient"
    }
}

class OkHttpClassVisitor(classVisitor: ClassVisitor) : ClassVisitor(Opcodes.ASM9, classVisitor) {
    override fun visitMethod(
        access: Int,
        name: String,
        descriptor: String,
        signature: String?,
        exceptions: Array<String>?,
    ): MethodVisitor {
        val methodVisitor = super.visitMethod(access, name, descriptor, signature, exceptions)
        return if (name == "<init>" && descriptor == "(Lokhttp3/OkHttpClient\$Builder;)V") {
            OkHttpMethodVisitor(Opcodes.ASM9, methodVisitor, access, name, descriptor)
        } else {
            methodVisitor
        }
    }
}

class OkHttpMethodVisitor(
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

    // Stack changes:
    // [builder]
    // [builder, MeasureEventListenerFactory_uninitialized]
    // [builder, MeasureEventListenerFactory_uninitialized, MeasureEventListenerFactory_uninitialized]
    // [builder, MeasureEventListenerFactory_uninitialized, MeasureEventListenerFactory_uninitialized, builder]
    // [builder, MeasureEventListenerFactory_uninitialized, MeasureEventListenerFactory_uninitialized, EventListenerFactory]
    // [builder, MeasureEventListenerFactory]
    // [builder]
    // [builder, MeasureOkHttpApplicationInterceptor_uninitialized]
    // [builder, MeasureOkHttpApplicationInterceptor_uninitialized, MeasureOkHttpApplicationInterceptor_uninitialized]
    // [builder, MeasureOkHttpApplicationInterceptor_uninitialized, MeasureOkHttpApplicationInterceptor_uninitialized, builder]
    // [builder, MeasureOkHttpApplicationInterceptor]
    // [builder]
    override fun onMethodEnter() {
        visitVarInsn(Opcodes.ALOAD, 1)

        // create MeasureEventListenerFactory and add it to the OkHttpClient.Builder
        visitTypeInsn(NEW, "sh/measure/android/okhttp/MeasureEventListenerFactory")
        visitInsn(DUP)
        visitVarInsn(Opcodes.ALOAD, 1)
        visitMethodInsn(
            Opcodes.INVOKEVIRTUAL,
            "okhttp3/OkHttpClient\$Builder",
            "getEventListenerFactory\$okhttp",
            "()Lokhttp3/EventListener\$Factory;",
            false,
        )
        visitMethodInsn(
            INVOKESPECIAL,
            "sh/measure/android/okhttp/MeasureEventListenerFactory",
            "<init>",
            "(Lokhttp3/EventListener\$Factory;)V",
            false,
        )
        visitMethodInsn(
            INVOKEVIRTUAL,
            "okhttp3/OkHttpClient\$Builder",
            "eventListenerFactory",
            "(Lokhttp3/EventListener\$Factory;)Lokhttp3/OkHttpClient\$Builder;",
            false,
        )

        // create MeasureOkHttpApplicationInterceptor and add it to the OkHttpClient.Builder
        visitTypeInsn(NEW, "sh/measure/android/okhttp/MeasureOkHttpApplicationInterceptor")
        visitInsn(DUP)
        visitMethodInsn(
            INVOKESPECIAL,
            "sh/measure/android/okhttp/MeasureOkHttpApplicationInterceptor",
            "<init>",
            "()V",
            false,
        )
        visitMethodInsn(
            INVOKEVIRTUAL,
            "okhttp3/OkHttpClient\$Builder",
            "addInterceptor",
            "(Lokhttp3/Interceptor;)Lokhttp3/OkHttpClient\$Builder;",
            false,
        )
    }
}
