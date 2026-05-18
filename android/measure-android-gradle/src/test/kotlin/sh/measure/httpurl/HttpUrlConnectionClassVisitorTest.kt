package sh.measure.httpurl

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
import sh.measure.asm.HttpUrlConnectionClassVisitor
import sh.measure.asm.isInstrumentableForHttpUrlConnection
import java.io.FileInputStream
import java.io.PrintWriter
import java.io.StringWriter

class HttpUrlConnectionClassVisitorTest {

    @Test
    fun `isInstrumentableForHttpUrlConnection skips Measure SDK runtime classes`() {
        assertFalse(
            isInstrumentableForHttpUrlConnection("sh.measure.android.httpurl.MsrHttpUrlFactory"),
        )
    }

    @Test
    fun `isInstrumentableForHttpUrlConnection allows app and third-party classes`() {
        assertTrue(isInstrumentableForHttpUrlConnection("com.example.app.MainActivity"))
    }

    @Test
    fun `rewrites URL_openConnection to call factory_wrap`() {
        val transformed = transform(loadFixture("Sample.class"))

        assertVerifierClean(transformed)

        val invokes = methodInvokesIn(transformed, "doRequest")
        // Original INVOKEVIRTUAL must remain, followed by INVOKESTATIC factory.wrap.
        val openConnIdx = invokes.indexOfFirst {
            it.opcode == Opcodes.INVOKEVIRTUAL &&
                it.owner == "java/net/URL" &&
                it.name == "openConnection"
        }
        assertTrue("expected openConnection call to be present", openConnIdx >= 0)
        val next = invokes[openConnIdx + 1]
        assertEquals(Opcodes.INVOKESTATIC, next.opcode)
        assertEquals("sh/measure/android/httpurl/MsrHttpUrlFactory", next.owner)
        assertEquals("wrap", next.name)
        assertEquals("(Ljava/net/URLConnection;)Ljava/net/URLConnection;", next.desc)
    }

    @Test
    fun `rewrites URL_openConnection_Proxy to call factory_wrap`() {
        val transformed = transform(loadFixture("SampleProxy.class"))
        assertVerifierClean(transformed)

        val invokes = methodInvokesIn(transformed, "doRequest")
        val openConnIdx = invokes.indexOfFirst {
            it.opcode == Opcodes.INVOKEVIRTUAL &&
                it.owner == "java/net/URL" &&
                it.name == "openConnection" &&
                it.desc == "(Ljava/net/Proxy;)Ljava/net/URLConnection;"
        }
        assertTrue("expected openConnection(Proxy) call to be present", openConnIdx >= 0)
        val next = invokes[openConnIdx + 1]
        assertEquals(Opcodes.INVOKESTATIC, next.opcode)
        assertEquals("sh/measure/android/httpurl/MsrHttpUrlFactory", next.owner)
        assertEquals("wrap", next.name)
        assertEquals("(Ljava/net/URLConnection;)Ljava/net/URLConnection;", next.desc)
    }

    @Test
    fun `replaces URL_openStream with factory_openStream`() {
        val transformed = transform(loadFixture("SampleStream.class"))
        assertVerifierClean(transformed)

        val invokes = methodInvokesIn(transformed, "doRequest")
        // Original INVOKEVIRTUAL openStream should be gone, replaced by INVOKESTATIC.
        val virtualOpenStream = invokes.any {
            it.opcode == Opcodes.INVOKEVIRTUAL &&
                it.owner == "java/net/URL" &&
                it.name == "openStream"
        }
        assertTrue("INVOKEVIRTUAL openStream should be replaced", !virtualOpenStream)

        val staticCall = invokes.firstOrNull {
            it.opcode == Opcodes.INVOKESTATIC &&
                it.owner == "sh/measure/android/httpurl/MsrHttpUrlFactory" &&
                it.name == "openStream"
        }
        assertTrue("expected INVOKESTATIC factory.openStream", staticCall != null)
        assertEquals("(Ljava/net/URL;)Ljava/io/InputStream;", staticCall!!.desc)
    }

    @Test
    fun `leaves unrelated method calls untouched`() {
        val transformed = transform(loadFixture("SampleUnrelated.class"))
        assertVerifierClean(transformed)

        val invokes = methodInvokesIn(transformed, "doRequest")
        val factoryCall = invokes.any {
            it.owner == "sh/measure/android/httpurl/MsrHttpUrlFactory"
        }
        assertTrue("no factory call should be injected", !factoryCall)
    }

    // ----- helpers -----

    private fun loadFixture(name: String): ByteArray = FileInputStream("src/test/resources/httpurl/$name").use { it.readBytes() }

    private fun transform(input: ByteArray): ByteArray {
        val reader = ClassReader(input)
        val writer = ClassWriter(reader, ClassWriter.COMPUTE_FRAMES)
        val visitor = HttpUrlConnectionClassVisitor(CheckClassAdapter(writer, true))
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
