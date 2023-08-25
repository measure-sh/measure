package sh.measure.sample.exceptions

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import sh.measure.android.exceptions.ExceptionFactory

class ExceptionFactoryTest {

    @Test
    fun `creates a single exception in ExceptionData when exception has no cause`() {
        // Given
        val exception = IllegalArgumentException("Test exception")

        // When
        val exceptionData = ExceptionFactory.createExceptionData(exception, handled = true)

        // Then
        val measureExceptions = exceptionData.exceptions
        assertEquals(1, measureExceptions.size)

        val measureException = measureExceptions[0]
        assertEquals("java.lang.IllegalArgumentException", measureException.type)
        assertEquals("Test exception", measureException.message)
        assertTrue(measureException.stackframes.isNotEmpty())
    }

    @Test
    fun `creates two exceptions in ExceptionData when exception has a cause`() {
        // Given
        val exception =
            IllegalArgumentException("Test exception").initCause(RuntimeException("Cause"))

        // When
        val exceptionData = ExceptionFactory.createExceptionData(exception, handled = true)

        // Then
        val measureExceptions = exceptionData.exceptions
        assertEquals(2, measureExceptions.size)

        val measureException = measureExceptions[0]
        assertEquals("java.lang.IllegalArgumentException", measureException.type)
        assertEquals("Test exception", measureException.message)
        assertTrue(measureException.stackframes.isNotEmpty())

        val causeException = measureExceptions[1]
        assertEquals("java.lang.RuntimeException", causeException.type)
        assertEquals("Cause", causeException.message)
        assertTrue(causeException.stackframes.isNotEmpty())
    }


    @Test
    fun `creates stackframes in ExceptionData equal to the size of stacktrace`() {
        // Given
        val exception = IllegalArgumentException("Test exception")
        val stackframesSize = exception.stackTrace.size

        // When
        val exceptionData = ExceptionFactory.createExceptionData(exception, handled = true)

        // Then
        val stackframes = exceptionData.exceptions.first().stackframes
        assertEquals(stackframesSize, stackframes.size)
    }

    @Test
    fun `sets handled to true when the exception is handled`() {
        // Given
        val exception = IllegalArgumentException("Test exception")

        // When
        val exceptionData = ExceptionFactory.createExceptionData(exception, handled = true)

        // Then
        assertTrue(exceptionData.handled)
    }

    @Test
    fun `sets handled to false when the exception is unhandled`() {
        // Given
        val exception = IllegalArgumentException("Test exception")

        // When
        val exceptionData = ExceptionFactory.createExceptionData(exception, handled = false)

        // Then
        assertFalse(exceptionData.handled)
    }
}