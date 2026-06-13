package sh.measure.log

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.objectweb.asm.ClassReader
import org.objectweb.asm.ClassWriter
import org.objectweb.asm.Opcodes
import org.objectweb.asm.tree.ClassNode
import org.objectweb.asm.tree.MethodInsnNode
import org.objectweb.asm.util.CheckClassAdapter
import sh.measure.asm.LogClassVisitor
import sh.measure.asm.isInstrumentableForLog
import java.io.FileInputStream
import java.io.PrintWriter
import java.io.StringWriter

class LogClassVisitorTest {

    private val interceptedVariants = listOf(
        "v" to "(Ljava/lang/String;Ljava/lang/String;)I",
        "v" to "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/Throwable;)I",
        "d" to "(Ljava/lang/String;Ljava/lang/String;)I",
        "d" to "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/Throwable;)I",
        "i" to "(Ljava/lang/String;Ljava/lang/String;)I",
        "i" to "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/Throwable;)I",
        "w" to "(Ljava/lang/String;Ljava/lang/String;)I",
        "w" to "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/Throwable;)I",
        "w" to "(Ljava/lang/String;Ljava/lang/Throwable;)I",
        "e" to "(Ljava/lang/String;Ljava/lang/String;)I",
        "e" to "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/Throwable;)I",
        "wtf" to "(Ljava/lang/String;Ljava/lang/String;)I",
        "wtf" to "(Ljava/lang/String;Ljava/lang/Throwable;)I",
        "wtf" to "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/Throwable;)I",
        "println" to "(ILjava/lang/String;Ljava/lang/String;)I",
    )

    @Test
    fun `isInstrumentableForLog skips Measure SDK runtime classes`() {
        assertFalse(isInstrumentableForLog("sh.measure.android.logs.MsrLog"))
        assertFalse(isInstrumentableForLog("sh.measure.android.logger.AndroidLogger"))
    }

    @Test
    fun `isInstrumentableForLog allows app and third-party classes`() {
        assertTrue(isInstrumentableForLog("com.example.app.MainActivity"))
    }

    @Test
    fun `redirects every intercepted Log variant to MsrLog`() {
        val transformed = transform(loadFixture("LogSample.class"))
        assertVerifierClean(transformed)

        val invokes = methodInvokesIn(transformed, "doLog")
        interceptedVariants.forEach { (name, desc) ->
            val redirected = invokes.any {
                it.opcode == Opcodes.INVOKESTATIC &&
                    it.owner == "sh/measure/android/logs/MsrLog" &&
                    it.name == name &&
                    it.desc == desc
            }
            assertTrue("expected MsrLog.$name$desc", redirected)
            val original = invokes.any {
                it.owner == "android/util/Log" && it.name == name && it.desc == desc
            }
            assertFalse("Log.$name$desc should be redirected", original)
        }
    }

    @Test
    fun `leaves non-logging Log members untouched`() {
        val transformed = transform(loadFixture("LogSample.class"))

        val invokes = methodInvokesIn(transformed, "doLog")
        val untouched = invokes.filter { it.owner == "android/util/Log" }.map { it.name }
        assertEquals(listOf("isLoggable", "getStackTraceString"), untouched)
    }

    @Test
    fun `leaves unrelated method calls untouched`() {
        val transformed = transform(loadFixture("LogUnrelated.class"))
        assertVerifierClean(transformed)

        val invokes = methodInvokesIn(transformed, "doLog")
        val redirected = invokes.any { it.owner == "sh/measure/android/logs/MsrLog" }
        assertFalse("no MsrLog call should be injected", redirected)
    }

    // ----- helpers -----

    private fun loadFixture(name: String): ByteArray = FileInputStream("src/test/resources/log/$name").use { it.readBytes() }

    private fun transform(input: ByteArray): ByteArray {
        val reader = ClassReader(input)
        val writer = ClassWriter(reader, ClassWriter.COMPUTE_FRAMES)
        val visitor = LogClassVisitor(CheckClassAdapter(writer, true))
        reader.accept(visitor, ClassReader.SKIP_FRAMES)
        return writer.toByteArray()
    }

    private fun assertVerifierClean(bytes: ByteArray) {
        val sw = StringWriter()
        CheckClassAdapter.verify(ClassReader(bytes), false, PrintWriter(sw))
        assertTrue("verifier output: $sw", sw.toString().isEmpty())
    }

    private fun methodInvokesIn(classBytes: ByteArray, methodName: String): List<MethodInsnNode> {
        val node = ClassNode().also { ClassReader(classBytes).accept(it, 0) }
        val method = node.methods.first { it.name == methodName }
        return method.instructions.iterator().asSequence().filterIsInstance<MethodInsnNode>().toList()
    }
}
