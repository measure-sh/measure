package sh.measure.android.exceptions

import org.junit.Assert.assertArrayEquals
import org.junit.Test

class TrimStackTraceKtTest {

    @Test
    fun `TrimStackTrace returns empty stacktrace, when stacktrace is empty`() {
        val stackTrace = emptyArray<StackTraceElement>()
        val trimmedStackTrace = stackTrace.trimStackTrace()
        assertArrayEquals(stackTrace, trimmedStackTrace)
    }

    @Test
    fun `TrimStackTrace returns the stacktrace unchanged, when stacktrace is within maxSize and no repeats`() {
        val stackTrace = arrayOf(
            StackTraceElement("Class1", "method1", "file1", 1),
            StackTraceElement("Class2", "method2", "file2", 2),
            StackTraceElement("Class3", "method3", "file3", 3),
        )
        val trimmedStackTrace = stackTrace.trimStackTrace(maxRepeats = 1, maxSize = 3)
        assertArrayEquals(stackTrace, trimmedStackTrace)
    }

    @Test
    fun `TrimStackTrace trims the repeats, when stacktrace contains consecutive repeats more than maxRepeats`() {
        val stackTrace = arrayOf(
            StackTraceElement("Class1", "method1", "file1", 1),
            StackTraceElement("Class1", "method1", "file1", 1),
            StackTraceElement("Class1", "method1", "file1", 1),
            StackTraceElement("Class2", "method2", "file2", 2),
            StackTraceElement("Class2", "method2", "file2", 2),
            StackTraceElement("Class2", "method2", "file2", 2),
            StackTraceElement("Class1", "method1", "file1", 1),
            StackTraceElement("Class1", "method1", "file1", 1),
        )
        val trimmedStackTrace = stackTrace.trimStackTrace(maxRepeats = 2)
        assertArrayEquals(
            arrayOf(
                stackTrace[0],
                stackTrace[1],
                stackTrace[3],
                stackTrace[4],
                stackTrace[6],
                stackTrace[7],
            ),
            trimmedStackTrace,
        )
    }

    @Test
    fun `TrimStackTrace removes the middle frames, when stacktrace exceeds maxSize, `() {
        val stackTrace = arrayOf(
            StackTraceElement("Class1", "method1", "file1", 1),
            StackTraceElement("Class2", "method2", "file2", 2),
            StackTraceElement("Class3", "method3", "file3", 3),
            StackTraceElement("Class4", "method4", "file4", 4),
            StackTraceElement("Class5", "method5", "file5", 5),
        )
        val trimmedStackTrace = stackTrace.trimStackTrace(maxSize = 3)
        assertArrayEquals(
            arrayOf(
                stackTrace[0],
                stackTrace[3],
                stackTrace[4],
            ),
            trimmedStackTrace,
        )
    }
}
