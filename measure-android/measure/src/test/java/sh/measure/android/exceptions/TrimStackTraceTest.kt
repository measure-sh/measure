package sh.measure.android.exceptions

import org.junit.Assert.assertArrayEquals
import org.junit.Test

class TrimStackTraceKtTest {

    @Test
    fun `when stacktrace is empty, returns empty stacktrace`() {
        val stackTrace = emptyArray<StackTraceElement>()
        val trimmedStackTrace = stackTrace.trimStackTrace()
        assertArrayEquals(stackTrace, trimmedStackTrace)
    }

    @Test
    fun `when stacktrace is within maxSize and no repeats, returns the stacktrace unchanged`() {
        val stackTrace = arrayOf(
            StackTraceElement("Class1", "method1", "file1", 1),
            StackTraceElement("Class2", "method2", "file2", 2),
            StackTraceElement("Class3", "method3", "file3", 3)
        )
        val trimmedStackTrace = stackTrace.trimStackTrace(maxRepeats = 1, maxSize = 3)
        assertArrayEquals(stackTrace, trimmedStackTrace)
    }

    @Test
    fun `when stacktrace contains consecutive repeats more than maxRepeats, trims the stacktrace`() {
        val stackTrace = arrayOf(
            StackTraceElement("Class1", "method1", "file1", 1),
            StackTraceElement("Class1", "method1", "file1", 1),
            StackTraceElement("Class1", "method1", "file1", 1),
            StackTraceElement("Class2", "method2", "file2", 2),
            StackTraceElement("Class2", "method2", "file2", 2),
            StackTraceElement("Class2", "method2", "file2", 2),
            StackTraceElement("Class1", "method1", "file1", 1),
            StackTraceElement("Class1", "method1", "file1", 1)
        )
        val trimmedStackTrace = stackTrace.trimStackTrace(maxRepeats = 2)
        assertArrayEquals(
            arrayOf(
                stackTrace[0],
                stackTrace[1],
                stackTrace[3],
                stackTrace[4],
                stackTrace[6],
                stackTrace[7]
            ),
            trimmedStackTrace,
        )
    }

    @Test
    fun `when stacktrace exceeds maxSize, removes the middle frames`() {
        val stackTrace = arrayOf(
            StackTraceElement("Class1", "method1", "file1", 1),
            StackTraceElement("Class2", "method2", "file2", 2),
            StackTraceElement("Class3", "method3", "file3", 3),
            StackTraceElement("Class4", "method4", "file4", 4),
            StackTraceElement("Class5", "method5", "file5", 5)
        )
        val trimmedStackTrace = stackTrace.trimStackTrace(maxSize = 3)
        assertArrayEquals(
            arrayOf(
                stackTrace[0], stackTrace[3], stackTrace[4]
            ),
            trimmedStackTrace,
        )
    }
}