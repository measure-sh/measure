package sh.measure.okhttp

import junit.framework.TestCase.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized
import org.objectweb.asm.ClassReader
import org.objectweb.asm.ClassWriter
import org.objectweb.asm.util.CheckClassAdapter
import sh.measure.asm.OkHttpClassVisitor
import java.io.FileInputStream
import java.io.PrintWriter
import java.io.StringWriter

@RunWith(Parameterized::class)
class OkHttpClassVisitorTest(private val fixture: String) {

    @Test
    fun `modified bytecode is valid`() {
        val inputStream = FileInputStream(
            "src/test/resources/$fixture",
        )
        val classReader = ClassReader(inputStream)
        val classWriter = ClassWriter(classReader, ClassWriter.COMPUTE_FRAMES)
        val classVisitor = OkHttpClassVisitor(CheckClassAdapter(classWriter, true))
        classReader.accept(classVisitor, ClassReader.SKIP_FRAMES)
        val stringWriter = StringWriter()
        val printWriter = PrintWriter(stringWriter)
        CheckClassAdapter.verify(ClassReader(classWriter.toByteArray()), false, printWriter)
        assertTrue(stringWriter.toString().isEmpty())
    }

    companion object {
        @JvmStatic
        @Parameterized.Parameters(name = "{0}")
        fun fixtures(): List<Array<Any>> = listOf(
            arrayOf("OkHttpClient.class"),
            arrayOf("OkHttpClient_5_3_2.class"),
        )
    }
}
