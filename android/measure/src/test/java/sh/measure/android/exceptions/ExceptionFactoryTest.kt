package sh.measure.android.exceptions

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
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
            handled = true,
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
            handled = true,
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
    fun `ExceptionFactory sets handled to true when the exception is handled`() {
        // Given
        val exception = IllegalArgumentException("Test exception")
        val thread = Thread.currentThread()

        // When
        val measureException = ExceptionFactory.createMeasureException(
            exception,
            handled = true,
            thread = thread,
            foreground = true,
        )

        // Then
        assertTrue(measureException.handled)
    }

    @Test
    fun `ExceptionFactory sets handled to false when the exception is unhandled`() {
        // Given
        val exception = IllegalArgumentException("Test exception")
        val thread = Thread.currentThread()

        // When
        val measureException = ExceptionFactory.createMeasureException(
            exception,
            handled = false,
            thread = thread,
            foreground = true,
        )

        // Then
        assertFalse(measureException.handled)
    }
}
