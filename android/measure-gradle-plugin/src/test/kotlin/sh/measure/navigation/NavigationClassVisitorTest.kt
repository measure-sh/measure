package sh.measure.navigation

import junit.framework.TestCase.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized
import org.objectweb.asm.ClassReader
import org.objectweb.asm.ClassWriter
import org.objectweb.asm.util.CheckClassAdapter
import sh.measure.asm.NavigationClassVisitor
import java.io.FileInputStream
import java.io.PrintWriter
import java.io.StringWriter

@RunWith(Parameterized::class)
class NavigationClassVisitorTest(private val fixture: String) {

    @Test
    fun `modified bytecode is valid`() {
        val inputStream = FileInputStream("src/test/resources/$fixture")
        val classReader = ClassReader(inputStream)
        val classWriter = ClassWriter(classReader, ClassWriter.COMPUTE_FRAMES)
        val classVisitor = NavigationClassVisitor(CheckClassAdapter(classWriter, true))
        classReader.accept(classVisitor, ClassReader.SKIP_FRAMES)
        val stringWriter = StringWriter()
        val printWriter = PrintWriter(stringWriter)
        CheckClassAdapter.verify(ClassReader(classWriter.toByteArray()), false, printWriter)
        assertTrue(stringWriter.toString(), stringWriter.toString().isEmpty())
    }

    companion object {
        @JvmStatic
        @Parameterized.Parameters(name = "{0}")
        fun fixtures(): List<Array<Any>> = listOf(
            arrayOf("NavHostControllerKt_2_4_0.class"),
            arrayOf("NavHostControllerKt_2_9_7.class"),
        )
    }
}
