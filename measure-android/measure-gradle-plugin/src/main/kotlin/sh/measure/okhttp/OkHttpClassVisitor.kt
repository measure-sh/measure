package sh.measure.okhttp

import com.android.build.api.instrumentation.AsmClassVisitorFactory
import com.android.build.api.instrumentation.ClassContext
import com.android.build.api.instrumentation.ClassData
import com.android.build.api.instrumentation.InstrumentationParameters
import org.objectweb.asm.ClassVisitor
import org.objectweb.asm.MethodVisitor
import org.objectweb.asm.Opcodes
import org.objectweb.asm.commons.AdviceAdapter

abstract class OkHttpVisitorFactory : AsmClassVisitorFactory<InstrumentationParameters.None> {

    override fun createClassVisitor(
        classContext: ClassContext, nextClassVisitor: ClassVisitor
    ): ClassVisitor {
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
        } else methodVisitor
    }
}

class OkHttpMethodVisitor(
    apiVersion: Int, originalVisitor: MethodVisitor, access: Int, name: String, descriptor: String
) : AdviceAdapter(
    apiVersion, originalVisitor, access, name, descriptor
) {

    // Stack changes:
    // [OkHttpClient.Builder]
    // [OkHttpClient.Builder, Uninitialized MeasureEventListenerFactory]
    // [OkHttpClient.Builder, Uninitialized MeasureEventListenerFactory, Uninitialized MeasureEventListenerFactory]
    // [OkHttpClient.Builder, Uninitialized MeasureEventListenerFactory, Uninitialized MeasureEventListenerFactory, OkHttpClient.Builder]
    // [OkHttpClient.Builder, Uninitialized MeasureEventListenerFactory, Uninitialized MeasureEventListenerFactory, EventListener.Factory]
    // [OkHttpClient.Builder, Initialized MeasureEventListenerFactory]
    // [OkHttpClient.Builder]
    override fun onMethodEnter() {
        visitVarInsn(Opcodes.ALOAD, 1)
        visitTypeInsn(NEW, "sh/measure/android/okhttp/MeasureEventListenerFactory")
        visitInsn(DUP)
        visitVarInsn(Opcodes.ALOAD, 1)
        visitMethodInsn(
            Opcodes.INVOKEVIRTUAL,
            "okhttp3/OkHttpClient\$Builder",
            "getEventListenerFactory\$okhttp",
            "()Lokhttp3/EventListener\$Factory;",
            false
        )
        visitMethodInsn(
            INVOKESPECIAL,
            "sh/measure/android/okhttp/MeasureEventListenerFactory",
            "<init>",
            "(Lokhttp3/EventListener\$Factory;)V",
            false
        )
        visitMethodInsn(
            INVOKEVIRTUAL,
            "okhttp3/OkHttpClient\$Builder",
            "eventListenerFactory",
            "(Lokhttp3/EventListener\$Factory;)Lokhttp3/OkHttpClient\$Builder;",
            false
        )
    }
}