package sh.measure.android.exceptions

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import sh.measure.android.fakes.FakeTimeProvider

class ExceptionFactoryTest {

    private val timeProvider = FakeTimeProvider()

    @Test
    fun `creates a single exception in MeasureException when exception has no cause`() {
        // Given
        val exception = IllegalArgumentException("Test exception")
        val thread = Thread.currentThread()

        // When
        val measureException = ExceptionFactory.createMeasureException(
            exception, handled = true, timeProvider.currentTimeSinceEpochInMillis, thread
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
    fun `creates two exceptions in MeasureException when exception has a cause`() {
        // Given
        val exception =
            IllegalArgumentException("Test exception").initCause(RuntimeException("Cause"))
        val thread = Thread.currentThread()

        // When
        val measureException = ExceptionFactory.createMeasureException(
            exception, handled = true, timeProvider.currentTimeSinceEpochInMillis, thread
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
    fun `creates frames in MeasureException equal to the size of stacktrace`() {
        // Given
        val exception = IllegalArgumentException("Test exception")
        val framesSize = exception.stackTrace.size
        val thread = Thread.currentThread()

        // When
        val measureException = ExceptionFactory.createMeasureException(
            exception, handled = true, timeProvider.currentTimeSinceEpochInMillis, thread
        )

        // Then
        val frames = measureException.exceptions.first().frames
        assertEquals(framesSize, frames.size)
    }

    @Test
    fun `sets handled to true when the exception is handled`() {
        // Given
        val exception = IllegalArgumentException("Test exception")
        val thread = Thread.currentThread()

        // When
        val measureException = ExceptionFactory.createMeasureException(
            exception, handled = true, timeProvider.currentTimeSinceEpochInMillis, thread
        )

        // Then
        assertTrue(measureException.handled)
    }

    @Test
    fun `sets handled to false when the exception is unhandled`() {
        // Given
        val exception = IllegalArgumentException("Test exception")
        val thread = Thread.currentThread()

        // When
        val measureException = ExceptionFactory.createMeasureException(
            exception, handled = false, timeProvider.currentTimeSinceEpochInMillis, thread
        )

        // Then
        assertFalse(measureException.handled)
    }
}