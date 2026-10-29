package sh.measure.android.exceptions

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ExceptionFactoryTest {
    @Test
    fun `ExceptionFactory creates a single exception when exception has no cause`() {
        // Given
        val exception = IllegalArgumentException("Test exception")
        val thread = Thread.currentThread()

        // When
        val measureException = ExceptionFactory.createMeasureException(
            exception,
            severity = ExceptionSeverity.Handled,
            thread = thread,
            foreground = true,
        )

        // Then
        val exceptionUnits = measureException.exceptions
        assertEquals(1, exceptionUnits.size)

        val exceptionUnit = exceptionUnits[0]
        assertEquals("java.lang.IllegalArgumentException", exceptionUnit.type)
        assertEquals("Test exception", exceptionUnit.message)
        assertTrue(exceptionUnit.frames.isNotEmpty())
    }

    @Test
    fun `ExceptionFactory creates two exceptions when exception has a cause`() {
        // Given
        val exception =
            IllegalArgumentException("Test exception").initCause(RuntimeException("Cause"))
        val thread = Thread.currentThread()

        // When
        val measureException = ExceptionFactory.createMeasureException(
            exception,
            severity = ExceptionSeverity.Handled,
            thread = thread,
            foreground = true,
        )

        // Then
        val exceptions = measureException.exceptions
        assertEquals(2, exceptions.size)

        val exceptionUnit = exceptions[0]
        assertEquals("java.lang.IllegalArgumentException", exceptionUnit.type)
        assertEquals("Test exception", exceptionUnit.message)
        assertTrue(exceptionUnit.frames.isNotEmpty())

        val causeException = exceptions[1]
        assertEquals("java.lang.RuntimeException", causeException.type)
        assertEquals("Cause", causeException.message)
        assertTrue(causeException.frames.isNotEmpty())
    }

    @Test
    fun `ExceptionFactory sets the severity passed to it`() {
        // Given
        val exception = IllegalArgumentException("Test exception")
        val thread = Thread.currentThread()

        // When
        val handledException = ExceptionFactory.createMeasureException(
            exception,
            severity = ExceptionSeverity.Handled,
            thread = thread,
            foreground = true,
        )
        val fatalException = ExceptionFactory.createMeasureException(
            exception,
            severity = ExceptionSeverity.Fatal,
            thread = thread,
            foreground = true,
        )

        // Then
        assertEquals(ExceptionSeverity.Handled, handledException.severity)
        assertEquals(ExceptionSeverity.Fatal, fatalException.severity)
    }

    @Test
    fun `ExceptionFactory truncates exception messages to 8192 characters`() {
        val exception = IllegalStateException("a".repeat(10_000), RuntimeException("b".repeat(10_000)))

        val measureException = ExceptionFactory.createMeasureException(
            exception,
            severity = ExceptionSeverity.Handled,
            thread = Thread.currentThread(),
            foreground = true,
        )

        assertEquals("a".repeat(8192), measureException.exceptions[0].message)
        assertEquals("b".repeat(8192), measureException.exceptions[1].message)
    }
}
